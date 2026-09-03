// Converte uma data "YYYY-MM-DD" vinda do formulário em um Date "ancorado" ao meio-dia
// UTC. Isso evita o bug clássico de fuso horário em que salvar a data pura à meia-noite
// UTC e depois exibi-la em horário de Brasília (UTC-3) faz o dia "voltar" um dia.
function ancorarData(dataString) {
  return new Date(`${dataString}T12:00:00Z`);
}

// Reconstrói o momento exato (data + horário) de um treinamento, assumindo o horário
// informado como horário de Brasília (UTC-3), para comparações de prazo (ex: início do
// treinamento, liberação de prova). Extrai a data via getters UTC porque o valor já está
// ancorado ao meio-dia UTC (ancorarData), então isso é seguro em qualquer fuso do servidor.
function montarDataHora(dataArmazenada, horario) {
  const data = new Date(dataArmazenada);
  const ano = data.getUTCFullYear();
  const mes = String(data.getUTCMonth() + 1).padStart(2, '0');
  const dia = String(data.getUTCDate()).padStart(2, '0');
  return new Date(`${ano}-${mes}-${dia}T${horario}:00-03:00`);
}

// Retorna true se o dia do treinamento (ignorando o horário específico) já ficou no
// passado em relação a hoje. O treinamento ainda pode receber ações (como dar presença)
// durante o próprio dia em que acontece, mas não mais a partir do dia seguinte.
function diaJaPassou(dataArmazenada) {
  const data = new Date(dataArmazenada);
  const hoje = new Date();
  const diaTreinamento = Date.UTC(data.getUTCFullYear(), data.getUTCMonth(), data.getUTCDate());
  const diaHoje = Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), hoje.getUTCDate());
  return diaTreinamento < diaHoje;
}

module.exports = { ancorarData, montarDataHora, diaJaPassou };
