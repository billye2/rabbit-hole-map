// Generates every Chrome Web Store asset in marketing/store/ from the REAL
// extension UI — loads the built extension into Chrome for Testing, seeds a
// believable rabbit-hole session, and screenshots the live pages. Stills are
// rendered at 2x and downscaled with sips for crisp text (10block's trick).
//
//   node marketing/capture.mjs        # rebuild everything in store/
//
// Needs the Chrome for Testing binary (branded Chrome >= 137 refuses
// --load-extension); defaults to the repo-local .cache/cft copy, override
// with CHROME_PATH.
import puppeteer from 'puppeteer-core';
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { makeSession, seedSession } from './session.mjs';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const STORE = join(ROOT, 'marketing', 'store');
const CHROME =
  process.env.CHROME_PATH ??
  join(ROOT, '.cache/cft/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing');

mkdirSync(STORE, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function shoot(page, name, w, h) {
  const path = join(STORE, name);
  await page.screenshot({ path });
  execFileSync('sips', ['-z', String(h), String(w), path], { stdio: 'ignore' });
  console.log('✓', name);
}

// ---------- drive the real extension ----------
// (The demo session itself lives in session.mjs, shared with video.mjs.)
const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: false,
  userDataDir: mkdtempSync(join(tmpdir(), 'rhm-mkt-')),
  defaultViewport: { width: 1280, height: 800, deviceScaleFactor: 2 },
  args: [
    `--disable-extensions-except=${ROOT}`,
    `--load-extension=${ROOT}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--window-size=1400,1000',
  ],
});

try {
  const sw = await browser.waitForTarget((t) => t.type() === 'service_worker' && t.url().includes('background.js'), {
    timeout: 15000,
  });
  const extId = new URL(sw.url()).host;

  const map = await browser.newPage();
  await map.goto(`chrome-extension://${extId}/src/map/map.html`, { waitUntil: 'load' });

  // Seed the session and reload so the map opens on it.
  await seedSession(map, makeSession());
  await map.reload({ waitUntil: 'load' });
  await map.waitForSelector('#nodes .node');
  await sleep(4000); // let the layout settle

  // 1 — hero: the full constellation, live.
  await map.mouse.move(640, 760); // park the cursor away from the HUD
  await shoot(map, 'screenshot-1.png', 1280, 800);

  // 2 — untangle: the same session, one click later, every path in its lane.
  await map.click('#untangle');
  await map.mouse.move(640, 760);
  await sleep(1000);
  await shoot(map, 'screenshot-2.png', 1280, 800);
  await map.click('#untangle'); // back to physics
  await map.mouse.move(640, 760);
  await sleep(2500);

  // 3 — replay, mid-descent.
  await map.evaluate(() => {
    const r = document.getElementById('replay-range');
    r.value = String(Math.floor(Number(r.max) * 0.55));
    r.dispatchEvent(new Event('input'));
  });
  await sleep(1200);
  await shoot(map, 'screenshot-3.png', 1280, 800);
  await map.evaluate(() => {
    const r = document.getElementById('replay-range');
    r.value = r.max;
    r.dispatchEvent(new Event('input'));
  });
  await sleep(1500);

  // 4 — arrange the burrow: drag two nodes out (gold pins) + a tooltip.
  const grab = async (label, tx, ty) => {
    const p = await map.evaluate((lbl) => {
      const t = [...document.querySelectorAll('#nodes .node')].find((n) =>
        n.querySelector('text')?.textContent?.includes(lbl),
      );
      if (!t) return null;
      const cs = t.querySelectorAll('circle');
      const r = cs[cs.length - 1].getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    }, label);
    if (!p) return;
    await map.mouse.move(p.x, p.y);
    await map.mouse.down();
    await map.mouse.move(tx, ty, { steps: 10 });
    await map.mouse.up();
  };
  await grab('TREBUCHET', 1080, 620);
  await grab('easy carbonara', 200, 260);
  await sleep(2500);
  await map.hover('#export');
  await sleep(800);
  await shoot(map, 'screenshot-4.png', 1280, 800);

  // 5 — the popup scoreboard, staged large on the sky.
  const popup = await browser.newPage();
  await popup.goto(`chrome-extension://${extId}/src/popup/popup.html`, { waitUntil: 'load' });
  await popup.addStyleTag({
    content: `
      body { width: auto !important; min-height: 100vh; display: flex;
             align-items: center; justify-content: center; padding: 0 !important; }
      .card { transform: scale(1.9); }
    `,
  });
  await sleep(500);
  await shoot(popup, 'screenshot-5.png', 1280, 800);
  await popup.close();

  // Promo tiles from the stage page (sky + icon + wordmark, pure HTML/CSS).
  const stageUrl = pathToFileURL(join(ROOT, 'marketing/stage/promo.html')).href;
  const tile = await browser.newPage();
  await tile.setViewport({ width: 440, height: 280, deviceScaleFactor: 2 });
  await tile.goto(stageUrl + '?variant=tile', { waitUntil: 'load' });
  await sleep(400);
  await shoot(tile, 'promo-tile-440x280.png', 440, 280);
  await tile.setViewport({ width: 1400, height: 560, deviceScaleFactor: 2 });
  await tile.goto(stageUrl + '?variant=marquee', { waitUntil: 'load' });
  await sleep(400);
  await shoot(tile, 'marquee-1400x560.png', 1400, 560);
  await tile.close();
} finally {
  await browser.close();
}

// Store icon: the shipped 128px icon is the store icon.
copyFileSync(join(ROOT, 'icons/icon128.png'), join(STORE, 'store-icon-128.png'));
console.log('✓ store-icon-128.png');
console.log('\nall assets in marketing/store/');
