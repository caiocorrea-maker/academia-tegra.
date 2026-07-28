export function formatarCPF(cpf) {
  if (!cpf) return '';
  const limpo = String(cpf).replace(/\D/g, '');
  return limpo.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}
