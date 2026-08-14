// Insígnia (selo) usada na carteirinha do corretor: um "patch" quadrado com uma roseta/flor
// bordada ao centro, no estilo de insígnias têxteis — desenho próprio da Academia Tegra.
// Quando "preenchida" (patch na cor do produto, flor num tom mais claro), representa um
// certificado válido; quando "vazia" (tudo em cinza), representa uma vaga de certificado
// ainda não alcançada.
export default function InsigniaSelo({ preenchida, cor = '#4f46e5', tamanho = 26, titulo }) {
  const corPatch = preenchida ? cor : '#c7cad1';
  const corBorda = preenchida ? shadeColor(cor, -25) : '#a5a8b0';
  const corFlor = preenchida ? '#fff4d1' : '#e4e6ea';

  const petalas = Array.from({ length: 8 }, (_, i) => i * 45);

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

      {/* Patch quadrado, cantos levemente arredondados, como um bordado têxtil */}
      <rect x="2" y="2" width="20" height="20" rx="3" fill={corPatch} stroke={corBorda} strokeWidth="1.4" />

      {/* Roseta central com 8 pétalas */}
      <g transform="translate(12 12)">
        {petalas.map((angulo) => (
          <ellipse
            key={angulo}
            cx="0"
            cy="-4.6"
            rx="2.1"
            ry="4.3"
            fill={corFlor}
            stroke={corBorda}
            strokeWidth="0.6"
            transform={`rotate(${angulo})`}
          />
        ))}
        <circle r="1.6" fill={corPatch} stroke={corBorda} strokeWidth="0.6" />
      </g>
    </svg>
  );
}

// Escurece/clareia uma cor hexadecimal (percent negativo escurece)
function shadeColor(hex, percent) {
  const num = parseInt(hex.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const r = Math.min(255, Math.max(0, (num >> 16) + amt));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00ff) + amt));
  const b = Math.min(255, Math.max(0, (num & 0x0000ff) + amt));
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}
