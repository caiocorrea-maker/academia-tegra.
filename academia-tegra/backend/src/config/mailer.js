const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 465),
  secure: String(process.env.SMTP_SECURE) === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

async function enviarEmailRecuperacaoSenha(destinatario, nome, linkReset) {
  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to: destinatario,
    subject: 'Academia Tegra - Recuperação de senha',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color:#1a1a2e;">Academia Tegra</h2>
        <p>Olá, ${nome}.</p>
        <p>Recebemos uma solicitação para redefinir sua senha. Clique no botão abaixo para criar uma nova senha. Este link é válido por 1 hora.</p>
        <p style="text-align:center; margin: 24px 0;">
          <a href="${linkReset}" style="background:#4f46e5; color:#fff; padding:12px 24px; border-radius:8px; text-decoration:none; display:inline-block;">
            Redefinir minha senha
          </a>
        </p>
        <p>Se você não solicitou isso, pode ignorar este e-mail com segurança.</p>
      </div>
    `,
  });
}

module.exports = { transporter, enviarEmailRecuperacaoSenha };
