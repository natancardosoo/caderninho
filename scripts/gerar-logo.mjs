// Gera os SVGs do logo (Caderninho) em public/. Depois rode: node scripts/gerar-icones.mjs
import fs from 'node:fs';

const defs = `
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4f8cff"/><stop offset=".55" stop-color="#2563eb"/><stop offset="1" stop-color="#1a45c4"/></linearGradient>
    <radialGradient id="glow" cx=".28" cy=".2" r=".75"><stop offset="0" stop-color="#fff" stop-opacity=".28"/><stop offset=".6" stop-color="#fff" stop-opacity="0"/></radialGradient>
    <linearGradient id="paper" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fffefa"/><stop offset="1" stop-color="#f3eee2"/></linearGradient>
    <linearGradient id="metal" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#94a3b8"/><stop offset=".45" stop-color="#f8fafc"/><stop offset="1" stop-color="#64748b"/></linearGradient>
    <linearGradient id="wood" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fcd34d"/><stop offset=".5" stop-color="#fbbf24"/><stop offset="1" stop-color="#d97706"/></linearGradient>
    <filter id="drop" x="-25%" y="-25%" width="150%" height="160%"><feDropShadow dx="0" dy="5" stdDeviation="6" flood-color="#0b1b4d" flood-opacity=".38"/></filter>`;

const rings = Array.from({ length: 6 }, (_, i) => {
  const x = 56 + i * 18;
  return `<circle cx="${x}" cy="41" r="3.6" fill="#1e293b" opacity=".45"/><rect x="${x - 3}" y="21" width="6" height="23" rx="3" fill="url(#metal)" stroke="#475569" stroke-width=".8"/>`;
}).join('\n      ');

// riscos "escritos à mão" + marcações de valor em cada linha
const entries = [
  [108, '#22c55e', 120, 24],
  [96, '#22c55e', 124, 20],
  [114, '#f97316', 126, 18],
  [90, '#22c55e', 122, 22],
].map(([end, color, px, pw], k) => {
  const y = 64 + k * 24;
  return `<line x1="72" y1="${y}" x2="${end}" y2="${y}" stroke="#334155" stroke-width="5" stroke-linecap="round"/><rect x="${px}" y="${y - 4.5}" width="${pw}" height="9" rx="4.5" fill="${color}"/>`;
}).join('\n      ');

const mark = `
    <g filter="url(#drop)">
      <g transform="rotate(-6 100 104)">
        <rect x="46" y="36" width="116" height="144" rx="12" fill="#ddd5c0"/>
        <rect x="40" y="30" width="116" height="144" rx="12" fill="url(#paper)"/>
        ${[72, 96, 120, 144].map((y) => `<line x1="50" y1="${y}" x2="146" y2="${y}" stroke="#93b4ee" stroke-opacity=".75" stroke-width="2"/>`).join('')}
        <line x1="62" y1="48" x2="62" y2="166" stroke="#ef4444" stroke-opacity=".8" stroke-width="2.5"/>
      ${entries}
      ${rings}
      </g>
      <g transform="translate(152 140) rotate(135)">
        <rect x="-36" y="-7" width="62" height="14" fill="url(#wood)"/>
        <rect x="-36" y="-7" width="62" height="4.5" fill="#fff" opacity=".25"/>
        <rect x="-46" y="-7.5" width="11" height="15" rx="1.5" fill="url(#metal)" stroke="#64748b" stroke-width=".6"/>
        <rect x="-56" y="-7" width="12" height="14" rx="4" fill="#f472b6"/>
        <path d="M26 -7 L42 0 L26 7 Z" fill="#fde7b0"/>
        <path d="M36.5 -2.4 L42 0 L36.5 2.4 Z" fill="#334155"/>
      </g>
    </g>`;

// cx/cy: centro do desenho; s: escala; bg: 'full' (quadrado) ou 'round' (cantos arredondados)
function svg({ s, bg }) {
  const tx = (256 - 108 * s).toFixed(1), ty = (256 - 102 * s).toFixed(1);
  const back = bg === 'round'
    ? `<rect width="512" height="512" rx="112" fill="url(#bg)"/><rect width="512" height="512" rx="112" fill="url(#glow)"/>`
    : `<rect width="512" height="512" fill="url(#bg)"/><rect width="512" height="512" fill="url(#glow)"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>${defs}
  </defs>
  ${back}
  <g transform="translate(${tx} ${ty}) scale(${s})">${mark}
  </g>
</svg>
`;
}

fs.writeFileSync('public/icon.svg', svg({ s: 2.25, bg: 'full' }));
fs.writeFileSync('public/icon-maskable.svg', svg({ s: 1.8, bg: 'full' }));
fs.writeFileSync('public/favicon.svg', svg({ s: 2.45, bg: 'round' }));
console.log('ok');
