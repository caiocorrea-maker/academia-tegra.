const ExcelJS = require('exceljs');
const prisma = require('../config/prisma');

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
    { header: 'Aprovados', key: 'aprovados', width: 12 },
  ];
  sheet.getRow(1).font = { bold: true };

  for (const t of treinamentos) {
    const presentes = t.presencas.length;
    const aprovados = t.tentativasProva.filter((tp) => tp.aprovado).length;

    sheet.addRow({
      produto: t.produto.nome,
      supervisor: t.supervisor.nome,
      tema: t.tema,
      data: new Date(t.data).toLocaleDateString('pt-BR'),
      horario: t.horario,
      interessados: t.interesses.length,
      presentes,
      aprovados,
    });
  }

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="treinamentos_academia_tegra.xlsx"');

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

module.exports = { exportarTreinamentos, exportarPresencas };
