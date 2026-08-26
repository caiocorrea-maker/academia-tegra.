const prisma = require('../config/prisma');

// MODO SEM PDF: a geração de PDF do certificado foi desativada a pedido do Caio, já que
// a carteirinha do corretor (com as insígnias) passou a ser a representação visual do
// certificado. O registro de Certificado continua sendo criado normalmente — ele é o que
// alimenta as insígnias, o dashboard e o gate da Biblioteca de Treinamentos — só não gera
// mais o arquivo PDF nem ocupa espaço no bucket. Para reativar a geração de PDF no futuro,
// restaure a função gerarPdfBuffer (que usava a lib "pdfkit") e volte a chamá-la aqui,
// enviando o resultado para uploadBuffer como antes.
async function gerarCertificadoParaTentativa({ treinamentoId, corretorId, percentual }) {
  const existente = await prisma.certificado.findUnique({
    where: { treinamentoId_corretorId: { treinamentoId, corretorId } },
  });
  if (existente) return existente;

  const certificado = await prisma.certificado.create({
    data: { treinamentoId, corretorId, urlArquivo: '', percentual },
  });

  return certificado;
}

// Usado quando não há prova: gera certificado ao confirmar presença (aprovação = presença, 100%)
async function gerarCertificadoParaPresenca({ treinamentoId, corretorId }) {
  return gerarCertificadoParaTentativa({ treinamentoId, corretorId, percentual: 100 });
}

module.exports = { gerarCertificadoParaTentativa, gerarCertificadoParaPresenca };
