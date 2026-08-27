const prisma = require('../config/prisma');
const { temaOficialSchema } = require('../utils/schemas');
const { HttpError } = require('../middleware/errorHandler');
const { montarDataHora } = require('../utils/datas');

// Verifica se o usuário pode gerenciar Temas Oficiais de um produto: admin pode qualquer
// um; supervisor só os produtos vinculados a ele.
async function podeGerenciarProduto(usuario, produtoId) {
  if (usuario.perfil === 'ADMIN') return true;
  if (usuario.perfil !== 'SUPERVISOR') return false;
  const vinculado = await prisma.produtoSupervisor.findUnique({
    where: { produtoId_supervisorId: { produtoId, supervisorId: usuario.id } },
  });
  return Boolean(vinculado);
}

// Lista todos os Temas Oficiais de um produto (ativos e inativos, para a tela de edição
// do Produto poder mostrar "Cadastrar", "Editar" ou "Reativar" em cada posição/insígnia).
async function listarPorProduto(req, res) {
  const { produtoId, apenasAtivos } = req.query;
  if (!produtoId) throw new HttpError(400, 'Informe produtoId.');

  const temas = await prisma.temaOficial.findMany({
    where: { produtoId, ...(apenasAtivos === 'true' && { ativo: true }) },
    include: { prova: { select: { id: true, titulo: true } } },
    orderBy: { posicao: 'asc' },
  });

  res.json(temas);
}

// Cria ou edita/reativa o Tema Oficial de uma posição (insígnia) do produto. Se já existir
// um registro naquela posição (ativo ou inativo), ele é atualizado e reativado — é assim
// que uma insígnia removida por redução de certificadosNecessarios volta ao normal quando
// o número sobe de novo, preservando o histórico associado ao seu ID.
async function salvar(req, res) {
  const dados = temaOficialSchema.parse(req.body);

  const produto = await prisma.produto.findUnique({ where: { id: dados.produtoId } });
  if (!produto) throw new HttpError(404, 'Produto não encontrado.');

  if (!(await podeGerenciarProduto(req.usuario, dados.produtoId))) {
    throw new HttpError(403, 'Você não está vinculado a este produto.');
  }

  if (dados.posicao > produto.certificadosNecessarios) {
    throw new HttpError(
      400,
      `Este produto está configurado para ${produto.certificadosNecessarios} certificado(s)/insígnia(s) necessários. Aumente esse número no cadastro do produto antes de cadastrar esta posição.`
    );
  }

  const prova = await prisma.provaModelo.findUnique({ where: { id: dados.provaId } });
  if (!prova || prova.produtoId !== dados.produtoId) {
    throw new HttpError(400, 'A prova selecionada não pertence a este produto.');
  }

  const existente = await prisma.temaOficial.findUnique({
    where: { produtoId_posicao: { produtoId: dados.produtoId, posicao: dados.posicao } },
  });

  const temaOficial = existente
    ? await prisma.temaOficial.update({
        where: { id: existente.id },
        data: {
          nome: dados.nome,
          planoTreinamento: dados.planoTreinamento,
          provaId: dados.provaId,
          ativo: true,
        },
      })
    : await prisma.temaOficial.create({ data: dados });

  // Cascateia a edição para treinamentos obrigatórios deste Tema Oficial que ainda não
  // aconteceram (não cancelados, com data/horário no futuro) — preserva o histórico dos
  // já realizados, mas mantém os agendados sempre alinhados à versão mais atual do tema.
  const pendentes = await prisma.treinamento.findMany({
    where: { temaOficialId: temaOficial.id, status: { not: 'CANCELADO' } },
    select: { id: true, data: true, horario: true },
  });
  const agora = new Date();
  const idsParaAtualizar = pendentes
    .filter((t) => montarDataHora(t.data, t.horario) > agora)
    .map((t) => t.id);

  if (idsParaAtualizar.length > 0) {
    await prisma.treinamento.updateMany({
      where: { id: { in: idsParaAtualizar } },
      data: {
        tema: temaOficial.nome,
        planoTreinamento: temaOficial.planoTreinamento,
        provaId: temaOficial.provaId,
        temProva: true,
      },
    });
  }

  res.json(temaOficial);
}

module.exports = { listarPorProduto, salvar };
