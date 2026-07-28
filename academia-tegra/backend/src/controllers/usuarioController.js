const bcrypt = require('bcryptjs');
const prisma = require('../config/prisma');
const { criarUsuarioInternoSchema, editarUsuarioInternoSchema } = require('../utils/schemas');
const { HttpError } = require('../middleware/errorHandler');

// Lista administradores e supervisores (painel do admin)
async function listarInternos(req, res) {
  const { perfil } = req.query; // filtro opcional: ADMIN | SUPERVISOR
  const usuarios = await prisma.usuario.findMany({
    where: {
      perfil: perfil ? perfil : { in: ['ADMIN', 'SUPERVISOR'] },
    },
    select: {
      id: true, nome: true, email: true, perfil: true, ativo: true, criadoEm: true,
      produtosVinculados: { select: { produto: { select: { id: true, nome: true, corCalendario: true } } } },
    },
    orderBy: { nome: 'asc' },
  });
  res.json(usuarios);
}

// Lista supervisores com contadores para a aba "Supervisores" (acessível a Admin e Supervisor)
async function listarSupervisoresComEstatisticas(req, res) {
  const trintaDiasAtras = new Date();
  trintaDiasAtras.setDate(trintaDiasAtras.getDate() - 30);

  const supervisores = await prisma.usuario.findMany({
    where: { perfil: 'SUPERVISOR', ativo: true },
    select: {
      id: true,
      nome: true,
      produtosVinculados: { select: { produto: { select: { id: true, nome: true, corCalendario: true } } } },
      treinamentosCriados: {
        select: { id: true, data: true, status: true },
      },
    },
    orderBy: { nome: 'asc' },
  });

  const resultado = supervisores.map((s) => ({
    id: s.id,
    nome: s.nome,
    produtos: s.produtosVinculados.map((v) => v.produto),
    totalTreinamentos: s.treinamentosCriados.length,
    treinamentosUltimos30Dias: s.treinamentosCriados.filter((t) => new Date(t.data) >= trintaDiasAtras).length,
  }));

  res.json(resultado);
}

// Detalhamento de um supervisor: treinamentos concluídos e futuros
async function detalharSupervisor(req, res) {
  const { id } = req.params;
  const agora = new Date();

  const supervisor = await prisma.usuario.findUnique({
    where: { id },
    select: { id: true, nome: true, produtosVinculados: { select: { produto: true } } },
  });
  if (!supervisor) throw new HttpError(404, 'Supervisor não encontrado.');

  const treinamentos = await prisma.treinamento.findMany({
    where: { supervisorId: id },
    include: { produto: true },
  });

  const concluidos = treinamentos
    .filter((t) => new Date(t.data) < agora || t.status === 'REALIZADO')
    .sort((a, b) => new Date(b.data) - new Date(a.data))
    .map((t) => ({ id: t.id, data: t.data, produto: t.produto.nome, tema: t.tema }));

  const futuros = treinamentos
    .filter((t) => new Date(t.data) >= agora && t.status === 'AGENDADO')
    .sort((a, b) => new Date(a.data) - new Date(b.data))
    .map((t) => ({ id: t.id, data: t.data, produto: t.produto.nome, tema: t.tema }));

  res.json({
    id: supervisor.id,
    nome: supervisor.nome,
    produtos: supervisor.produtosVinculados.map((v) => v.produto),
    treinamentosConcluidos: concluidos,
    treinamentosFuturos: futuros,
  });
}

// Cria administrador ou supervisor (somente ADMIN)
async function criarInterno(req, res) {
  const dados = criarUsuarioInternoSchema.parse(req.body);

  const senhaHash = await bcrypt.hash(dados.senha, 10);

  const usuario = await prisma.usuario.create({
    data: {
      nome: dados.nome,
      email: dados.email,
      perfil: dados.perfil,
      senhaHash,
      ...(dados.perfil === 'SUPERVISOR' && dados.produtoIds
        ? { produtosVinculados: { create: dados.produtoIds.map((produtoId) => ({ produtoId })) } }
        : {}),
    },
    select: { id: true, nome: true, email: true, perfil: true },
  });

  res.status(201).json(usuario);
}

// Edita nome/email/produtos vinculados/ativo (somente ADMIN)
async function editarInterno(req, res) {
  const { id } = req.params;
  const dados = editarUsuarioInternoSchema.parse(req.body);

  const usuarioExistente = await prisma.usuario.findUnique({ where: { id } });
  if (!usuarioExistente || !['ADMIN', 'SUPERVISOR'].includes(usuarioExistente.perfil)) {
    throw new HttpError(404, 'Usuário não encontrado.');
  }

  if (dados.produtoIds && usuarioExistente.perfil === 'SUPERVISOR') {
    await prisma.produtoSupervisor.deleteMany({ where: { supervisorId: id } });
    await prisma.produtoSupervisor.createMany({
      data: dados.produtoIds.map((produtoId) => ({ produtoId, supervisorId: id })),
    });
  }

  const usuario = await prisma.usuario.update({
    where: { id },
    data: {
      ...(dados.nome && { nome: dados.nome }),
      ...(dados.email && { email: dados.email }),
      ...(dados.ativo !== undefined && { ativo: dados.ativo }),
    },
    select: { id: true, nome: true, email: true, perfil: true, ativo: true },
  });

  res.json(usuario);
}

module.exports = {
  listarInternos,
  listarSupervisoresComEstatisticas,
  detalharSupervisor,
  criarInterno,
  editarInterno,
};
