// Gera os PNGs do ícone do app a partir dos SVGs em public/ (rode: node scripts-gerar-icones.mjs)
import fs from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
const jobs = [
  ['public/icon.svg', 512, 'public/app-icon-512.png'],
  ['public/icon.svg', 192, 'public/app-icon-192.png'],
  ['public/icon.svg', 180, 'public/app-icon-180.png'],
  ['public/icon-maskable.svg', 512, 'public/app-icon-maskable-512.png'],
  ['public/icon-maskable.svg', 192, 'public/app-icon-maskable-192.png'],
  ['public/favicon.svg', 32, 'public/favicon-32.png'],
];
for (const [src, size, out] of jobs) {
  const png = new Resvg(fs.readFileSync(src, 'utf8'), { fitTo: { mode: 'width', value: size }, font: { loadSystemFonts: true, defaultFontFamily: 'Segoe UI' } }).render().asPng();
  fs.writeFileSync(out, png);
  console.log(out, png.length, 'bytes');
}
