// Records the Chrome Web Store promo video in one take from the REAL
// extension — no post-production. Playwright's bundled Chromium loads the
// built extension, the shared demo session is seeded, and a scripted tour
// (replay run, untangle, drag-to-pin, tooltip) plays out with an injected
// cursor and caption pills. The page's own WebM recording is the deliverable.
//
//   npm run assets:video     # build + record marketing/store/promo-video.webm
//
// The store wants a YouTube URL, not a file: upload the webm and record the
// link in docs/STORE_LISTING.md.
import { chromium } from '@playwright/test';
import { copyFileSync, mkdtempSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeSession, seedSession } from './session.mjs';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const OUT = join(ROOT, 'marketing', 'store', 'promo-video.webm');
// Own tmp subdir for the raw recording — never share output dirs between scripts.
const RAW = mkdtempSync(join(tmpdir(), 'rhm-video-'));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const context = await chromium.launchPersistentContext('', {
  channel: 'chromium',
  viewport: { width: 1280, height: 800 },
  recordVideo: { dir: RAW, size: { width: 1280, height: 800 } },
  args: [`--disable-extensions-except=${ROOT}`, `--load-extension=${ROOT}`, '--no-first-run'],
});

try {
  let [sw] = context.serviceWorkers();
  if (!sw) sw = await context.waitForEvent('serviceworker');
  const extId = new URL(sw.url()).host;

  const map = context.pages()[0] ?? (await context.newPage());
  await map.goto(`chrome-extension://${extId}/src/map/map.html`);
  await seedSession(map, makeSession());
  await map.reload();
  await map.waitForSelector('#nodes .node');

  // Cursor + caption overlays, styled with the map's own HUD tokens.
  await map.evaluate(() => {
    const style = document.createElement('style');
    style.textContent = `
      #promo-cursor {
        position: fixed; left: 640px; top: 700px; width: 22px; height: 22px;
        border-radius: 50% 50% 50% 4px; background: #fff;
        border: 3px solid var(--ink); box-shadow: 0 3px 0 rgba(43,40,87,0.4);
        transform: translate(-4px, -2px) rotate(-45deg);
        pointer-events: none; z-index: 9999;
      }
      #promo-caption {
        position: fixed; left: 50%; bottom: 42px; transform: translateX(-50%);
        background: var(--hud); color: var(--ink); border: 3px solid var(--ink);
        border-radius: 999px; box-shadow: 0 4px 0 var(--ink);
        padding: 12px 26px; font-size: 21px; font-weight: 800;
        letter-spacing: 0.02em; white-space: nowrap;
        opacity: 0; transition: opacity 0.35s; pointer-events: none; z-index: 9998;
      }
      #promo-caption.show { opacity: 1; }
    `;
    document.head.append(style);
    const cur = document.createElement('div');
    cur.id = 'promo-cursor';
    document.body.append(cur);
    const cap = document.createElement('div');
    cap.id = 'promo-caption';
    document.body.append(cap);
    addEventListener(
      'mousemove',
      (e) => {
        cur.style.left = e.clientX + 'px';
        cur.style.top = e.clientY + 'px';
      },
      true,
    );
  });

  const caption = async (text) => {
    await map.evaluate((t) => {
      const cap = document.getElementById('promo-caption');
      if (t) cap.textContent = t;
      cap.classList.toggle('show', !!t);
    }, text);
  };

  // Trusted CDP mouse moves (the fake cursor follows via mousemove), paced
  // so the glide is visible on film.
  let cx = 640;
  let cy = 700;
  const glide = async (x, y, ms = 500) => {
    const steps = Math.max(2, Math.round(ms / 16));
    for (let i = 1; i <= steps; i++) {
      await map.mouse.move(cx + ((x - cx) * i) / steps, cy + ((y - cy) * i) / steps);
      await sleep(ms / steps);
    }
    cx = x;
    cy = y;
  };
  const glideTo = async (selector, ms) => {
    const box = await map.locator(selector).boundingBox();
    await glide(box.x + box.width / 2, box.y + box.height / 2, ms);
  };
  const dot = (label) =>
    map.evaluate((lbl) => {
      const t = [...document.querySelectorAll('#nodes .node')].find((n) =>
        n.querySelector('text')?.textContent?.includes(lbl),
      );
      if (!t) return null;
      const cs = t.querySelectorAll('circle');
      const r = cs[cs.length - 1].getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    }, label);

  // ---------- the take: ~32s, five beats, same story as the screenshots ----

  // Beat 1 — hero: the settled constellation.
  await sleep(2500);
  await caption('One innocent search. Thirteen pages later…');
  await sleep(3200);

  // Beat 2 — the real replay run (650ms per hop, ~9s for this session).
  await caption('Replay your descent, hop by hop');
  await glideTo('#replay-play', 700);
  await map.mouse.down();
  await map.mouse.up();
  await sleep(1000);
  await map.waitForFunction(() => document.getElementById('replay-play').textContent.includes('Replay'), {
    timeout: 30_000,
  });
  await sleep(1200);

  // Beat 3 — untangle into lanes, then back to physics.
  await caption('Untangle every path into tidy lanes');
  await glideTo('#untangle', 700);
  await map.mouse.down();
  await map.mouse.up();
  await sleep(2800);
  await map.mouse.down();
  await map.mouse.up();
  await sleep(1800);

  await sleep(1200); // extra settle after untangle-back before measuring nodes

  // Beat 4 — two symmetric drags (same as screenshot-4): one drag alone
  // yanks the whole force sim into a corner; opposing pins balance it.
  await caption('Drag to pin the moments that mattered');
  const grab = async (label, tx, ty) => {
    let p = await dot(label);
    if (!p) return;
    await glide(p.x, p.y, 600);
    p = await dot(label); // the sim keeps moving — re-measure before grabbing
    await map.mouse.move(p.x, p.y);
    cx = p.x;
    cy = p.y;
    await map.mouse.down();
    await glide(tx, ty, 800);
    await map.mouse.up();
  };
  await grab('TREBUCHET', 1080, 620);
  await grab('easy carbonara', 200, 260);
  await sleep(1800);

  // Beat 5 — tooltip + rabbit, then the title card caption.
  await caption('Hover any page — your rabbit keeps score');
  const rome = await dot('Rome');
  if (rome) {
    await glide(rome.x, rome.y, 700);
    const p = await dot('Rome');
    if (p) await glide(p.x, p.y, 150);
  }
  await sleep(2600);
  await glide(640, 760, 600);
  await caption('🐇 Rabbit Hole Map — follow the rabbit');
  await sleep(3500);
  await caption(null);
  await sleep(700);
} finally {
  // Closing a persistent context also closes the browser, which kills the
  // CDP transport video.saveAs() would need — the recording is picked up
  // from RAW below instead. (On failure RAW is left behind for inspection.)
  await context.close();
}

// The finalized recording: largest .webm in RAW = the map page.
const files = readdirSync(RAW)
  .filter((f) => f.endsWith('.webm'))
  .map((f) => join(RAW, f))
  .sort((a, b) => statSync(b).size - statSync(a).size);
if (!files.length) throw new Error('no recording found in ' + RAW);
copyFileSync(files[0], OUT);
rmSync(RAW, { recursive: true, force: true });
console.log('✓ promo-video.webm');

console.log('\nnext: upload to YouTube, paste the URL into docs/STORE_LISTING.md');
