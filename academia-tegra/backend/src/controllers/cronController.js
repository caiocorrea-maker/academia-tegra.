const prisma = require('../config/prisma');
const { enviarEmailLembreteTreinamento } = require('../config/mailer');
const { HttpError } = require('../middleware/errorHandler');

// Reconstrói o momento exato (data + horário) de um treinamento, assumindo horário de
// Brasília (UTC-3) — mesma lógica usada em treinamentoController.
function montarDataHora(dataArmazenada, horario) {
  const data = new Date(dataArmazenada);
  const ano = data.getUTCFullYear();
  const mes = String(data.getUTCMonth() + 1).padStart(2, '0');
  const dia = String(data.getUTCDate()).padStart(2, '0');
  return new Date(`${ano}-${mes}-${dia}T${horario}:00-03:00`);
}

// Chamado periodicamente por um serviço externo de "ping" (ex: cron-job.org) a cada 15-30
// minutos. Verifica quais treinamentos começam entre 23h e 25h a partir de agora (uma janela
// de 2h para tolerar o intervalo entre chamadas) e envia o lembrete a quem demonstrou
// interesse e ainda não recebeu o e-mail, marcando lembreteEnviado para não duplicar.
async function executarLembretes(req, res) {
  const secretEsperado = process.env.CRON_SECRET;
  const secretRecebido = req.headers['x-cron-secret'];
  if (secretEsperado && secretRecebido !== secretEsperado) {
    throw new HttpError(401, 'Não autorizado.');
  }

  const agora = new Date();
  const janelaInicio = new Date(agora.getTime() + 23 * 60 * 60 * 1000);
  const janelaFim = new Date(agora.getTime() + 25 * 60 * 60 * 1000);

  // Busca treinamentos num intervalo de datas amplo (2 dias) e filtra o horário exato em JS,
  // já que "data" e "horario" são armazenados separadamente.
  const candidatos = await prisma.treinamento.findMany({
    where: {
      status: 'AGENDADO',
      data: { gte: new Date(agora.getTime() - 24 * 60 * 60 * 1000), lte: new Date(agora.getTime() + 48 * 60 * 60 * 1000) },
    },
    include: {
      produto: { select: { nome: true } },
      interesses: { where: { cancelado: false, lembreteEnviado: false }, include: { corretor: true } },
    },
  });

  let enviados = 0;
  for (const treinamento of candidatos) {
    const momento = montarDataHora(treinamento.data, treinamento.horario);
    if (momento < janelaInicio || momento > janelaFim) continue;

    for (const interesse of treinamento.interesses) {
      try {
        await enviarEmailLembreteTreinamento(interesse.corretor.email, interesse.corretor.nome, {
          data: treinamento.data,
          horario: treinamento.horario,
          tema: treinamento.tema,
          produtoNome: treinamento.produto.nome,
          localTreinamento: treinamento.localTreinamento,
        });
        await prisma.interesseTreinamento.update({ where: { id: interesse.id }, data: { lembreteEnviado: true } });
        enviados++;
      } catch (err) {
        console.error(`Falha ao enviar lembrete para ${interesse.corretor.email}:`, err.message);
      }
    }
  }

  res.json({ mensagem: 'Verificação de lembretes concluída.', lembretesEnviados: enviados });
}

module.exports = { executarLembretes };
