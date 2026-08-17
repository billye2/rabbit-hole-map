// Rasterize icons/icon.svg (the white R on the orange tile) to the
// extension's PNG icon sizes. The SVG is the single source of truth — never
// hand-export sizes. (Replaced the hand-rolled analytic PNG encoder; same
// geometry, now editable as vector art. resvg pipeline as in pdfxtn.)
// Run: npm run icons
import { Resvg } from '@resvg/resvg-js';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const svg = readFileSync('icons/icon.svg', 'utf8');

mkdirSync('icons', { recursive: true });
for (const size of [16, 32, 48, 128]) {
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: size } }).render().asPng();
  writeFileSync(`icons/icon${size}.png`, png);
  console.log(`icons/icon${size}.png  (${png.length} bytes)`);
}
