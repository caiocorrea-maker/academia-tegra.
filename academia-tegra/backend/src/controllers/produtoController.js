const prisma = require('../config/prisma');
const { produtoSchema } = require('../utils/schemas');

// Lista produtos. Se o solicitante for SUPERVISOR e query somenteMeus=true, filtra pelos vinculados.
async function listar(req, res) {
  const { somenteMeus } = req.query;

  if (somenteMeus === 'true' && req.usuario.perfil === 'SUPERVISOR') {
    const vinculos = await prisma.produtoSupervisor.findMany({
      where: { supervisorId: req.usuario.id },
      select: { produto: true },
    });
    return res.json(vinculos.map((v) => v.produto).filter((p) => p.ativo));
  }

  const produtos = await prisma.produto.findMany({
    where: { ativo: true },
    orderBy: { nome: 'asc' },
  });
  res.json(produtos);
}

async function criar(req, res) {
  const dados = produtoSchema.parse(req.body);
  const produto = await prisma.produto.create({ data: dados });
  res.status(201).json(produto);
}

async function editar(req, res) {
  const { id } = req.params;
  const dados = produtoSchema.partial().parse(req.body);
  const produto = await prisma.produto.update({ where: { id }, data: dados });
  res.json(produto);
}

async function inativar(req, res) {
  const { id } = req.params;
  await prisma.produto.update({ where: { id }, data: { ativo: false } });
  res.json({ mensagem: 'Produto inativado com sucesso.' });
}

module.exports = { listar, criar, editar, inativar };
