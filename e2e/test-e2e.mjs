// End-to-end test: launches Chrome with the extension loaded, browses a
// small local site (same-tab links + a target=_blank hop), then opens the
// map page and asserts the graph contains the expected nodes and edges.
import puppeteer from 'puppeteer-core';
import http from 'node:http';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const EXT_DIR = dirname(dirname(fileURLToPath(import.meta.url)));
const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const SCREENSHOT = process.env.E2E_SCREENSHOT ?? join(tmpdir(), 'rabbit-hole-map.png');

const PAGES = {
  '/': `<!doctype html><title>Start Burrow</title><h1>Start</h1>
        <a id="to-b" href="/b">go to B</a>
        <a id="to-d" href="/d" target="_blank">open D in new tab</a>`,
  '/b': `<!doctype html><title>Page B</title><a id="to-c" href="/c">go to C</a>`,
  '/c': `<!doctype html><title>Page C</title><p>the bottom of the hole</p>`,
  '/d': `<!doctype html><title>Page D</title><p>side quest</p>`,
};

const server = http.createServer((req, res) => {
  const body = PAGES[req.url] ?? '<h1>404</h1>';
  res.writeHead(PAGES[req.url] ? 200 : 404, { 'content-type': 'text/html' });
  res.end(body);
});
await new Promise((res) => server.listen(0, '127.0.0.1', res));
const base = `http://127.0.0.1:${server.address().port}`;

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: false,
  userDataDir: mkdtempSync(join(tmpdir(), 'rhm-profile-')),
  defaultViewport: { width: 1280, height: 800 },
  args: [
    `--disable-extensions-except=${EXT_DIR}`,
    `--load-extension=${EXT_DIR}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--window-size=1280,800',
  ],
});

let failed = false;
try {
  // Find the extension id from its MV3 service worker.
  const swTarget = await browser.waitForTarget(
    (t) => t.type() === 'service_worker' && t.url().includes('background.js'),
    { timeout: 15000 }
  );
  const extId = new URL(swTarget.url()).host;
  console.log('extension id:', extId);

  const page = await browser.newPage();
  await page.goto(base + '/', { waitUntil: 'load' });

  // Same-tab chain: / -> /b -> /c
  await Promise.all([page.waitForNavigation(), page.click('#to-b')]);
  await Promise.all([page.waitForNavigation(), page.click('#to-c')]);

  // Cross-tab hop: back to /, then open /d via target=_blank.
  await page.goto(base + '/', { waitUntil: 'load' });
  const newTab = new Promise((res) =>
    browser.once('targetcreated', (t) => res(t))
  );
  await page.click('#to-d');
  const dTarget = await newTab;
  const dPage = await dTarget.page();
  if (dPage) await dPage.waitForSelector('p', { timeout: 5000 }).catch(() => {});

  // Give the service worker a beat to flush storage.
  await new Promise((r) => setTimeout(r, 1500));

  // Open the map and inspect the rendered graph.
  const map = await browser.newPage();
  await map.goto(`chrome-extension://${extId}/src/map/map.html`, { waitUntil: 'load' });
  await map.waitForSelector('#nodes .node', { timeout: 10000 });
  await new Promise((r) => setTimeout(r, 2500)); // let the layout settle

  const counts = await map.evaluate(() => ({
    nodes: document.querySelectorAll('#nodes .node').length,
    edges: document.querySelectorAll('#edges .edge').length,
    labels: [...document.querySelectorAll('#nodes .node text')].map((t) => t.textContent),
  }));
  console.log('rendered:', JSON.stringify(counts, null, 2));

  const session = await map.evaluate(async () => {
    const st = await chrome.storage.local.get(null);
    const id = st.currentSessionId;
    return st['session:' + id];
  });
  console.log('stored edges:', session.edges.map((e) => `${e.from} -> ${e.to} (${e.transition})`));

  const assert = (cond, msg) => {
    if (!cond) {
      failed = true;
      console.error('FAIL:', msg);
    } else {
      console.log('ok:', msg);
    }
  };

  assert(counts.nodes >= 4, `map shows >= 4 nodes (got ${counts.nodes})`);
  assert(counts.edges >= 3, `map shows >= 3 edges (got ${counts.edges})`);
  const has = (from, to) => session.edges.some((e) => e.from === base + from && e.to === base + to);
  assert(has('/', '/b'), 'edge / -> /b (link click)');
  assert(has('/b', '/c'), 'edge /b -> /c (link click)');
  assert(has('/', '/d'), 'edge / -> /d (cross-tab via opener)');
  assert(
    Object.values(session.nodes).some((n) => n.title === 'Page C'),
    'titles captured (Page C)'
  );

  // Double-clicking a node should reopen that page in a new tab.
  const dot = await map.evaluate(() => {
    const target = [...document.querySelectorAll('#nodes .node')].find((n) =>
      n.querySelector('text')?.textContent?.includes('Page C')
    );
    const circles = target.querySelectorAll('circle');
    const r = circles[circles.length - 1].getBoundingClientRect(); // the colored dot
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  await map.mouse.click(dot.x, dot.y, { clickCount: 2 });
  await new Promise((r) => setTimeout(r, 1500));
  const openUrls = (await browser.pages()).map((p) => p.url());
  assert(
    openUrls.filter((u) => u === base + '/c').length >= 1,
    `double-click on "Page C" node opened ${base}/c in a new tab`
  );

  // The double-click opened a tab that backgrounded the map; bring it back
  // like a real user would before interacting with it again.
  await map.bringToFront();
  await new Promise((r) => setTimeout(r, 1500)); // let the layout re-settle

  // Dragging a node should pin it: after the sim settles again it must stay
  // where it was dropped, not get pulled back toward the pack.
  const dotPos = async (label) =>
    map.evaluate((lbl) => {
      const target = [...document.querySelectorAll('#nodes .node')].find((n) =>
        n.querySelector('text')?.textContent?.includes(lbl)
      );
      const circles = target.querySelectorAll('circle');
      const r = circles[circles.length - 1].getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    }, label);

  const before = await dotPos('Page B');
  const drop = { x: before.x + 260, y: before.y + 140 };
  await map.mouse.move(before.x, before.y);
  await map.mouse.down();
  await map.mouse.move(drop.x, drop.y, { steps: 8 });
  await map.mouse.up();
  await new Promise((r) => setTimeout(r, 3000)); // let the sim settle again
  const after = await dotPos('Page B');
  const driftPx = Math.hypot(after.x - drop.x, after.y - drop.y);
  assert(driftPx < 10, `dragged node stays pinned where dropped (drift ${driftPx.toFixed(1)}px)`);
  const pinnedClass = await map.evaluate(() => {
    const t = [...document.querySelectorAll('#nodes .node')].find((n) =>
      n.querySelector('text')?.textContent?.includes('Page B')
    );
    return t?.classList.contains('pinned') ?? false;
  });
  assert(pinnedClass, 'dragged node (Page B) is marked pinned (gold ring)');

  // Hovering a button should reveal its speech-bubble tooltip.
  await map.hover('#export');
  await new Promise((r) => setTimeout(r, 700)); // tooltip delay + bounce-in
  const tipShown = await map.evaluate(() => {
    const st = getComputedStyle(document.getElementById('export'), '::after');
    return st.content.includes('Snapshot') && !st.transform.startsWith('matrix(0');
  });
  assert(tipShown, 'hovering Export shows its tooltip bubble');

  // Untangle should spread every node into its own lane, well apart.
  await map.click('#untangle');
  await new Promise((r) => setTimeout(r, 800));
  const spread = await map.evaluate(() => {
    const pts = [...document.querySelectorAll('#nodes .node')].map((n) => {
      const cs = n.querySelectorAll('circle');
      const r = cs[cs.length - 1].getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });
    let min = Infinity;
    for (let i = 0; i < pts.length; i++)
      for (let j = i + 1; j < pts.length; j++)
        min = Math.min(min, Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y));
    return { min, label: document.getElementById('untangle').textContent };
  });
  assert(spread.min > 40, `untangled nodes keep their distance (min gap ${spread.min.toFixed(1)}px)`);
  assert(spread.label.includes('Physics'), 'untangle button toggles to Physics');
  await map.click('#untangle'); // back to physics
  await map.mouse.move(640, 500); // park the cursor so no tooltip lingers
  await new Promise((r) => setTimeout(r, 600));

  await map.screenshot({ path: SCREENSHOT });
  console.log('screenshot:', SCREENSHOT);
} finally {
  await browser.close();
  server.close();
}

if (failed) {
  console.error('E2E FAILED');
  process.exit(1);
}
console.log('E2E PASSED');
