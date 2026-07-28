const prisma = require('../config/prisma');
const { empresaSchema } = require('../utils/schemas');
const { HttpError } = require('../middleware/errorHandler');

async function listar(req, res) {
  const empresas = await prisma.empresaVenda.findMany({
    where: { ativo: true },
    orderBy: { nome: 'asc' },
  });
  res.json(empresas);
}

async function criar(req, res) {
  const dados = empresaSchema.parse(req.body);

  const existente = await prisma.empresaVenda.findUnique({ where: { nome: dados.nome } });
  if (existente) throw new HttpError(409, 'Já existe uma empresa de vendas com esse nome.');

  const empresa = await prisma.empresaVenda.create({ data: { nome: dados.nome } });
  res.status(201).json(empresa);
}

async function editar(req, res) {
  const { id } = req.params;
  const dados = empresaSchema.partial().parse(req.body);

  const empresa = await prisma.empresaVenda.update({ where: { id }, data: dados });
  res.json(empresa);
}

async function inativar(req, res) {
  const { id } = req.params;
  await prisma.empresaVenda.update({ where: { id }, data: { ativo: false } });
  res.json({ mensagem: 'Empresa inativada com sucesso.' });
}

module.exports = { listar, criar, editar, inativar };
