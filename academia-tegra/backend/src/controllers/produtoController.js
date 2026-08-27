const prisma = require('../config/prisma');
const { produtoSchema } = require('../utils/schemas');
const { HttpError } = require('../middleware/errorHandler');

async function vinculadoAoSupervisor(supervisorId, produtoId) {
  const vinculo = await prisma.produtoSupervisor.findUnique({
    where: { produtoId_supervisorId: { produtoId, supervisorId } },
  });
  return Boolean(vinculo);
}

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

// Só Admin cria produto novo.
async function criar(req, res) {
  const dados = produtoSchema.parse(req.body);
  const produto = await prisma.produto.create({ data: dados });
  res.status(201).json(produto);
}

// Admin pode editar qualquer produto; Supervisor só os vinculados a ele. Se
// certificadosNecessarios diminuir, os Temas Oficiais (insígnias) de posição além do novo
// valor são inativados automaticamente (o histórico continua existindo, só saem do cálculo
// de aptidão e da carteirinha) — voltam a ficar disponíveis para reativação se o número
// subir de novo.
async function editar(req, res) {
  const { id } = req.params;
  const dados = produtoSchema.partial().parse(req.body);

  const produtoAtual = await prisma.produto.findUnique({ where: { id } });
  if (!produtoAtual) throw new HttpError(404, 'Produto não encontrado.');

  if (req.usuario.perfil === 'SUPERVISOR') {
    if (!(await vinculadoAoSupervisor(req.usuario.id, id))) {
      throw new HttpError(403, 'Você não está vinculado a este produto.');
    }
  } else if (req.usuario.perfil !== 'ADMIN') {
    throw new HttpError(403, 'Você não tem permissão para esta ação.');
  }

  const produto = await prisma.produto.update({ where: { id }, data: dados });

  if (
    dados.certificadosNecessarios !== undefined &&
    dados.certificadosNecessarios < produtoAtual.certificadosNecessarios
  ) {
    await prisma.temaOficial.updateMany({
      where: { produtoId: id, posicao: { gt: dados.certificadosNecessarios } },
      data: { ativo: false },
    });
  }

  res.json(produto);
}

// Só Admin inativa produto.
async function inativar(req, res) {
  const { id } = req.params;
  await prisma.produto.update({ where: { id }, data: { ativo: false } });
  res.json({ mensagem: 'Produto inativado com sucesso.' });
}

module.exports = { listar, criar, editar, inativar };
