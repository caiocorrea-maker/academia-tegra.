const bcrypt = require('bcryptjs');
const prisma = require('../config/prisma');
const { cadastroCorretorSchema, editarCorretorSchema } = require('../utils/schemas');
const { validarCPF } = require('../utils/cpf');
const { HttpError } = require('../middleware/errorHandler');
const { getFileUrl, uploadBuffer, deleteFile } = require('../config/s3');
const sharp = require('sharp');

// Cadastro público/próprio do corretor
async function cadastrar(req, res) {
  const dados = cadastroCorretorSchema.parse(req.body);

  if (!validarCPF(dados.cpf)) {
    throw new HttpError(400, 'CPF inválido.');
  }
  const cpfLimpo = dados.cpf.replace(/\D/g, '');

  const empresa = await prisma.empresaVenda.findUnique({ where: { id: dados.empresaId } });
  if (!empresa || !empresa.ativo) {
    throw new HttpError(400, 'Empresa de vendas inválida.');
  }

  const senhaHash = await bcrypt.hash(dados.senha, 10);

  const corretor = await prisma.usuario.create({
    data: {
      nome: dados.nome,
      email: dados.email,
      cpf: cpfLimpo,
      empresaId: dados.empresaId,
      perfil: 'CORRETOR',
      senhaHash,
      gerente: dados.gerente || null,
      diretor: dados.diretor || null,
      creci: dados.creci || null,
    },
    select: { id: true, nome: true, email: true, empresa: { select: { nome: true } } },
  });

  res.status(201).json(corretor);
}

// Lista de corretores (Admin e Supervisor) - alfabética, com filtro por empresa e busca por nome
async function listar(req, res) {
  const { empresaId, busca } = req.query;

  const corretores = await prisma.usuario.findMany({
    where: {
      perfil: 'CORRETOR',
      ativo: true,
      ...(empresaId && { empresaId }),
      ...(busca && { nome: { contains: busca, mode: 'insensitive' } }),
    },
    select: {
      id: true, nome: true, email: true,
      empresa: { select: { id: true, nome: true } },
    },
    orderBy: { nome: 'asc' },
  });

  res.json(corretores);
}

// Certificados são válidos por 6 meses a partir da emissão.
const MESES_VALIDADE_CERTIFICADO = 6;

function calcularValidoAte(emitidoEm) {
  const validoAte = new Date(emitidoEm);
  validoAte.setMonth(validoAte.getMonth() + MESES_VALIDADE_CERTIFICADO);
  return validoAte;
}

// Perfil completo de um corretor: certificados agrupados por produto (do mais antigo para
// o mais novo dentro de cada produto), cada um com sua validade de 6 meses calculada, e um
// indicador de aptidão por produto (verde/vermelho) com base no mínimo de certificados
// válidos configurado em cada produto (Produto.certificadosNecessarios).
async function detalhar(req, res) {
  const { id } = req.params;

  if (req.usuario.perfil === 'CORRETOR' && req.usuario.id !== id) {
    throw new HttpError(403, 'Você só pode visualizar o próprio perfil.');
  }

  const corretor = await prisma.usuario.findUnique({
    where: { id, perfil: 'CORRETOR' },
    select: {
      id: true, nome: true, cpf: true, email: true, gerente: true, diretor: true, creci: true, fotoUrl: true,
      empresa: { select: { id: true, nome: true } },
      certificados: {
        select: {
          id: true, percentual: true, emitidoEm: true, urlArquivo: true,
          treinamento: { select: { tema: true, produto: { select: { id: true, nome: true, corCalendario: true, certificadosNecessarios: true } } } },
        },
      },
    },
  });

  if (!corretor) throw new HttpError(404, 'Corretor não encontrado.');

  const agora = new Date();

  const certificadosProcessados = await Promise.all(
    corretor.certificados.map(async (c) => ({
      id: c.id,
      percentual: c.percentual,
      emitidoEm: c.emitidoEm,
      validoAte: calcularValidoAte(c.emitidoEm),
      valido: agora < calcularValidoAte(c.emitidoEm),
      tema: c.treinamento.tema,
      produto: c.treinamento.produto,
      url: await getFileUrl(c.urlArquivo),
    }))
  );

  // Agrupa por produto, ordenando os certificados do mais antigo para o mais novo dentro do grupo.
  const grupos = {};
  for (const cert of certificadosProcessados) {
    const chave = cert.produto.id;
    if (!grupos[chave]) {
      grupos[chave] = {
        produto: { id: cert.produto.id, nome: cert.produto.nome, corCalendario: cert.produto.corCalendario },
        certificadosNecessarios: cert.produto.certificadosNecessarios,
        certificados: [],
      };
    }
    grupos[chave].certificados.push(cert);
  }

  const certificadosPorProduto = Object.values(grupos)
    .map((grupo) => {
      grupo.certificados.sort((a, b) => new Date(a.emitidoEm) - new Date(b.emitidoEm));
      const validosCount = grupo.certificados.filter((c) => c.valido).length;
      return {
        ...grupo,
        qtdCertificadosValidos: validosCount,
        apto: validosCount >= grupo.certificadosNecessarios,
      };
    })
    .sort((a, b) => a.produto.nome.localeCompare(b.produto.nome));

  // Carteirinha (item 2): precisa de TODOS os produtos ativos, mesmo os que o corretor
  // ainda não tem nenhum certificado (aparecem com todas as insígnias cinzas/vazias).
  const todosProdutosAtivos = await prisma.produto.findMany({
    where: { ativo: true },
    select: { id: true, nome: true, corCalendario: true, certificadosNecessarios: true },
    orderBy: { nome: 'asc' },
  });
  const carteirinhaProdutos = todosProdutosAtivos.map((produto) => {
    const grupo = certificadosPorProduto.find((g) => g.produto.id === produto.id);
    return {
      produto: { id: produto.id, nome: produto.nome, corCalendario: produto.corCalendario },
      certificadosNecessarios: produto.certificadosNecessarios,
      qtdCertificadosValidos: grupo ? grupo.qtdCertificadosValidos : 0,
      apto: grupo ? grupo.apto : false,
    };
  });

  res.json({
    id: corretor.id,
    nome: corretor.nome,
    cpf: corretor.cpf,
    email: corretor.email,
    gerente: corretor.gerente,
    diretor: corretor.diretor,
    creci: corretor.creci,
    empresa: corretor.empresa,
    fotoUrl: await getFileUrl(corretor.fotoUrl),
    certificadosPorProduto,
    carteirinhaProdutos,
  });
}

// Upload/atualização da foto de perfil (usada na carteirinha). O próprio corretor sobe a
// foto; comprimimos (redimensiona + JPEG qualidade reduzida) antes de subir ao bucket, para
// ocupar pouco espaço.
async function atualizarFoto(req, res) {
  if (!req.file) throw new HttpError(400, 'Nenhuma imagem enviada.');

  const corretorAtual = await prisma.usuario.findUnique({ where: { id: req.usuario.id } });

  const bufferComprimido = await sharp(req.file.buffer)
    .rotate()
    .resize({ width: 500, height: 500, fit: 'cover' })
    .jpeg({ quality: 70, mozjpeg: true })
    .toBuffer();

  const key = await uploadBuffer(bufferComprimido, 'foto-perfil.jpg', 'image/jpeg', 'fotos-perfil');

  await prisma.usuario.update({ where: { id: req.usuario.id }, data: { fotoUrl: key } });

  if (corretorAtual?.fotoUrl) {
    await deleteFile(corretorAtual.fotoUrl).catch(() => {});
  }

  res.json({ fotoUrl: await getFileUrl(key) });
}

// Corretor edita os próprios dados
async function editarProprio(req, res) {
  const dados = editarCorretorSchema.parse(req.body);
  const data = {};

  if (dados.nome) data.nome = dados.nome;
  if (dados.email) data.email = dados.email;
  if (dados.gerente !== undefined) data.gerente = dados.gerente || null;
  if (dados.diretor !== undefined) data.diretor = dados.diretor || null;
  if (dados.creci !== undefined) data.creci = dados.creci || null;
  if (dados.empresaId) {
    const empresa = await prisma.empresaVenda.findUnique({ where: { id: dados.empresaId } });
    if (!empresa || !empresa.ativo) throw new HttpError(400, 'Empresa de vendas inválida.');
    data.empresaId = dados.empresaId;
  }
  if (dados.senha) data.senhaHash = await bcrypt.hash(dados.senha, 10);

  const corretor = await prisma.usuario.update({
    where: { id: req.usuario.id },
    data,
    select: { id: true, nome: true, email: true, empresa: { select: { nome: true } } },
  });

  res.json(corretor);
}

// Exclusão de corretor (somente Admin). Se houver histórico vinculado (certificados,
// interesses, presenças, tentativas de prova), o banco impede a exclusão para preservar
// o histórico — nesse caso orientamos a inativar via edição (ativo=false) em vez de excluir.
async function excluir(req, res) {
  const { id } = req.params;

  const corretor = await prisma.usuario.findUnique({ where: { id, perfil: 'CORRETOR' } });
  if (!corretor) throw new HttpError(404, 'Corretor não encontrado.');

  // MODO TESTES: certificados não têm exclusão em cascata no schema, então são apagados
  // manualmente aqui antes do usuário (interesses, presenças e tentativas de prova já
  // cascateiam sozinhos). Para reativar a trava original, remova o deleteMany abaixo e
  // deixe o catch de P2003/P2014 barrar a exclusão como antes.
  try {
    await prisma.$transaction([
      prisma.certificado.deleteMany({ where: { corretorId: id } }),
      prisma.usuario.delete({ where: { id } }),
    ]);
    res.json({ mensagem: 'Corretor excluído com sucesso.' });
  } catch (err) {
    if (err.code === 'P2003' || err.code === 'P2014') {
      throw new HttpError(409, 'Este corretor possui histórico vinculado e não pode ser excluído. Você pode inativá-lo em vez disso.');
    }
    throw err;
  }
}

// Inativa/reativa corretor (somente Admin) — alternativa à exclusão quando há histórico vinculado
async function alternarAtivo(req, res) {
  const { id } = req.params;
  const { ativo } = req.body;

  const corretor = await prisma.usuario.findUnique({ where: { id, perfil: 'CORRETOR' } });
  if (!corretor) throw new HttpError(404, 'Corretor não encontrado.');

  const atualizado = await prisma.usuario.update({
    where: { id },
    data: { ativo: Boolean(ativo) },
    select: { id: true, nome: true, ativo: true },
  });
  res.json(atualizado);
}

module.exports = { cadastrar, listar, detalhar, editarProprio, excluir, alternarAtivo, atualizarFoto };
