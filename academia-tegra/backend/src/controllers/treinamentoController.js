const sharp = require('sharp');
const prisma = require('../config/prisma');
const { treinamentoSchema } = require('../utils/schemas');
const { HttpError } = require('../middleware/errorHandler');
const { uploadBuffer, getFileUrl } = require('../config/s3');
const { ancorarData, montarDataHora, diaJaPassou } = require('../utils/datas');

// ---- Helpers ----

async function contarMetricas(treinamentoId) {
  // Presença agora é sempre confirmada manualmente pelo supervisor/admin (independe de
  // haver prova ou não). Aprovados continua vindo das tentativas de prova concluídas.
  const [interessados, presentes, aprovados] = await Promise.all([
    prisma.interesseTreinamento.count({ where: { treinamentoId, cancelado: false } }),
    prisma.presenca.count({ where: { treinamentoId } }),
    prisma.tentativaProva.count({ where: { treinamentoId, status: 'CONCLUIDA', aprovado: true } }),
  ]);

  // Taxa de presença = presentes / interessados. Taxa de aprovação = aprovados / presentes.
  const taxaPresenca = interessados > 0 ? Math.round((presentes / interessados) * 100) : null;
  const taxaAprovacao = presentes > 0 ? Math.round((aprovados / presentes) * 100) : null;

  return { interessados, presentes, aprovados, taxaPresenca, taxaAprovacao };
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
      interesses: { where: { cancelado: false }, select: { id: true, corretorId: true } },
    },
    // Dentro de cada dia: por horário (mais cedo primeiro) e, havendo empate no mesmo
    // horário, pela ordem de cadastro (o criado primeiro aparece primeiro).
    orderBy: [{ data: 'asc' }, { horario: 'asc' }, { criadoEm: 'asc' }],
  });

  res.json(
    treinamentos.map((t) => ({
      id: t.id,
      produto: t.produto,
      supervisor: t.supervisor,
      data: t.data,
      horario: t.horario,
      tema: t.tema,
      obrigatorio: t.obrigatorio,
      qtdInteressados: t.interesses.length,
      // Só relevante para o perfil CORRETOR (filtro "Meus treinamentos" na Agenda): indica
      // se o próprio usuário logado demonstrou interesse (e não cancelou) neste treinamento.
      ...(req.usuario.perfil === 'CORRETOR' && {
        meuInteresse: t.interesses.some((i) => i.corretorId === req.usuario.id),
      }),
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
      obrigatorio: t.obrigatorio,
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
      temaOficial: { select: { id: true, nome: true, posicao: true, ativo: true } },
      interesses: { where: { cancelado: false }, include: { corretor: { select: { id: true, nome: true } } } },
      presencas: { select: { corretorId: true } },
      tentativasProva: {
        where: { status: 'CONCLUIDA' },
        select: { corretorId: true, aprovado: true, percentual: true },
      },
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

  const presencaIds = new Set(treinamento.presencas.map((p) => p.corretorId));
  const tentativasMap = new Map(treinamento.tentativasProva.map((t) => [t.corretorId, t]));

  let meuInteresse, minhaPresencaConfirmada, minhaTentativa, interessados;

  if (req.usuario.perfil === 'CORRETOR') {
    meuInteresse = treinamento.interesses.some((i) => i.corretor.id === req.usuario.id);
    minhaPresencaConfirmada = presencaIds.has(req.usuario.id);
    minhaTentativa = tentativasMap.get(req.usuario.id) || null;
  } else {
    // Admin/Supervisor: lista de interessados com status de presença e prova, para
    // confirmar presença manualmente e acompanhar o resultado da prova.
    interessados = treinamento.interesses.map((i) => ({
      id: i.corretor.id,
      nome: i.corretor.nome,
      presencaConfirmada: presencaIds.has(i.corretor.id),
      tentativa: tentativasMap.get(i.corretor.id) || null,
    }));
  }

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
    obrigatorio: treinamento.obrigatorio,
    temaOficial: treinamento.temaOficial,
    evidencias: treinamento.evidencias,
    liberadoEm: treinamento.liberadoEm,
    liberadoExpiraEm: treinamento.liberadoExpiraEm,
    qtdInteressados: metricas.interessados,
    presentes: metricas.presentes,
    aprovados: metricas.aprovados,
    meuInteresse,
    minhaPresencaConfirmada,
    minhaTentativa,
    interessados,
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

  // Treinamento obrigatório: precisa de um Tema Oficial ativo do mesmo produto. Os campos
  // tema/planoTreinamento/provaId/temProva vêm sempre do cadastro do Tema Oficial (o que o
  // cliente mandar nesses campos é ignorado) — só localTreinamento/data/horário são livres.
  let dadosFinais = dados;
  if (dados.obrigatorio) {
    if (!dados.temaOficialId) {
      throw new HttpError(400, 'Selecione qual Treinamento Oficial (insígnia) este treinamento representa.');
    }
    const temaOficial = await prisma.temaOficial.findUnique({ where: { id: dados.temaOficialId } });
    if (!temaOficial || !temaOficial.ativo || temaOficial.produtoId !== dados.produtoId) {
      throw new HttpError(400, 'Treinamento Oficial inválido para este produto.');
    }
    dadosFinais = {
      ...dados,
      tema: temaOficial.nome,
      planoTreinamento: temaOficial.planoTreinamento,
      temProva: true,
      provaId: temaOficial.provaId,
    };
  } else {
    dadosFinais = { ...dados, obrigatorio: false, temaOficialId: null };
  }

  if (dadosFinais.temProva && !dadosFinais.provaId) {
    throw new HttpError(400, 'Selecione uma prova ou marque que não haverá prova.');
  }

  const treinamento = await prisma.treinamento.create({
    data: {
      produtoId: dadosFinais.produtoId,
      supervisorId,
      data: ancorarData(dadosFinais.data),
      horario: dadosFinais.horario,
      tema: dadosFinais.tema,
      localTreinamento: dadosFinais.localTreinamento || null,
      planoTreinamento: dadosFinais.planoTreinamento,
      temProva: dadosFinais.temProva,
      provaId: dadosFinais.temProva ? dadosFinais.provaId : null,
      obrigatorio: dadosFinais.obrigatorio,
      temaOficialId: dadosFinais.obrigatorio ? dadosFinais.temaOficialId : null,
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

  // Treinamento obrigatório: tema/plano/prova/produto vêm travados do Tema Oficial e não
  // podem ser alterados aqui (o que o cliente enviar nesses campos é ignorado) — só
  // local/data/horário e o supervisor responsável (Admin) continuam editáveis. Para trocar
  // o Tema Oficial vinculado, é preciso excluir e criar um novo treinamento.
  if (treinamento.obrigatorio) {
    const atualizado = await prisma.treinamento.update({
      where: { id },
      data: {
        ...(dados.data && { data: ancorarData(dados.data) }),
        ...(dados.horario && { horario: dados.horario }),
        ...(dados.localTreinamento !== undefined && { localTreinamento: dados.localTreinamento || null }),
      },
    });
    return res.json(atualizado);
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

  // MODO TESTES: certificados não têm exclusão em cascata no schema (para preservar o
  // histórico em uso normal), então são apagados manualmente aqui antes do treinamento.
  // Para reativar a trava, basta remover este bloco e impedir a exclusão quando houver
  // certificados vinculados (similar ao que é feito em provaController.excluirModelo).
  await prisma.$transaction([
    prisma.certificado.deleteMany({ where: { treinamentoId: id } }),
    prisma.treinamento.delete({ where: { id } }),
  ]);
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

// ---- Liberação de prova (válida por 1h) ----
// O corretor acessa a prova direto pela tela do treinamento (sem link/QR compartilhado),
// desde que já tenha presença confirmada manualmente pelo supervisor/admin.

async function liberar(req, res) {
  const { id } = req.params;

  const treinamento = await prisma.treinamento.findUnique({ where: { id } });
  if (!treinamento) throw new HttpError(404, 'Treinamento não encontrado.');

  if (!treinamento.temProva) {
    throw new HttpError(400, 'Este treinamento não possui prova para liberar.');
  }

  if (req.usuario.perfil === 'SUPERVISOR' && treinamento.supervisorId !== req.usuario.id) {
    throw new HttpError(403, 'Você só pode liberar treinamentos criados por você.');
  }

  const liberadoEm = new Date();
  const liberadoExpiraEm = new Date(liberadoEm.getTime() + 60 * 60 * 1000); // 1h

  await prisma.treinamento.update({
    where: { id },
    data: { liberadoEm, liberadoExpiraEm },
  });

  res.json({ liberadoEm, liberadoExpiraEm });
}

// ---- Confirmação manual de presença (Admin/Supervisor, a partir da lista de interessados) ----

async function definirPresenca(req, res) {
  const { id, corretorId } = req.params;
  const { confirmado } = req.body;

  const treinamento = await prisma.treinamento.findUnique({ where: { id } });
  if (!treinamento) throw new HttpError(404, 'Treinamento não encontrado.');

  if (req.usuario.perfil === 'SUPERVISOR' && treinamento.supervisorId !== req.usuario.id) {
    throw new HttpError(403, 'Você só pode confirmar presença em treinamentos criados por você.');
  }

  const interesse = await prisma.interesseTreinamento.findUnique({
    where: { treinamentoId_corretorId: { treinamentoId: id, corretorId } },
  });
  if (!interesse || interesse.cancelado) {
    throw new HttpError(400, 'Este corretor não demonstrou interesse neste treinamento.');
  }

  if (confirmado) {
    if (diaJaPassou(treinamento.data)) {
      throw new HttpError(400, 'Não é mais possível dar presença: a data deste treinamento já passou.');
    }
    await prisma.presenca.upsert({
      where: { treinamentoId_corretorId: { treinamentoId: id, corretorId } },
      update: {},
      create: { treinamentoId: id, corretorId },
    });
  } else {
    await prisma.presenca.deleteMany({ where: { treinamentoId: id, corretorId } });
  }

  res.json({ mensagem: confirmado ? 'Presença confirmada.' : 'Presença removida.' });
}

// ---- Sugestão de nome / preenchimento automático (item 1) ----
// Lista, por produto, um treinamento representante de cada "tema" já usado em treinamentos
// com prova (que geram certificado), trazendo sempre a versão mais recentemente editada.
async function sugestoesPorProduto(req, res) {
  const { produtoId } = req.query;
  if (!produtoId) throw new HttpError(400, 'Informe produtoId.');

  const treinamentos = await prisma.treinamento.findMany({
    where: { produtoId, temProva: true, provaId: { not: null } },
    orderBy: { atualizadoEm: 'desc' },
    select: {
      tema: true,
      localTreinamento: true,
      planoTreinamento: true,
      provaId: true,
      prova: { select: { titulo: true } },
    },
  });

  const vistos = new Set();
  const sugestoes = [];
  for (const t of treinamentos) {
    const chave = t.tema.trim().toLowerCase();
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    sugestoes.push({
      tema: t.tema,
      localTreinamento: t.localTreinamento,
      planoTreinamento: t.planoTreinamento,
      provaId: t.provaId,
      provaTitulo: t.prova?.titulo,
    });
  }
  sugestoes.sort((a, b) => a.tema.localeCompare(b.tema));

  res.json(sugestoes);
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
  definirPresenca,
  sugestoesPorProduto,
};
