const prisma = require('../config/prisma');
const { HttpError } = require('../middleware/errorHandler');

// MODO SEM PDF: certificados não geram mais arquivo (ver certificadoService.js), então
// esta lista não retorna mais "url" de download — só os dados usados para exibição
// (a carteirinha do corretor com as insígnias é quem representa o certificado agora).
async function listarMeusCertificados(req, res) {
  const certificados = await prisma.certificado.findMany({
    where: { corretorId: req.usuario.id },
    orderBy: { emitidoEm: 'desc' },
    include: { treinamento: { include: { produto: true } } },
  });

  const resultado = certificados.map((c) => ({
    id: c.id,
    produto: c.treinamento.produto.nome,
    tema: c.treinamento.tema,
    percentual: c.percentual,
    emitidoEm: c.emitidoEm,
  }));

  res.json(resultado);
}

module.exports = { listarMeusCertificados };
