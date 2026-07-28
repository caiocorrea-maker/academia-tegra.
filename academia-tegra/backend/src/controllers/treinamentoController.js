const crypto = require('crypto');
const QRCode = require('qrcode');
const prisma = require('../config/prisma');
const { treinamentoSchema } = require('../utils/schemas');
const { HttpError } = require('../middleware/errorHandler');
const { uploadBuffer, getFileUrl } = require('../config/s3');

// ---- Helpers ----

function montarDataHora(dataISO, horario) {
  const [h, m] = horario.split(':').map(Number);
  const data = new Date(dataISO);
  data.setHours(h, m, 0, 0);
  return data;
}

async function contarMetricas(treinamentoId) {
  const [interessados, presencasSemProva, tentativasConcluidas] = await Promise.all([
    prisma.interesseTreinamento.count({ where: { treinamentoId, cancelado: false } }),
    prisma.presenca.count({ where: { treinamentoId } }),
    prisma.tentativaProva.findMany({ where: { treinamentoId, status: 'CONCLUIDA' } }),
  ]);

  const presentes = presencasSemProva + tentativasConcluidas.length;
  const aprovados = tentativasConcluidas.filter((t) => t.aprovado).length;

  return { interessados, presentes, aprovados };
}

// ---- Agenda / Listagem ----

// Lista treinamentos em um intervalo (para o calendário mensal)
async function listarAgenda(req, res) {
  const { inicio, fim } = req.query;
  if (!inicio || !fim) throw new HttpError(400, 'Informe "inicio" e "fim" (datas ISO).');

  const treinamentos = await prisma.treinamento.findMany({
    where: {
      data: { gte: new Date(inicio), lte: new Date(fim) },
      status: { not: 'CANCELADO' },
    },
    include: {
      produto: { select: { id: true, nome: true, corCalendario: true } },
      supervisor: { select: { id: true, nome: true } },
      interesses: { where: { cancelado: false }, select: { id: true } },
    },
    orderBy: { data: 'asc' },
  });

  res.json(
    treinamentos.map((t) => ({
      id: t.id,
      produto: t.produto,
      supervisor: t.supervisor,
      data: t.data,
      horario: t.horario,
      tema: t.tema,
      qtdInteressados: t.interesses.length,
    }))
  );
}

// Histórico com filtros (produto, supervisor, período)
async function listarHistorico(req, res) {
  const { produtoId, supervisorId, dataInicio, dataFim } = req.query;

  const treinamentos = await prisma.treinamento.findMany({
    where: {
      ...(produtoId && { produtoId }),
      ...(supervisorId && { supervisorId }),
      ...(dataInicio || dataFim
        ? { data: { ...(dataInicio && { gte: new Date(dataInicio) }), ...(dataFim && { lte: new Date(dataFim) }) } }
        : {}),
    },
    include: {
      produto: { select: { nome: true, corCalendario: true } },
      supervisor: { select: { nome: true } },
    },
    orderBy: { data: 'desc' },
  });

  const comMetricas = await Promise.all(
    treinamentos.map(async (t) => ({
      id: t.id,
      produto: t.produto.nome,
      cor: t.produto.corCalendario,
      supervisor: t.supervisor.nome,
      tema: t.tema,
      data: t.data,
      horario: t.horario,
      status: t.status,
      ...(await contarMetricas(t.id)),
    }))
  );

  res.json(comMetricas);
}

// Detalhe completo de um treinamento (para o modal)
async function detalhar(req, res) {
  const { id } = req.params;

  const treinamento = await prisma.treinamento.findUnique({
    where: { id },
    include: {
      produto: true,
      supervisor: { select: { id: true, nome: true } },
      evidencias: true,
      prova: { include: { questoes: { include: { alternativas: true }, orderBy: { ordem: 'asc' } } } },
      interesses: { where: { cancelado: false }, include: { corretor: { select: { id: true, nome: true } } } },
    },
  });
  if (!treinamento) throw new HttpError(404, 'Treinamento não encontrado.');

  const metricas = await contarMetricas(id);

  // Corretor não deve ver o gabarito (alternativa correta) antes/durante a prova
  let prova = treinamento.prova;
  if (prova && req.usuario.perfil === 'CORRETOR') {
    prova = {
      ...prova,
      questoes: prova.questoes.map((q) => ({
        ...q,
        alternativas: q.alternativas.map(({ correta, ...alt }) => alt),
      })),
    };
  }

  const meuInteresse = req.usuario.perfil === 'CORRETOR'
    ? treinamento.interesses.some((i) => i.corretor.id === req.usuario.id)
    : undefined;

  res.json({
    id: treinamento.id,
    produto: treinamento.produto,
    supervisor: treinamento.supervisor,
    tema: treinamento.tema,
    planoTreinamento: treinamento.planoTreinamento,
    data: treinamento.data,
    horario: treinamento.horario,
    status: treinamento.status,
    temProva: treinamento.temProva,
    prova,
    evidencias: treinamento.evidencias,
    liberadoEm: treinamento.liberadoEm,
    liberadoExpiraEm: treinamento.liberadoExpiraEm,
    qtdInteressados: metricas.interessados,
    presentes: metricas.presentes,
    aprovados: metricas.aprovados,
    meuInteresse,
  });
}

// ---- CRUD ----

async function criar(req, res) {
  const dados = treinamentoSchema.parse(req.body);

  // Supervisor só pode criar treinamento de produto vinculado a ele
  if (req.usuario.perfil === 'SUPERVISOR') {
    const vinculado = await prisma.produtoSupervisor.findUnique({
      where: { produtoId_supervisorId: { produtoId: dados.produtoId, supervisorId: req.usuario.id } },
    });
    if (!vinculado) throw new HttpError(403, 'Você não está vinculado a este produto.');
  }

  if (dados.temProva && !dados.provaId) {
    throw new HttpError(400, 'Selecione uma prova ou marque que não haverá prova.');
  }

  const treinamento = await prisma.treinamento.create({
    data: {
      produtoId: dados.produtoId,
      supervisorId: req.usuario.perfil === 'SUPERVISOR' ? req.usuario.id : req.body.supervisorId || req.usuario.id,
      data: new Date(dados.data),
      horario: dados.horario,
      tema: dados.tema,
      planoTreinamento: dados.planoTreinamento,
      temProva: dados.temProva,
      provaId: dados.temProva ? dados.provaId : null,
    },
  });

  res.status(201).json(treinamento);
}

async function editar(req, res) {
  const { id } = req.params;
  const dados = treinamentoSchema.partial().parse(req.body);

  const treinamento = await prisma.treinamento.findUnique({ where: { id } });
  if (!treinamento) throw new HttpError(404, 'Treinamento não encontrado.');

  if (req.usuario.perfil === 'SUPERVISOR' && treinamento.supervisorId !== req.usuario.id) {
    throw new HttpError(403, 'Você só pode editar treinamentos criados por você.');
  }

  const atualizado = await prisma.treinamento.update({
    where: { id },
    data: {
      ...(dados.produtoId && { produtoId: dados.produtoId }),
      ...(dados.data && { data: new Date(dados.data) }),
      ...(dados.horario && { horario: dados.horario }),
      ...(dados.tema && { tema: dados.tema }),
      ...(dados.planoTreinamento && { planoTreinamento: dados.planoTreinamento }),
      ...(dados.temProva !== undefined && { temProva: dados.temProva, provaId: dados.temProva ? dados.provaId : null }),
    },
  });

  res.json(atualizado);
}

// ---- Evidências (anexadas depois, como edição) ----

async function adicionarEvidencias(req, res) {
  const { id } = req.params;
  const arquivos = req.files || [];
  if (arquivos.length === 0) throw new HttpError(400, 'Nenhum arquivo enviado.');

  const treinamento = await prisma.treinamento.findUnique({ where: { id } });
  if (!treinamento) throw new HttpError(404, 'Treinamento não encontrado.');

  const evidenciasCriadas = [];
  for (const arquivo of arquivos) {
    const key = await uploadBuffer(arquivo.buffer, arquivo.originalname, arquivo.mimetype, 'evidencias');
    const evidencia = await prisma.evidencia.create({
      data: {
        treinamentoId: id,
        urlArquivo: key,
        nomeArquivo: arquivo.originalname,
        tipo: arquivo.mimetype,
      },
    });
    evidenciasCriadas.push(evidencia);
  }

  res.status(201).json(evidenciasCriadas);
}

async function removerEvidencia(req, res) {
  const { evidenciaId } = req.params;
  await prisma.evidencia.delete({ where: { id: evidenciaId } });
  res.json({ mensagem: 'Evidência removida.' });
}

// ---- Interesse do corretor ----

async function demonstrarInteresse(req, res) {
  const { id } = req.params;

  const treinamento = await prisma.treinamento.findUnique({ where: { id } });
  if (!treinamento) throw new HttpError(404, 'Treinamento não encontrado.');

  const dataHoraTreinamento = montarDataHora(treinamento.data, treinamento.horario);
  if (new Date() >= dataHoraTreinamento) {
    throw new HttpError(400, 'Não é mais possível demonstrar interesse: o treinamento já começou.');
  }

  const existente = await prisma.interesseTreinamento.findUnique({
    where: { treinamentoId_corretorId: { treinamentoId: id, corretorId: req.usuario.id } },
  });

  if (existente) {
    if (!existente.cancelado) throw new HttpError(409, 'Você já demonstrou interesse neste treinamento.');
    const atualizado = await prisma.interesseTreinamento.update({
      where: { id: existente.id },
      data: { cancelado: false },
    });
    return res.json(atualizado);
  }

  const interesse = await prisma.interesseTreinamento.create({
    data: { treinamentoId: id, corretorId: req.usuario.id },
  });
  res.status(201).json(interesse);
}

async function cancelarInteresse(req, res) {
  const { id } = req.params;

  const treinamento = await prisma.treinamento.findUnique({ where: { id } });
  if (!treinamento) throw new HttpError(404, 'Treinamento não encontrado.');

  const dataHoraTreinamento = montarDataHora(treinamento.data, treinamento.horario);
  if (new Date() >= dataHoraTreinamento) {
    throw new HttpError(400, 'Não é mais possível cancelar: o treinamento já começou.');
  }

  await prisma.interesseTreinamento.update({
    where: { treinamentoId_corretorId: { treinamentoId: id, corretorId: req.usuario.id } },
    data: { cancelado: true },
  });
  res.json({ mensagem: 'Interesse cancelado.' });
}

// ---- Liberação de prova / QR de presença (válido por 1h) ----

async function liberar(req, res) {
  const { id } = req.params;

  const treinamento = await prisma.treinamento.findUnique({ where: { id } });
  if (!treinamento) throw new HttpError(404, 'Treinamento não encontrado.');

  if (req.usuario.perfil === 'SUPERVISOR' && treinamento.supervisorId !== req.usuario.id) {
    throw new HttpError(403, 'Você só pode liberar treinamentos criados por você.');
  }

  const qrToken = crypto.randomBytes(16).toString('hex');
  const liberadoEm = new Date();
  const liberadoExpiraEm = new Date(liberadoEm.getTime() + 60 * 60 * 1000); // 1h

  await prisma.treinamento.update({
    where: { id },
    data: { qrToken, liberadoEm, liberadoExpiraEm },
  });

  const destino = treinamento.temProva
    ? `${process.env.FRONTEND_URL}/prova/${id}?token=${qrToken}`
    : `${process.env.FRONTEND_URL}/presenca/${id}?token=${qrToken}`;

  const qrCodeDataUrl = await QRCode.toDataURL(destino);

  res.json({ link: destino, qrCodeDataUrl, liberadoEm, liberadoExpiraEm });
}

// Confirmação de presença via QR/link quando NÃO há prova
async function confirmarPresenca(req, res) {
  const { id } = req.params;
  const { token } = req.body;

  const treinamento = await prisma.treinamento.findUnique({ where: { id } });
  if (!treinamento) throw new HttpError(404, 'Treinamento não encontrado.');
  if (treinamento.temProva) throw new HttpError(400, 'Este treinamento possui prova; a presença é confirmada ao concluí-la.');
  if (!treinamento.qrToken || treinamento.qrToken !== token) throw new HttpError(400, 'Link/QR inválido.');
  if (!treinamento.liberadoExpiraEm || new Date() > treinamento.liberadoExpiraEm) {
    throw new HttpError(400, 'O prazo de confirmação de presença (1h) expirou.');
  }

  const presenca = await prisma.presenca.upsert({
    where: { treinamentoId_corretorId: { treinamentoId: id, corretorId: req.usuario.id } },
    update: {},
    create: { treinamentoId: id, corretorId: req.usuario.id },
  });

  res.status(201).json(presenca);
}

module.exports = {
  listarAgenda,
  listarHistorico,
  detalhar,
  criar,
  editar,
  adicionarEvidencias,
  removerEvidencia,
  demonstrarInteresse,
  cancelarInteresse,
  liberar,
  confirmarPresenca,
};
