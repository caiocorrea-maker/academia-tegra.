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
    const presentes = t.presencas.length + t.tentativasProva.length;
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

module.exports = { exportarTreinamentos };
