const crypto = require('crypto');
const QRCode = require('qrcode');
const sharp = require('sharp');
const prisma = require('../config/prisma');
const { treinamentoSchema } = require('../utils/schemas');
const { HttpError } = require('../middleware/errorHandler');
const { uploadBuffer, getFileUrl } = require('../config/s3');

// ---- Helpers ----

// Converte uma data "YYYY-MM-DD" vinda do formulário em um Date "ancorado" ao meio-dia
// UTC. Isso evita o bug clássico de fuso horário em que salvar a data pura à meia-noite
// UTC e depois exibi-la em horário de Brasília (UTC-3) faz o dia "voltar" um dia.
function ancorarData(dataString) {
  return new Date(`${dataString}T12:00:00Z`);
}

// Reconstrói o momento exato (data + horário) de um treinamento, assumindo o horário
// informado como horário de Brasília (UTC-3), para comparações de prazo (ex: início do
// treinamento, liberação de prova). Extrai a data via getters UTC porque o valor já está
// ancorado ao meio-dia UTC (ancorarData), então isso é seguro em qualquer fuso do servidor.
function montarDataHora(dataArmazenada, horario) {
  const data = new Date(dataArmazenada);
  const ano = data.getUTCFullYear();
  const mes = String(data.getUTCMonth() + 1).padStart(2, '0');
  const dia = String(data.getUTCDate()).padStart(2, '0');
  return new Date(`${ano}-${mes}-${dia}T${horario}:00-03:00`);
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
    localTreinamento: treinamento.localTreinamento,
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

  let supervisorId = req.usuario.id;

  if (req.usuario.perfil === 'SUPERVISOR') {
    // Supervisor só pode criar treinamento de produto vinculado a ele
    const vinculado = await prisma.produtoSupervisor.findUnique({
      where: { produtoId_supervisorId: { produtoId: dados.produtoId, supervisorId: req.usuario.id } },
    });
    if (!vinculado) throw new HttpError(403, 'Você não está vinculado a este produto.');
  } else if (req.usuario.perfil === 'ADMIN' && dados.supervisorId) {
    const supervisor = await prisma.usuario.findUnique({ where: { id: dados.supervisorId } });
    if (!supervisor || supervisor.perfil !== 'SUPERVISOR' || !supervisor.ativo) {
      throw new HttpError(400, 'Supervisor indicado é inválido.');
    }
    // Mesma regra do supervisor: o admin não pode vincular um treinamento a um produto
    // que o supervisor escolhido não gerencia.
    const vinculado = await prisma.produtoSupervisor.findUnique({
      where: { produtoId_supervisorId: { produtoId: dados.produtoId, supervisorId: dados.supervisorId } },
    });
    if (!vinculado) throw new HttpError(400, 'O supervisor indicado não está vinculado a este produto.');
    supervisorId = dados.supervisorId;
  }

  if (dados.temProva && !dados.provaId) {
    throw new HttpError(400, 'Selecione uma prova ou marque que não haverá prova.');
  }

  const treinamento = await prisma.treinamento.create({
    data: {
      produtoId: dados.produtoId,
      supervisorId,
      data: ancorarData(dados.data),
      horario: dados.horario,
      tema: dados.tema,
      localTreinamento: dados.localTreinamento || null,
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

  let novoSupervisorId;
  if (req.usuario.perfil === 'ADMIN' && dados.supervisorId) {
    const supervisor = await prisma.usuario.findUnique({ where: { id: dados.supervisorId } });
    if (!supervisor || supervisor.perfil !== 'SUPERVISOR' || !supervisor.ativo) {
      throw new HttpError(400, 'Supervisor indicado é inválido.');
    }
    // Produto final = o novo produto informado (se houver) ou o produto atual do treinamento
    const produtoParaValidar = dados.produtoId || treinamento.produtoId;
    const vinculado = await prisma.produtoSupervisor.findUnique({
      where: { produtoId_supervisorId: { produtoId: produtoParaValidar, supervisorId: dados.supervisorId } },
    });
    if (!vinculado) throw new HttpError(400, 'O supervisor indicado não está vinculado a este produto.');
    novoSupervisorId = dados.supervisorId;
  } else if (dados.produtoId && req.usuario.perfil === 'ADMIN') {
    // Admin trocou só o produto, sem indicar novo supervisor: valida contra o supervisor atual do treinamento
    const vinculado = await prisma.produtoSupervisor.findUnique({
      where: { produtoId_supervisorId: { produtoId: dados.produtoId, supervisorId: treinamento.supervisorId } },
    });
    if (!vinculado) throw new HttpError(400, 'O supervisor deste treinamento não está vinculado ao produto escolhido. Indique também um supervisor compatível.');
  } else if (dados.produtoId && req.usuario.perfil === 'SUPERVISOR') {
    const vinculado = await prisma.produtoSupervisor.findUnique({
      where: { produtoId_supervisorId: { produtoId: dados.produtoId, supervisorId: req.usuario.id } },
    });
    if (!vinculado) throw new HttpError(403, 'Você não está vinculado a este produto.');
  }

  const atualizado = await prisma.treinamento.update({
    where: { id },
    data: {
      ...(dados.produtoId && { produtoId: dados.produtoId }),
      ...(novoSupervisorId && { supervisorId: novoSupervisorId }),
      ...(dados.data && { data: ancorarData(dados.data) }),
      ...(dados.horario && { horario: dados.horario }),
      ...(dados.tema && { tema: dados.tema }),
      ...(dados.localTreinamento !== undefined && { localTreinamento: dados.localTreinamento || null }),
      ...(dados.planoTreinamento && { planoTreinamento: dados.planoTreinamento }),
      ...(dados.temProva !== undefined && { temProva: dados.temProva, provaId: dados.temProva ? dados.provaId : null }),
    },
  });

  res.json(atualizado);
}

// Exclui um treinamento (Admin: qualquer um; Supervisor: apenas os que criou).
async function excluir(req, res) {
  const { id } = req.params;

  const treinamento = await prisma.treinamento.findUnique({ where: { id } });
  if (!treinamento) throw new HttpError(404, 'Treinamento não encontrado.');

  if (req.usuario.perfil === 'SUPERVISOR' && treinamento.supervisorId !== req.usuario.id) {
    throw new HttpError(403, 'Você só pode excluir treinamentos criados por você.');
  }

  await prisma.treinamento.delete({ where: { id } });
  res.json({ mensagem: 'Treinamento excluído com sucesso.' });
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
    // Compacta a imagem (redimensiona para no máximo 1600px de largura e reduz a
    // qualidade JPEG) para minimizar o espaço ocupado no bucket, sem perda visível.
    const bufferComprimido = await sharp(arquivo.buffer)
      .rotate() // corrige orientação com base no EXIF antes de remover os metadados
      .resize({ width: 1600, withoutEnlargement: true })
      .jpeg({ quality: 75, mozjpeg: true })
      .toBuffer();

    const nomeComprimido = arquivo.originalname.replace(/\.[^.]+$/, '') + '.jpg';
    const key = await uploadBuffer(bufferComprimido, nomeComprimido, 'image/jpeg', 'evidencias');
    const evidencia = await prisma.evidencia.create({
      data: {
        treinamentoId: id,
        urlArquivo: key,
        nomeArquivo: nomeComprimido,
        tipo: 'image/jpeg',
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
  excluir,
  adicionarEvidencias,
  removerEvidencia,
  demonstrarInteresse,
  cancelarInteresse,
  liberar,
  confirmarPresenca,
};
