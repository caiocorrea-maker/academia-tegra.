const jwt = require('jsonwebtoken');
const prisma = require('../config/prisma');

/**
 * Exige que a requisição tenha um token JWT válido.
 * Popula req.usuario com { id, perfil, nome, email }.
 */
async function autenticar(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ erro: 'Token de autenticação não informado.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    const usuario = await prisma.usuario.findUnique({ where: { id: payload.id } });
    if (!usuario || !usuario.ativo) {
      return res.status(401).json({ erro: 'Usuário inválido ou inativo.' });
    }

    req.usuario = {
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      perfil: usuario.perfil,
      empresaId: usuario.empresaId,
    };
    next();
  } catch (err) {
    return res.status(401).json({ erro: 'Token inválido ou expirado.' });
  }
}

/**
 * Restringe o acesso a determinados perfis.
 * Uso: permitir('ADMIN', 'SUPERVISOR')
 */
function permitir(...perfisPermitidos) {
  return (req, res, next) => {
    if (!req.usuario || !perfisPermitidos.includes(req.usuario.perfil)) {
      return res.status(403).json({ erro: 'Você não tem permissão para executar esta ação.' });
    }
    next();
  };
}

module.exports = { autenticar, permitir };
