// Playwright fixtures (10block's pattern): a persistent Chromium context
// with the unpacked extension loaded, the extension id resolved from its
// MV3 service worker, and a local test site to browse.
import { test as base, chromium, expect } from '@playwright/test';
import http from 'node:http';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const EXTENSION_PATH = dirname(dirname(fileURLToPath(import.meta.url)));

const PAGES = {
  '/': `<!doctype html><title>Start Burrow</title><h1>Start</h1>
        <a id="to-b" href="/b">go to B</a>
        <a id="to-d" href="/d" target="_blank">open D in new tab</a>`,
  '/b': `<!doctype html><title>Page B</title><a id="to-c" href="/c">go to C</a>
         <a id="to-b-frag" href="/b#section">fragment link</a>`,
  '/c': `<!doctype html><title>Page C</title><p>the bottom of the hole</p>`,
  '/d': `<!doctype html><title>Page D</title><p>side quest</p>`,
  '/e': `<!doctype html><title>Page E</title><p>fresh carrot bait</p>`,
  '/f': `<!doctype html><title>Page F</title><p>more bait</p>`,
  '/g': `<!doctype html><title>Page G</title><p>even more bait</p>`,
};

export const test = base.extend({
  context: async ({}, use) => {
    const context = await chromium.launchPersistentContext('', {
      channel: 'chromium',
      args: [
        `--disable-extensions-except=${EXTENSION_PATH}`,
        `--load-extension=${EXTENSION_PATH}`,
        '--no-first-run',
      ],
    });
    await use(context);
    await context.close();
  },

  serviceWorker: async ({ context }, use) => {
    let [sw] = context.serviceWorkers();
    if (!sw) sw = await context.waitForEvent('serviceworker');
    await use(sw);
  },

  extensionId: async ({ serviceWorker }, use) => {
    await use(new URL(serviceWorker.url()).host);
  },

  // Local site to browse during tests; `site` is its base URL.
  site: async ({}, use) => {
    const server = http.createServer((req, res) => {
      const body = PAGES[req.url] ?? '<h1>404</h1>';
      res.writeHead(PAGES[req.url] ? 200 : 404, { 'content-type': 'text/html' });
      res.end(body);
    });
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    await use(`http://127.0.0.1:${server.address().port}`);
    server.close();
  },
});

export { expect };

// ---------- shared helpers ----------

export async function openMap(context, extensionId) {
  const map = await context.newPage();
  await map.goto(`chrome-extension://${extensionId}/src/map/map.html`);
  return map;
}

export async function readSession(page) {
  return page.evaluate(async () => {
    const st = await chrome.storage.local.get(null);
    return st.currentSessionId ? st['session:' + st.currentSessionId] : null;
  });
}

// Waits until the background has flushed at least `n` nodes into storage.
export async function waitForNodes(page, n, timeout = 8000) {
  await page.waitForFunction(
    async (want) => {
      const st = await chrome.storage.local.get(null);
      const s = st.currentSessionId ? st['session:' + st.currentSessionId] : null;
      return s && Object.keys(s.nodes).length >= want;
    },
    n,
    { timeout }
  );
}

export function dotCenter(map, label) {
  return map.evaluate((lbl) => {
    const t = [...document.querySelectorAll('#nodes .node')].find((n) =>
      n.querySelector('text')?.textContent?.includes(lbl)
    );
    if (!t) return null;
    const cs = t.querySelectorAll('circle');
    const r = cs[cs.length - 1].getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  }, label);
}
