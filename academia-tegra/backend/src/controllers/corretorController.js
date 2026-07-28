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
      id: true, nome: true, cpf: true, email: true,
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

module.exports = { cadastrar, listar, detalhar, editarProprio };
