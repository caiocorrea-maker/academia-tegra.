const MESES_VALIDADE_CERTIFICADO = 6;

function validoAte(emitidoEm) {
  const data = new Date(emitidoEm);
  data.setMonth(data.getMonth() + MESES_VALIDADE_CERTIFICADO);
  return data;
}

function certificadoValido(emitidoEm) {
  return new Date() < validoAte(emitidoEm);
}

module.exports = { MESES_VALIDADE_CERTIFICADO, validoAte, certificadoValido };
