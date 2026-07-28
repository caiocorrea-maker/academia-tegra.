const PDFDocument = require('pdfkit');
const prisma = require('../config/prisma');
const { uploadBuffer } = require('../config/s3');

function gerarPdfBuffer({ nomeCorretor, tema, nomeProduto, dataTreinamento, percentual }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ layout: 'landscape', size: 'A4', margin: 50 });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const dataFormatada = new Date(dataTreinamento).toLocaleDateString('pt-BR');

    // Moldura decorativa simples
    doc.rect(20, 20, doc.page.width - 40, doc.page.height - 40).lineWidth(3).stroke('#4f46e5');

    doc.fontSize(30).fillColor('#1a1a2e').font('Helvetica-Bold')
      .text('CERTIFICADO DE CONCLUSÃO', 0, 100, { align: 'center' });

    doc.moveDown(1.5);
    doc.fontSize(14).fillColor('#333').font('Helvetica')
      .text('Certificamos que', { align: 'center' });

    doc.moveDown(0.5);
    doc.fontSize(24).fillColor('#4f46e5').font('Helvetica-Bold')
      .text(nomeCorretor, { align: 'center' });

    doc.moveDown(0.5);
    doc.fontSize(14).fillColor('#333').font('Helvetica')
      .text(`concluiu com aproveitamento o treinamento "${tema}", referente ao produto ${nomeProduto},`, {
        align: 'center',
      });

    doc.moveDown(0.3);
    doc.text(`realizado em ${dataFormatada}, com percentual de acertos de ${percentual.toFixed(0)}%.`, {
      align: 'center',
    });

    doc.moveDown(2);
    doc.fontSize(12).fillColor('#666')
      .text('Academia Tegra - Treinamentos da Equipe Comercial', { align: 'center' });

    doc.end();
  });
}

async function gerarCertificadoParaTentativa({ treinamentoId, corretorId, percentual }) {
  const existente = await prisma.certificado.findUnique({
    where: { treinamentoId_corretorId: { treinamentoId, corretorId } },
  });
  if (existente) return existente;

  const treinamento = await prisma.treinamento.findUnique({
    where: { id: treinamentoId },
    include: { produto: true },
  });
  const corretor = await prisma.usuario.findUnique({ where: { id: corretorId } });

  const pdfBuffer = await gerarPdfBuffer({
    nomeCorretor: corretor.nome,
    tema: treinamento.tema,
    nomeProduto: treinamento.produto.nome,
    dataTreinamento: treinamento.data,
    percentual,
  });

  const key = await uploadBuffer(pdfBuffer, `certificado-${corretorId}.pdf`, 'application/pdf', 'certificados');

  const certificado = await prisma.certificado.create({
    data: { treinamentoId, corretorId, urlArquivo: key, percentual },
  });

  return certificado;
}

// Usado quando não há prova: gera certificado ao confirmar presença (aprovação = presença, 100%)
async function gerarCertificadoParaPresenca({ treinamentoId, corretorId }) {
  return gerarCertificadoParaTentativa({ treinamentoId, corretorId, percentual: 100 });
}

module.exports = { gerarCertificadoParaTentativa, gerarCertificadoParaPresenca, gerarPdfBuffer };
