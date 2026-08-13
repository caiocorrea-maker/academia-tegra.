const prisma = require('../config/prisma');
const { materialBibliotecaSchema, editarMaterialBibliotecaSchema } = require('../utils/schemas');
const { HttpError } = require('../middleware/errorHandler');
const { uploadBuffer, getFileUrl, deleteFile } = require('../config/s3');

const MESES_VALIDADE_CERTIFICADO = 6;

function certificadoValido(emitidoEm) {
  const validoAte = new Date(emitidoEm);
  validoAte.setMonth(validoAte.getMonth() + MESES_VALIDADE_CERTIFICADO);
  return new Date() < validoAte;
}

// Verifica se um usuário pode gerenciar (cadastrar/editar/excluir) materiais de um produto:
// admin pode qualquer um; supervisor só os dos produtos vinculados a ele.
async function podeGerenciarProduto(usuario, produtoId) {
  if (usuario.perfil === 'ADMIN') return true;
  if (usuario.perfil !== 'SUPERVISOR') return false;
  const vinculado = await prisma.produtoSupervisor.findUnique({
    where: { produtoId_supervisorId: { produtoId, supervisorId: usuario.id } },
  });
  return Boolean(vinculado);
}

// Um corretor só acessa o material se ele não exigir certificado (treinamentoNomeRef vazio)
// ou se o corretor tiver ao menos um certificado válido de um treinamento com aquele tema,
// no mesmo produto.
async function corretorPodeAcessar(corretorId, material) {
  if (!material.treinamentoNomeRef) return true;
  const certificados = await prisma.certificado.findMany({
    where: {
      corretorId,
      treinamento: { produtoId: material.produtoId, tema: material.treinamentoNomeRef },
    },
    select: { emitidoEm: true },
  });
  return certificados.some((c) => certificadoValido(c.emitidoEm));
}

// Lista materiais, com filtro por produto e busca por nome. Visível a todos os perfis.
// Para o CORRETOR, indica se ele pode acessar (baixar) cada material.
async function listar(req, res) {
  const { produtoId, busca } = req.query;

  const materiais = await prisma.materialBiblioteca.findMany({
    where: {
      ...(produtoId && { produtoId }),
      ...(busca && { nome: { contains: busca, mode: 'insensitive' } }),
    },
    include: { produto: { select: { id: true, nome: true, corCalendario: true } } },
    orderBy: { nome: 'asc' },
  });

  const resultado = await Promise.all(
    materiais.map(async (m) => ({
      id: m.id,
      nome: m.nome,
      descricao: m.descricao,
      nomeArquivo: m.nomeArquivo,
      tipoArquivo: m.tipoArquivo,
      tamanhoBytes: m.tamanhoBytes,
      treinamentoNomeRef: m.treinamentoNomeRef,
      produto: m.produto,
      criadoEm: m.criadoEm,
      podeAcessar: req.usuario.perfil === 'CORRETOR' ? await corretorPodeAcessar(req.usuario.id, m) : true,
    }))
  );

  res.json(resultado);
}

async function criar(req, res) {
  const dados = materialBibliotecaSchema.parse(req.body);
  if (!req.file) throw new HttpError(400, 'Selecione um arquivo em PDF ou PPT/PPTX.');

  if (!(await podeGerenciarProduto(req.usuario, dados.produtoId))) {
    throw new HttpError(403, 'Você não está vinculado a este produto.');
  }

  const key = await uploadBuffer(req.file.buffer, req.file.originalname, req.file.mimetype, 'biblioteca');

  const material = await prisma.materialBiblioteca.create({
    data: {
      produtoId: dados.produtoId,
      nome: dados.nome,
      descricao: dados.descricao || null,
      treinamentoNomeRef: dados.treinamentoNomeRef || null,
      urlArquivo: key,
      nomeArquivo: req.file.originalname,
      tipoArquivo: req.file.mimetype,
      tamanhoBytes: req.file.size,
      criadoPorId: req.usuario.id,
    },
  });

  res.status(201).json(material);
}

async function editar(req, res) {
  const { id } = req.params;
  const dados = editarMaterialBibliotecaSchema.parse(req.body);

  const material = await prisma.materialBiblioteca.findUnique({ where: { id } });
  if (!material) throw new HttpError(404, 'Material não encontrado.');

  if (!(await podeGerenciarProduto(req.usuario, material.produtoId))) {
    throw new HttpError(403, 'Você não tem permissão para editar este material.');
  }
  if (dados.produtoId && !(await podeGerenciarProduto(req.usuario, dados.produtoId))) {
    throw new HttpError(403, 'Você não está vinculado ao produto de destino.');
  }

  const data = {
    ...(dados.produtoId && { produtoId: dados.produtoId }),
    ...(dados.nome && { nome: dados.nome }),
    ...(dados.descricao !== undefined && { descricao: dados.descricao || null }),
    ...(dados.treinamentoNomeRef !== undefined && { treinamentoNomeRef: dados.treinamentoNomeRef || null }),
  };

  if (req.file) {
    const key = await uploadBuffer(req.file.buffer, req.file.originalname, req.file.mimetype, 'biblioteca');
    await deleteFile(material.urlArquivo);
    data.urlArquivo = key;
    data.nomeArquivo = req.file.originalname;
    data.tipoArquivo = req.file.mimetype;
    data.tamanhoBytes = req.file.size;
  }

  const atualizado = await prisma.materialBiblioteca.update({ where: { id }, data });
  res.json(atualizado);
}

async function excluir(req, res) {
  const { id } = req.params;

  const material = await prisma.materialBiblioteca.findUnique({ where: { id } });
  if (!material) throw new HttpError(404, 'Material não encontrado.');

  if (!(await podeGerenciarProduto(req.usuario, material.produtoId))) {
    throw new HttpError(403, 'Você não tem permissão para excluir este material.');
  }

  await prisma.materialBiblioteca.delete({ where: { id } });
  await deleteFile(material.urlArquivo);

  res.json({ mensagem: 'Material excluído com sucesso.' });
}

async function obterUrlDownload(req, res) {
  const { id } = req.params;

  const material = await prisma.materialBiblioteca.findUnique({ where: { id } });
  if (!material) throw new HttpError(404, 'Material não encontrado.');

  if (req.usuario.perfil === 'CORRETOR' && !(await corretorPodeAcessar(req.usuario.id, material))) {
    throw new HttpError(403, 'Este material requer um certificado válido para ser acessado.');
  }

  const url = await getFileUrl(material.urlArquivo);
  res.json({ url, nomeArquivo: material.nomeArquivo });
}

module.exports = { listar, criar, editar, excluir, obterUrlDownload };
