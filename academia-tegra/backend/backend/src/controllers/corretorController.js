const bcrypt = require('bcryptjs');
const prisma = require('../config/prisma');
const { cadastroCorretorSchema, editarCorretorSchema } = require('../utils/schemas');
const { validarCPF } = require('../utils/cpf');
const { HttpError } = require('../middleware/errorHandler');
const { getFileUrl } = require('../config/s3');

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

// Perfil completo de um corretor, com certificados (mais recente primeiro)
async function detalhar(req, res) {
  const { id } = req.params;

  // Corretor só pode ver o próprio perfil; Admin/Supervisor podem ver qualquer um
  if (req.usuario.perfil === 'CORRETOR' && req.usuario.id !== id) {
    throw new HttpError(403, 'Você só pode visualizar o próprio perfil.');
  }

  const corretor = await prisma.usuario.findUnique({
    where: { id, perfil: 'CORRETOR' },
    select: {
      id: true, nome: true, cpf: true, email: true, gerente: true, diretor: true,
      empresa: { select: { id: true, nome: true } },
      certificados: {
        orderBy: { emitidoEm: 'desc' },
        select: {
          id: true, percentual: true, emitidoEm: true, urlArquivo: true,
          treinamento: { select: { tema: true, produto: { select: { nome: true } } } },
        },
      },
    },
  });

  if (!corretor) throw new HttpError(404, 'Corretor não encontrado.');

  const certificadosComUrl = await Promise.all(
    corretor.certificados.map(async (c) => ({ ...c, urlArquivo: await getFileUrl(c.urlArquivo) }))
  );

  res.json({ ...corretor, certificados: certificadosComUrl });
}

// Corretor edita os próprios dados
async function editarProprio(req, res) {
  const dados = editarCorretorSchema.parse(req.body);
  const data = {};

  if (dados.nome) data.nome = dados.nome;
  if (dados.email) data.email = dados.email;
  if (dados.gerente !== undefined) data.gerente = dados.gerente || null;
  if (dados.diretor !== undefined) data.diretor = dados.diretor || null;
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

  try {
    await prisma.usuario.delete({ where: { id } });
    res.json({ mensagem: 'Corretor excluído com sucesso.' });
  } catch (err) {
    if (err.code === 'P2003' || err.code === 'P2014') {
      throw new HttpError(409, 'Este corretor possui histórico vinculado (certificados, presenças ou provas) e não pode ser excluído. Você pode inativá-lo em vez disso.');
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

module.exports = { cadastrar, listar, detalhar, editarProprio, excluir, alternarAtivo };
