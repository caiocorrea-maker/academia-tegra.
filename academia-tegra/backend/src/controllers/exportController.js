const ExcelJS = require('exceljs');
const prisma = require('../config/prisma');
const { certificadoValido, validoAte } = require('../utils/aptidao');

// Exporta histórico de treinamentos para Excel, com os mesmos filtros do histórico.
// Não inclui evidências (PNG/JPG), conforme especificação.
async function exportarTreinamentos(req, res) {
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
      produto: { select: { nome: true } },
      supervisor: { select: { nome: true } },
      interesses: { where: { cancelado: false } },
      presencas: true,
      tentativasProva: { where: { status: 'CONCLUIDA' } },
    },
    orderBy: { data: 'desc' },
  });

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Academia Tegra';
  const sheet = workbook.addWorksheet('Treinamentos');

  sheet.columns = [
    { header: 'Produto', key: 'produto', width: 25 },
    { header: 'Supervisor', key: 'supervisor', width: 25 },
    { header: 'Tema', key: 'tema', width: 35 },
    { header: 'Data', key: 'data', width: 15 },
    { header: 'Horário', key: 'horario', width: 12 },
    { header: 'Interessados', key: 'interessados', width: 15 },
    { header: 'Presentes', key: 'presentes', width: 12 },
    { header: 'Taxa de presença', key: 'taxaPresenca', width: 16 },
    { header: 'Aprovados', key: 'aprovados', width: 12 },
    { header: 'Taxa de aprovação', key: 'taxaAprovacao', width: 16 },
  ];
  sheet.getRow(1).font = { bold: true };

  for (const t of treinamentos) {
    const interessados = t.interesses.length;
    const presentes = t.presencas.length;
    const aprovados = t.tentativasProva.filter((tp) => tp.aprovado).length;
    // Taxa de presença = presentes / interessados. Taxa de aprovação = aprovados / presentes.
    // Sem interessados/presentes ainda, deixamos em branco (não faz sentido dividir por 0).
    const taxaPresenca = interessados > 0 ? `${Math.round((presentes / interessados) * 100)}%` : '-';
    const taxaAprovacao = presentes > 0 ? `${Math.round((aprovados / presentes) * 100)}%` : '-';

    sheet.addRow({
      produto: t.produto.nome,
      supervisor: t.supervisor.nome,
      tema: t.tema,
      data: new Date(t.data).toLocaleDateString('pt-BR'),
      horario: t.horario,
      interessados,
      presentes,
      taxaPresenca,
      aprovados,
      taxaAprovacao,
    });
  }

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="extracao_resumo_treinamentos_academia_tegra.xlsx"');

  await workbook.xlsx.write(res);
  res.end();
}

// Exporta uma linha por corretor que demonstrou interesse em cada treinamento filtrado
// (inclusive quem não teve presença confirmada), com dados de contato/hierarquia — útil
// para conferência de presença e RH/comercial.
async function exportarPresencas(req, res) {
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
      produto: { select: { nome: true } },
      interesses: { where: { cancelado: false }, include: { corretor: { include: { empresa: true } } } },
      presencas: { select: { corretorId: true } },
      tentativasProva: { where: { status: 'CONCLUIDA' }, select: { corretorId: true, aprovado: true } },
    },
    orderBy: { data: 'desc' },
  });

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Academia Tegra';
  const sheet = workbook.addWorksheet('Presença');

  sheet.columns = [
    { header: 'Nome do Corretor', key: 'nome', width: 30 },
    { header: 'Empresa de Vendas', key: 'empresa', width: 25 },
    { header: 'Gerente', key: 'gerente', width: 22 },
    { header: 'Diretor', key: 'diretor', width: 22 },
    { header: 'Local do Treinamento', key: 'local', width: 25 },
    { header: 'Produto', key: 'produto', width: 22 },
    { header: 'Tema', key: 'tema', width: 30 },
    { header: 'Prova', key: 'prova', width: 10 },
    { header: 'Data', key: 'data', width: 15 },
    { header: 'Presença', key: 'presenca', width: 12 },
    { header: 'Aprovado', key: 'aprovado', width: 12 },
  ];
  sheet.getRow(1).font = { bold: true };

  for (const t of treinamentos) {
    const presencaIds = new Set(t.presencas.map((p) => p.corretorId));
    const tentativasMap = new Map(t.tentativasProva.map((tp) => [tp.corretorId, tp]));

    // Todos os corretores que demonstraram interesse (não cancelado) aparecem na listagem,
    // independentemente de terem tido a presença confirmada ou não.
    for (const interesse of t.interesses) {
      const corretor = interesse.corretor;
      const tentativa = tentativasMap.get(corretor.id);

      let aprovado = '';
      if (t.temProva && tentativa) {
        aprovado = tentativa.aprovado ? 'Sim' : 'Não';
      }

      sheet.addRow({
        nome: corretor.nome,
        empresa: corretor.empresa?.nome || '-',
        gerente: corretor.gerente || '-',
        diretor: corretor.diretor || '-',
        local: t.localTreinamento || '-',
        produto: t.produto.nome,
        tema: t.tema,
        prova: t.temProva ? 'Sim' : 'Não',
        data: new Date(t.data).toLocaleDateString('pt-BR'),
        presenca: presencaIds.has(corretor.id) ? 'Sim' : 'Não',
        aprovado,
      });
    }
  }

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="presenca_academia_tegra.xlsx"');

  await workbook.xlsx.write(res);
  res.end();
}

// Exporta os corretores aptos a tirar plantão. Sem produtoId, considera todos os produtos
// ativos (respeitando, para Supervisor, só os produtos vinculados a ele); com produtoId,
// exporta só daquele produto (usado pelo botão "Corretores aptos" dentro da tela de um
// Produto específico).
async function exportarCorretoresAptos(req, res) {
  const { produtoId } = req.query;

  let produtos;
  if (produtoId) {
    const produto = await prisma.produto.findUnique({ where: { id: produtoId } });
    if (!produto) return res.status(404).json({ erro: 'Produto não encontrado.' });
    if (req.usuario.perfil === 'SUPERVISOR') {
      const vinculo = await prisma.produtoSupervisor.findUnique({
        where: { produtoId_supervisorId: { produtoId, supervisorId: req.usuario.id } },
      });
      if (!vinculo) return res.status(403).json({ erro: 'Você não tem acesso a este produto.' });
    }
    produtos = [produto];
  } else if (req.usuario.perfil === 'SUPERVISOR') {
    const vinculos = await prisma.produtoSupervisor.findMany({
      where: { supervisorId: req.usuario.id },
      select: { produto: true },
    });
    produtos = vinculos.map((v) => v.produto).filter((p) => p.ativo);
  } else {
    produtos = await prisma.produto.findMany({ where: { ativo: true } });
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Academia Tegra';
  const sheet = workbook.addWorksheet('Corretores aptos');

  sheet.columns = [
    { header: 'Produto', key: 'produto', width: 25 },
    { header: 'Nome do Corretor', key: 'nome', width: 30 },
    { header: 'Imobiliária', key: 'empresa', width: 25 },
    { header: 'Gerente', key: 'gerente', width: 22 },
    { header: 'Diretor', key: 'diretor', width: 22 },
    { header: 'Nota média', key: 'notaMedia', width: 12 },
    { header: 'Data de validade', key: 'validade', width: 16 },
  ];
  sheet.getRow(1).font = { bold: true };

  for (const produto of produtos) {
    const certificados = await prisma.certificado.findMany({
      // Só Temas Oficiais ativos contam para aptidão (mesma regra do dashboard).
      where: { temaOficialId: { not: null }, temaOficial: { produtoId: produto.id, ativo: true } },
      select: {
        corretorId: true,
        emitidoEm: true,
        percentual: true,
        corretor: { select: { nome: true, gerente: true, diretor: true, empresa: { select: { nome: true } } } },
      },
    });

    const porCorretor = {}; // corretorId -> { certs: [...], corretor }
    for (const c of certificados) {
      if (!certificadoValido(c.emitidoEm)) continue;
      porCorretor[c.corretorId] ??= { certs: [], corretor: c.corretor };
      porCorretor[c.corretorId].certs.push(c);
    }

    for (const { certs, corretor } of Object.values(porCorretor)) {
      if (certs.length < produto.certificadosNecessarios) continue; // não apto: faltam insígnias

      const notaMedia = certs.reduce((soma, c) => soma + c.percentual, 0) / certs.length;
      // Data de validade = a do certificado mais próximo de vencer entre os que compõem a aptidão.
      const dataValidade = certs
        .map((c) => validoAte(c.emitidoEm))
        .reduce((maisProxima, atual) => (atual < maisProxima ? atual : maisProxima));

      sheet.addRow({
        produto: produto.nome,
        nome: corretor.nome,
        empresa: corretor.empresa?.nome || '-',
        gerente: corretor.gerente || '-',
        diretor: corretor.diretor || '-',
        notaMedia: `${notaMedia.toFixed(0)}%`,
        validade: dataValidade.toLocaleDateString('pt-BR'),
      });
    }
  }

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="corretores_aptos_academia_tegra.xlsx"');

  await workbook.xlsx.write(res);
  res.end();
}

// Exporta todas as respostas de NPS (uma linha por resposta). Sem produtoId, considera
// todos os produtos (Supervisor só vê os vinculados a ele — mesma regra do
// npsController/exportarCorretoresAptos).
async function exportarAvaliacoesNps(req, res) {
  const { produtoId } = req.query;

  let produtoIdFiltro = produtoId ? { produtoId } : {};
  if (req.usuario.perfil === 'SUPERVISOR') {
    if (produtoId) {
      const vinculo = await prisma.produtoSupervisor.findUnique({
        where: { produtoId_supervisorId: { produtoId, supervisorId: req.usuario.id } },
      });
      if (!vinculo) return res.status(403).json({ erro: 'Você não tem acesso a este produto.' });
    } else {
      const vinculos = await prisma.produtoSupervisor.findMany({
        where: { supervisorId: req.usuario.id },
        select: { produtoId: true },
      });
      produtoIdFiltro = { produtoId: { in: vinculos.map((v) => v.produtoId) } };
    }
  }

  const respostas = await prisma.avaliacaoNps.findMany({
    where: { treinamento: produtoIdFiltro },
    include: {
      treinamento: {
        select: {
          tema: true,
          data: true,
          horario: true,
          temProva: true,
          produto: { select: { nome: true } },
        },
      },
      corretor: {
        select: { nome: true, gerente: true, diretor: true, empresa: { select: { nome: true } } },
      },
    },
    orderBy: { criadoEm: 'desc' },
  });

  // Busca as tentativas de prova relevantes de uma vez só, pra saber "Aprovado"/"Reprovado"
  // sem fazer uma consulta por linha.
  const tentativas = await prisma.tentativaProva.findMany({
    where: {
      status: 'CONCLUIDA',
      OR: respostas
        .filter((r) => r.treinamento.temProva)
        .map((r) => ({ treinamentoId: r.treinamentoId, corretorId: r.corretorId })),
    },
    select: { treinamentoId: true, corretorId: true, aprovado: true },
  });
  const aprovadoPorChave = new Map(tentativas.map((t) => [`${t.treinamentoId}-${t.corretorId}`, t.aprovado]));

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Academia Tegra';
  const sheet = workbook.addWorksheet('Avaliações NPS');

  sheet.columns = [
    { header: 'Produto', key: 'produto', width: 22 },
    { header: 'Treinamento', key: 'treinamento', width: 32 },
    { header: 'Data', key: 'data', width: 14 },
    { header: 'Hora', key: 'hora', width: 10 },
    { header: 'Corretor', key: 'corretor', width: 26 },
    { header: 'Empresa de Vendas', key: 'empresa', width: 22 },
    { header: 'Gerente', key: 'gerente', width: 20 },
    { header: 'Diretor', key: 'diretor', width: 20 },
    { header: 'Aprovado', key: 'aprovado', width: 14 },
    { header: 'Nota Material', key: 'notaMaterial', width: 14 },
    { header: 'Nota Supervisor', key: 'notaSupervisor', width: 16 },
    { header: 'Nota Satisfação', key: 'notaSatisfacao', width: 16 },
    { header: 'Resposta Positivo', key: 'positivo', width: 40 },
    { header: 'Resposta A Melhorar', key: 'melhorar', width: 40 },
  ];
  sheet.getRow(1).font = { bold: true };

  for (const r of respostas) {
    let aprovado = 'Sem prova';
    if (r.treinamento.temProva) {
      const foiAprovado = aprovadoPorChave.get(`${r.treinamentoId}-${r.corretorId}`);
      aprovado = foiAprovado ? 'Aprovado' : 'Reprovado';
    }

    sheet.addRow({
      produto: r.treinamento.produto.nome,
      treinamento: r.treinamento.tema,
      data: new Date(r.treinamento.data).toLocaleDateString('pt-BR'),
      hora: r.treinamento.horario,
      corretor: r.corretor.nome,
      empresa: r.corretor.empresa?.nome || '-',
      gerente: r.corretor.gerente || '-',
      diretor: r.corretor.diretor || '-',
      aprovado,
      notaMaterial: r.notaMaterial,
      notaSupervisor: r.notaSupervisor,
      notaSatisfacao: r.notaSatisfacao,
      positivo: r.pontosPositivos || '',
      melhorar: r.pontosMelhorar || '',
    });
  }

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="avaliacoes_nps_academia_tegra.xlsx"');

  await workbook.xlsx.write(res);
  res.end();
}

module.exports = { exportarTreinamentos, exportarPresencas, exportarCorretoresAptos, exportarAvaliacoesNps };
