// Generates front-face.png: the base-gold rabbit (src/map/sprites/front-0.png)
// with a face painted on in the cannon form's style (dark-red eyes, dark
// nose). The sprite sheet's "front" strip was drawn faceless, which reads as
// a back view in the growth-ladder screenshot — the gameplay sprites stay
// untouched; this asset exists only for the marketing stage.
// Run: node marketing/stage/gen-front-face.mjs   (needs the CfT binary,
// override with CHROME_PATH — same as capture.mjs)
import puppeteer from 'puppeteer-core';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = dirname(dirname(HERE));
const CHROME =
  process.env.CHROME_PATH ??
  join(ROOT, '.cache/cft/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing');

const b = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  userDataDir: mkdtempSync(join(tmpdir(), 'rhm-face-')),
});
const p = await b.newPage();
const b64 = readFileSync(join(ROOT, 'src/map/sprites/front-0.png')).toString('base64');
const out = await p.evaluate(async (b64) => {
  const img = new Image();
  img.src = 'data:image/png;base64,' + b64;
  await img.decode();
  const c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.drawImage(img, 0, 0);
  // head is ~x38..84, y31..61 on the 103x139 frame
  g.fillStyle = '#7d1d12'; // cannon-style dark red eyes
  g.fillRect(49, 45, 6, 6);
  g.fillRect(63, 45, 6, 6);
  g.fillStyle = '#3a2410'; // small dark nose
  g.fillRect(57, 54, 5, 3);
  return c.toDataURL('image/png').split(',')[1];
}, b64);
writeFileSync(join(HERE, 'front-face.png'), Buffer.from(out, 'base64'));
await b.close();
console.log('✓ marketing/stage/front-face.png');
