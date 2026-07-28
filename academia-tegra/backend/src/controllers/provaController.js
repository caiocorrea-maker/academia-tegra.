const prisma = require('../config/prisma');
const { provaModeloSchema, responderProvaSchema } = require('../utils/schemas');
const { HttpError } = require('../middleware/errorHandler');
const { gerarCertificadoParaTentativa } = require('../services/certificadoService');

// ---- Banco de provas reutilizáveis ----
// Disponível para reuso em qualquer treinamento do MESMO produto, independente de quem criou.

async function listarModelos(req, res) {
  const { produtoId } = req.query;
  const provas = await prisma.provaModelo.findMany({
    where: { ...(produtoId && { produtoId }) },
    include: { produto: { select: { nome: true } }, _count: { select: { questoes: true } } },
    orderBy: { titulo: 'asc' },
  });
  res.json(provas);
}

async function detalharModelo(req, res) {
  const { id } = req.params;
  const prova = await prisma.provaModelo.findUnique({
    where: { id },
    include: { questoes: { include: { alternativas: true }, orderBy: { ordem: 'asc' } } },
  });
  if (!prova) throw new HttpError(404, 'Prova não encontrada.');
  res.json(prova);
}

async function criarModelo(req, res) {
  const dados = provaModeloSchema.parse(req.body);

  if (req.usuario.perfil === 'SUPERVISOR') {
    const vinculado = await prisma.produtoSupervisor.findUnique({
      where: { produtoId_supervisorId: { produtoId: dados.produtoId, supervisorId: req.usuario.id } },
    });
    if (!vinculado) throw new HttpError(403, 'Você não está vinculado a este produto.');
  }

  const prova = await prisma.provaModelo.create({
    data: {
      titulo: dados.titulo,
      produtoId: dados.produtoId,
      criadoPorId: req.usuario.id,
      questoes: {
        create: dados.questoes.map((q, i) => ({
          enunciado: q.enunciado,
          ordem: i + 1,
          alternativas: {
            create: q.alternativas.map((a, j) => ({ texto: a.texto, correta: a.correta, ordem: j + 1 })),
          },
        })),
      },
    },
    include: { questoes: { include: { alternativas: true } } },
  });

  res.status(201).json(prova);
}

// ---- Realização da prova pelo corretor ----

async function iniciar(req, res) {
  const { treinamentoId } = req.params;

  const treinamento = await prisma.treinamento.findUnique({
    where: { id: treinamentoId },
    include: { prova: { include: { questoes: { include: { alternativas: true }, orderBy: { ordem: 'asc' } } } } },
  });
  if (!treinamento || !treinamento.temProva || !treinamento.prova) {
    throw new HttpError(400, 'Este treinamento não possui prova.');
  }

  if (!treinamento.qrToken || !treinamento.liberadoExpiraEm) {
    throw new HttpError(400, 'A prova ainda não foi liberada pelo supervisor.');
  }
  if (new Date() > treinamento.liberadoExpiraEm) {
    throw new HttpError(400, 'O prazo de 1 hora para realizar a prova expirou.');
  }

  const existente = await prisma.tentativaProva.findUnique({
    where: { treinamentoId_corretorId: { treinamentoId, corretorId: req.usuario.id } },
  });
  if (existente && existente.status === 'CONCLUIDA') {
    throw new HttpError(409, 'Você já concluiu esta prova.');
  }

  const tentativa = existente
    ? existente
    : await prisma.tentativaProva.create({ data: { treinamentoId, corretorId: req.usuario.id } });

  // Não envia o gabarito
  const questoesSemGabarito = treinamento.prova.questoes.map((q) => ({
    id: q.id,
    enunciado: q.enunciado,
    alternativas: q.alternativas.map(({ id, texto }) => ({ id, texto })),
  }));

  res.json({
    tentativaId: tentativa.id,
    treinamento: { id: treinamento.id, tema: treinamento.tema },
    prazoFinal: treinamento.liberadoExpiraEm,
    questoes: questoesSemGabarito,
  });
}

async function responder(req, res) {
  const { treinamentoId } = req.params;
  const { respostas } = responderProvaSchema.parse(req.body);

  const treinamento = await prisma.treinamento.findUnique({
    where: { id: treinamentoId },
    include: { prova: { include: { questoes: { include: { alternativas: true } } } } },
  });
  if (!treinamento || !treinamento.prova) throw new HttpError(400, 'Prova não encontrada para este treinamento.');
  if (!treinamento.liberadoExpiraEm || new Date() > treinamento.liberadoExpiraEm) {
    throw new HttpError(400, 'O prazo para responder a prova expirou.');
  }

  const tentativa = await prisma.tentativaProva.findUnique({
    where: { treinamentoId_corretorId: { treinamentoId, corretorId: req.usuario.id } },
  });
  if (!tentativa) throw new HttpError(400, 'Inicie a prova antes de enviar as respostas.');
  if (tentativa.status === 'CONCLUIDA') throw new HttpError(409, 'Esta prova já foi concluída.');

  // Correção automática
  const totalQuestoes = treinamento.prova.questoes.length;
  let acertos = 0;
  for (const q of treinamento.prova.questoes) {
    const respostaCorretor = respostas.find((r) => r.questaoId === q.id);
    const alternativaCorreta = q.alternativas.find((a) => a.correta);
    if (respostaCorretor && alternativaCorreta && respostaCorretor.alternativaId === alternativaCorreta.id) {
      acertos++;
    }
  }
  const percentual = (acertos / totalQuestoes) * 100;
  const aprovado = percentual >= 70;

  await prisma.$transaction([
    prisma.resposta.deleteMany({ where: { tentativaId: tentativa.id } }),
    prisma.resposta.createMany({
      data: respostas.map((r) => ({ tentativaId: tentativa.id, questaoId: r.questaoId, alternativaId: r.alternativaId })),
    }),
    prisma.tentativaProva.update({
      where: { id: tentativa.id },
      data: { status: 'CONCLUIDA', concluidoEm: new Date(), acertos, totalQuestoes, percentual, aprovado },
    }),
  ]);

  let certificado = null;
  if (aprovado) {
    certificado = await gerarCertificadoParaTentativa({
      treinamentoId,
      corretorId: req.usuario.id,
      percentual,
    });
  }

  res.json({ acertos, totalQuestoes, percentual, aprovado, certificadoGerado: Boolean(certificado) });
}

module.exports = { listarModelos, detalharModelo, criarModelo, iniciar, responder };
