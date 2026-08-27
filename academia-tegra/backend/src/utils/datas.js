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

module.exports = { ancorarData, montarDataHora };
