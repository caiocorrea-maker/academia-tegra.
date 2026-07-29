const prisma = require('../config/prisma');
const { getFileUrl } = require('../config/s3');
const { HttpError } = require('../middleware/errorHandler');

// Lista certificados do próprio corretor (ou de um corretor específico, se Admin/Supervisor)
async function listarMeusCertificados(req, res) {
  const certificados = await prisma.certificado.findMany({
    where: { corretorId: req.usuario.id },
    orderBy: { emitidoEm: 'desc' },
    include: { treinamento: { include: { produto: true } } },
  });

  const comUrl = await Promise.all(
    certificados.map(async (c) => ({
      id: c.id,
      produto: c.treinamento.produto.nome,
      tema: c.treinamento.tema,
      percentual: c.percentual,
      emitidoEm: c.emitidoEm,
      url: await getFileUrl(c.urlArquivo),
    }))
  );

  res.json(comUrl);
}

async function obterUrlDownload(req, res) {
  const { id } = req.params;
  const certificado = await prisma.certificado.findUnique({ where: { id } });
  if (!certificado) throw new HttpError(404, 'Certificado não encontrado.');

  if (req.usuario.perfil === 'CORRETOR' && certificado.corretorId !== req.usuario.id) {
    throw new HttpError(403, 'Você não tem acesso a este certificado.');
  }

  const url = await getFileUrl(certificado.urlArquivo);
  res.json({ url });
}

module.exports = { listarMeusCertificados, obterUrlDownload };
