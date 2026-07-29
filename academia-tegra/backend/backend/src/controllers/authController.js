const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const prisma = require('../config/prisma');
const { enviarEmailRecuperacaoSenha } = require('../config/mailer');
const { loginSchema, esqueciSenhaSchema, redefinirSenhaSchema } = require('../utils/schemas');
const { HttpError } = require('../middleware/errorHandler');

function gerarToken(usuario) {
  return jwt.sign(
    { id: usuario.id, perfil: usuario.perfil },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
  );
}

async function login(req, res) {
  const { email, senha } = loginSchema.parse(req.body);

  const usuario = await prisma.usuario.findUnique({ where: { email } });
  if (!usuario || !usuario.ativo) {
    throw new HttpError(401, 'E-mail ou senha inválidos.');
  }

  const senhaValida = await bcrypt.compare(senha, usuario.senhaHash);
  if (!senhaValida) {
    throw new HttpError(401, 'E-mail ou senha inválidos.');
  }

  const token = gerarToken(usuario);
  res.json({
    token,
    usuario: {
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      perfil: usuario.perfil,
    },
  });
}

async function me(req, res) {
  const usuario = await prisma.usuario.findUnique({
    where: { id: req.usuario.id },
    select: {
      id: true, nome: true, email: true, perfil: true, cpf: true,
      empresa: { select: { id: true, nome: true } },
      produtosVinculados: { select: { produto: { select: { id: true, nome: true, corCalendario: true } } } },
    },
  });
  res.json(usuario);
}

async function esqueciSenha(req, res) {
  const { email } = esqueciSenhaSchema.parse(req.body);
  const usuario = await prisma.usuario.findUnique({ where: { email } });

  // Resposta genérica sempre, para não revelar quais e-mails existem
  const respostaGenerica = { mensagem: 'Se o e-mail existir em nossa base, você receberá instruções de recuperação.' };

  if (!usuario || !usuario.ativo) {
    return res.json(respostaGenerica);
  }

  const token = crypto.randomBytes(32).toString('hex');
  const expiraEm = new Date(Date.now() + 60 * 60 * 1000); // 1h

  await prisma.passwordResetToken.create({
    data: { token, usuarioId: usuario.id, expiraEm },
  });

  const link = `${process.env.FRONTEND_URL}/redefinir-senha?token=${token}`;
  await enviarEmailRecuperacaoSenha(usuario.email, usuario.nome, link);

  res.json(respostaGenerica);
}

async function redefinirSenha(req, res) {
  const { token, novaSenha } = redefinirSenhaSchema.parse(req.body);

  const resetToken = await prisma.passwordResetToken.findUnique({ where: { token } });
  if (!resetToken || resetToken.usado || resetToken.expiraEm < new Date()) {
    throw new HttpError(400, 'Link de recuperação inválido ou expirado.');
  }

  const senhaHash = await bcrypt.hash(novaSenha, 10);

  await prisma.$transaction([
    prisma.usuario.update({ where: { id: resetToken.usuarioId }, data: { senhaHash } }),
    prisma.passwordResetToken.update({ where: { id: resetToken.id }, data: { usado: true } }),
  ]);

  res.json({ mensagem: 'Senha redefinida com sucesso.' });
}

async function trocarSenhaLogado(req, res) {
  const { senhaAtual, novaSenha } = req.body;
  if (!senhaAtual || !novaSenha || novaSenha.length < 6) {
    throw new HttpError(400, 'Informe a senha atual e uma nova senha com ao menos 6 caracteres.');
  }

  const usuario = await prisma.usuario.findUnique({ where: { id: req.usuario.id } });
  const senhaValida = await bcrypt.compare(senhaAtual, usuario.senhaHash);
  if (!senhaValida) throw new HttpError(401, 'Senha atual incorreta.');

  const senhaHash = await bcrypt.hash(novaSenha, 10);
  await prisma.usuario.update({ where: { id: usuario.id }, data: { senhaHash } });

  res.json({ mensagem: 'Senha alterada com sucesso.' });
}

module.exports = { login, me, esqueciSenha, redefinirSenha, trocarSenhaLogado };
