// Insígnia (selo) usada na carteirinha do corretor: um escudo com estrela. Quando
// "preenchida" (colorida com a cor do produto), representa um certificado válido; quando
// "vazia" (cinza), representa uma vaga de certificado ainda não alcançada.
export default function InsigniaSelo({ preenchida, cor = '#4f46e5', tamanho = 26, titulo }) {
  const corFinal = preenchida ? cor : '#d1d5db';
  return (
    <svg
      width={tamanho}
      height={tamanho}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ flexShrink: 0 }}
    >
      {titulo && <title>{titulo}</title>}
      <path
        d="M12 2 L20 5.5 V11 C20 16 16.5 20 12 22 C7.5 20 4 16 4 11 V5.5 Z"
        fill={corFinal}
        stroke={preenchida ? corFinal : '#b8bcc6'}
        strokeWidth="1"
      />
      <path
        d="M12 7.2 L13.3 10 L16.3 10.4 L14.1 12.5 L14.7 15.5 L12 14 L9.3 15.5 L9.9 12.5 L7.7 10.4 L10.7 10 Z"
        fill={preenchida ? '#fff' : '#e8e9ee'}
      />
    </svg>
  );
}
