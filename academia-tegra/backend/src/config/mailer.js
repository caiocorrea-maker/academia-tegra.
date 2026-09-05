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

async function enviarEmailLembreteTreinamento(destinatario, nome, treinamento) {
  const dataFormatada = new Date(treinamento.data).toLocaleDateString('pt-BR');
  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to: destinatario,
    subject: 'Lembrete: seu treinamento é amanhã! 📚',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color:#1a1a2e;">Academia Tegra</h2>
        <p>Olá, ${nome}!</p>
        <p>Passando para lembrar que amanhã, <strong>${dataFormatada}</strong>, às <strong>${treinamento.horario}</strong>, acontece o treinamento <strong>"${treinamento.tema}"</strong> sobre o produto <strong>${treinamento.produtoNome}</strong>${treinamento.localTreinamento ? `, no local: <strong>${treinamento.localTreinamento}</strong>` : ''}.</p>
        <p>Você demonstrou interesse nesse treinamento — não esqueça de comparecer!</p>
        <p>Até lá,<br/>Academia Tegra</p>
      </div>
    `,
  });
}

async function enviarEmailConviteNps(destinatario, nome, treinamento, linkAvaliacao) {
  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to: destinatario,
    subject: 'Como foi seu treinamento? Sua opinião é importante! 📋',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color:#1a1a2e;">Academia Tegra</h2>
        <p>Olá, ${nome}!</p>
        <p>Sua presença no treinamento <strong>"${treinamento.tema}"</strong> (${treinamento.produtoNome}) foi confirmada. Queremos saber como foi essa experiência pra você.</p>
        <p style="text-align:center; margin: 24px 0;">
          <a href="${linkAvaliacao}" style="background:#4f46e5; color:#fff; padding:12px 24px; border-radius:8px; text-decoration:none; display:inline-block;">
            Avaliar treinamento
          </a>
        </p>
        <p>Leva menos de 1 minuto e ajuda a melhorar os próximos treinamentos.</p>
        <p>Obrigado,<br/>Academia Tegra</p>
      </div>
    `,
  });
}

module.exports = { transporter, enviarEmailRecuperacaoSenha, enviarEmailLembreteTreinamento, enviarEmailConviteNps };
