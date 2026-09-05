const prisma = require('../config/prisma');
const { avaliacaoNpsSchema } = require('../utils/schemas');
const { HttpError } = require('../middleware/errorHandler');

// Um treinamento fica "elegível para avaliação" pelo corretor assim que ele conclui a parte
// que encerra o treinamento pra ele: presença confirmada (se não tiver prova), ou a prova
// concluída (se tiver) — aprovado OU reprovado, os dois liberam a avaliação, já que a
// experiência do treinamento em si já terminou pra ele.
async function elegivelParaAvaliar(treinamentoId, corretorId) {
  const treinamento = await prisma.treinamento.findUnique({
    where: { id: treinamentoId },
    select: { temProva: true },
  });
  if (!treinamento) return false;

  if (treinamento.temProva) {
    const concluida = await prisma.tentativaProva.findFirst({
      where: { treinamentoId, corretorId, status: 'CONCLUIDA' },
    });
    return Boolean(concluida);
  }

  const presenca = await prisma.presenca.findUnique({
    where: { treinamentoId_corretorId: { treinamentoId, corretorId } },
  });
  return Boolean(presenca);
}

// Lista os treinamentos que o corretor logado já pode avaliar e ainda não avaliou — usada
// pra disparar o formulário de NPS automaticamente (ex: ao abrir a Agenda). Treinamentos já
// adiados 2 vezes ("responder depois") saem dessa lista (mas continuam acessíveis pelo link
// do convite por e-mail, em consultarPorLink).
async function listarPendentes(req, res) {
  const corretorId = req.usuario.id;

  const [presencasSemProva, tentativasConcluidas, jaAvaliados, adiados2x] = await Promise.all([
    prisma.presenca.findMany({
      where: { corretorId, treinamento: { temProva: false } },
      select: { treinamentoId: true },
    }),
    prisma.tentativaProva.findMany({
      where: { corretorId, status: 'CONCLUIDA', treinamento: { temProva: true } },
      select: { treinamentoId: true },
    }),
    prisma.avaliacaoNps.findMany({ where: { corretorId }, select: { treinamentoId: true } }),
    prisma.avaliacaoNpsAdiamento.findMany({ where: { corretorId, vezes: { gte: 2 } }, select: { treinamentoId: true } }),
  ]);

  const excluirSet = new Set([...jaAvaliados, ...adiados2x].map((a) => a.treinamentoId));
  const elegiveisIds = [...new Set([...presencasSemProva, ...tentativasConcluidas].map((x) => x.treinamentoId))].filter(
    (id) => !excluirSet.has(id)
  );

  if (elegiveisIds.length === 0) return res.json([]);

  const treinamentos = await prisma.treinamento.findMany({
    where: { id: { in: elegiveisIds } },
    select: { id: true, tema: true, data: true, produto: { select: { nome: true, corCalendario: true } } },
    orderBy: { data: 'desc' },
  });

  res.json(treinamentos);
}

// Corretor envia sua avaliação de um treinamento (uma vez só).
async function enviar(req, res) {
  const { treinamentoId } = req.params;
  const corretorId = req.usuario.id;
  const dados = avaliacaoNpsSchema.parse(req.body);

  const jaAvaliou = await prisma.avaliacaoNps.findUnique({
    where: { treinamentoId_corretorId: { treinamentoId, corretorId } },
  });
  if (jaAvaliou) throw new HttpError(400, 'Você já avaliou este treinamento.');

  const elegivel = await elegivelParaAvaliar(treinamentoId, corretorId);
  if (!elegivel) {
    throw new HttpError(400, 'Você só pode avaliar um treinamento depois de ter presença confirmada (ou ser aprovado na prova, se houver).');
  }

  const avaliacao = await prisma.avaliacaoNps.create({
    data: { treinamentoId, corretorId, ...dados },
  });

  res.status(201).json(avaliacao);
}

async function checarPermissaoProduto(req, produtoId) {
  if (req.usuario.perfil !== 'SUPERVISOR') return true;
  const vinculo = await prisma.produtoSupervisor.findUnique({
    where: { produtoId_supervisorId: { produtoId, supervisorId: req.usuario.id } },
  });
  return Boolean(vinculo);
}

// Respostas individuais (com texto livre) de um treinamento específico — Admin, ou
// Supervisor vinculado ao produto daquele treinamento.
async function listarPorTreinamento(req, res) {
  const { id } = req.params;

  const treinamento = await prisma.treinamento.findUnique({
    where: { id },
    select: { id: true, tema: true, data: true, produtoId: true, produto: { select: { nome: true } } },
  });
  if (!treinamento) throw new HttpError(404, 'Treinamento não encontrado.');
  if (!(await checarPermissaoProduto(req, treinamento.produtoId))) {
    throw new HttpError(403, 'Você não tem acesso às avaliações deste produto.');
  }

  const respostas = await prisma.avaliacaoNps.findMany({
    where: { treinamentoId: id },
    include: { corretor: { select: { nome: true } } },
    orderBy: { criadoEm: 'desc' },
  });

  const medias = calcularMedias(respostas);

  res.json({
    treinamento: { id: treinamento.id, tema: treinamento.tema, data: treinamento.data, produto: treinamento.produto.nome },
    medias,
    respostas: respostas.map((r) => ({
      id: r.id,
      corretor: r.corretor.nome,
      notaMaterial: r.notaMaterial,
      notaSupervisor: r.notaSupervisor,
      notaSatisfacao: r.notaSatisfacao,
      pontosPositivos: r.pontosPositivos,
      pontosMelhorar: r.pontosMelhorar,
      criadoEm: r.criadoEm,
    })),
  });
}

function calcularMedias(respostas) {
  if (respostas.length === 0) return { notaMaterial: null, notaSupervisor: null, notaSatisfacao: null, qtd: 0 };
  const soma = respostas.reduce(
    (acc, r) => ({
      material: acc.material + r.notaMaterial,
      supervisor: acc.supervisor + r.notaSupervisor,
      satisfacao: acc.satisfacao + r.notaSatisfacao,
    }),
    { material: 0, supervisor: 0, satisfacao: 0 }
  );
  const qtd = respostas.length;
  return {
    notaMaterial: soma.material / qtd,
    notaSupervisor: soma.supervisor / qtd,
    notaSatisfacao: soma.satisfacao / qtd,
    qtd,
  };
}

// Resumo por treinamento (Admin vê tudo; Supervisor só os produtos vinculados a ele) — uma
// linha por treinamento com a quantidade de respostas e as médias, sem o texto livre (esse
// só aparece ao abrir um treinamento específico, em listarPorTreinamento).
async function listarResumo(req, res) {
  const { produtoId, supervisorId, dataInicio, dataFim } = req.query;

  let produtoIdFiltro = produtoId ? { produtoId } : {};
  if (req.usuario.perfil === 'SUPERVISOR') {
    if (produtoId) {
      if (!(await checarPermissaoProduto(req, produtoId))) {
        throw new HttpError(403, 'Você não tem acesso às avaliações deste produto.');
      }
    } else {
      const vinculos = await prisma.produtoSupervisor.findMany({
        where: { supervisorId: req.usuario.id },
        select: { produtoId: true },
      });
      produtoIdFiltro = { produtoId: { in: vinculos.map((v) => v.produtoId) } };
    }
  }

  const treinamentos = await prisma.treinamento.findMany({
    where: {
      ...produtoIdFiltro,
      ...(supervisorId && { supervisorId }),
      ...(dataInicio || dataFim
        ? { data: { ...(dataInicio && { gte: new Date(dataInicio) }), ...(dataFim && { lte: new Date(dataFim) }) } }
        : {}),
      avaliacoesNps: { some: {} }, // só treinamentos com pelo menos 1 resposta
    },
    select: {
      id: true,
      tema: true,
      data: true,
      produto: { select: { nome: true, corCalendario: true } },
      avaliacoesNps: { select: { notaMaterial: true, notaSupervisor: true, notaSatisfacao: true } },
    },
    orderBy: { data: 'desc' },
  });

  res.json(
    treinamentos.map((t) => ({
      id: t.id,
      tema: t.tema,
      data: t.data,
      produto: t.produto.nome,
      cor: t.produto.corCalendario,
      ...calcularMedias(t.avaliacoesNps),
    }))
  );
}

// Registra um "responder depois" (soma 1 na contagem de adiamentos daquele corretor para
// aquele treinamento). Ao chegar em 2, some da lista de pendentes automática.
async function adiar(req, res) {
  const { treinamentoId } = req.params;
  const corretorId = req.usuario.id;

  const adiamento = await prisma.avaliacaoNpsAdiamento.upsert({
    where: { treinamentoId_corretorId: { treinamentoId, corretorId } },
    update: { vezes: { increment: 1 } },
    create: { treinamentoId, corretorId, vezes: 1 },
  });

  res.json({ vezes: adiamento.vezes });
}

// Usado pelo link do convite por e-mail: traz o treinamento pra avaliação mesmo que ele já
// tenha sido adiado 2 vezes na lista automática (o corretor pediu explicitamente, clicando
// no link do e-mail).
async function consultarPorLink(req, res) {
  const { treinamentoId } = req.params;
  const corretorId = req.usuario.id;

  const jaAvaliou = await prisma.avaliacaoNps.findUnique({
    where: { treinamentoId_corretorId: { treinamentoId, corretorId } },
  });
  if (jaAvaliou) return res.json(null);

  const elegivel = await elegivelParaAvaliar(treinamentoId, corretorId);
  if (!elegivel) return res.json(null);

  const treinamento = await prisma.treinamento.findUnique({
    where: { id: treinamentoId },
    select: { id: true, tema: true, data: true, produto: { select: { nome: true, corCalendario: true } } },
  });
  res.json(treinamento);
}

module.exports = { listarPendentes, enviar, adiar, consultarPorLink, listarPorTreinamento, listarResumo };
