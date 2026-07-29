const { ZodError } = require('zod');

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      erro: 'Dados inválidos.',
      detalhes: err.errors.map((e) => ({ campo: e.path.join('.'), mensagem: e.message })),
    });
  }

  if (err.code === 'P2002') {
    // Violação de unicidade do Prisma
    return res.status(409).json({ erro: 'Já existe um registro com esses dados (violação de unicidade).', campo: err.meta?.target });
  }

  if (err.code === 'P2025') {
    return res.status(404).json({ erro: 'Registro não encontrado.' });
  }

  console.error(err);
  const status = err.status || 500;
  res.status(status).json({ erro: err.publicMessage || 'Erro interno do servidor.' });
}

class HttpError extends Error {
  constructor(status, publicMessage) {
    super(publicMessage);
    this.status = status;
    this.publicMessage = publicMessage;
  }
}

module.exports = { errorHandler, HttpError };
