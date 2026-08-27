const prisma = require('../config/prisma');

// Emite ou RENOVA o certificado de um corretor num Tema Oficial (insígnia). Como o
// certificado agora é identificado por (temaOficialId + corretorId) em vez de por
// treinamento, repetir a aplicação do mesmo Tema Oficial não cria um certificado novo —
// atualiza o registro existente (nova validade de 6 meses a partir de agora, novo
// percentual, e passa a apontar para o treinamento mais recente que gerou a aprovação).
// Isso é o que resolve o bug de insígnias duplicadas.
async function gerarOuRenovarCertificado({ temaOficialId, treinamentoId, corretorId, percentual }) {
  return prisma.certificado.upsert({
    where: { temaOficialId_corretorId: { temaOficialId, corretorId } },
    update: { treinamentoId, percentual, emitidoEm: new Date() },
    create: { temaOficialId, treinamentoId, corretorId, percentual, urlArquivo: '' },
  });
}

module.exports = { gerarOuRenovarCertificado };
