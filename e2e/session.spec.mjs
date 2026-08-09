import { test, expect, openMap, readSession } from './fixtures.mjs';

test('a map opened on the empty state picks up a brand-new session live', async ({ context, extensionId, site }) => {
  const map = await openMap(context, extensionId);
  await map.bringToFront();
  await expect(map.locator('#empty')).toBeVisible();

  const page = await context.newPage();
  await page.goto(site + '/');
  await map.bringToFront();

  await expect(map.locator('#nodes .node')).not.toHaveCount(0, { timeout: 8000 });
  await expect(map.locator('#empty')).toBeHidden();
});

test('blocklisted domains are never recorded (via the real Options UI)', async ({ context, extensionId, site }) => {
  const options = await context.newPage();
  await options.goto(`chrome-extension://${extensionId}/src/options/options.html`);
  await options.fill('#blocklist', '127.0.0.1');
  await options.click('#save');
  await expect(options.locator('#saved')).toHaveClass(/show/);

  const page = await context.newPage();
  await page.goto(site + '/');
  await page.goto(site + '/b');
  await new Promise((r) => setTimeout(r, 1500));

  const session = await readSession(options);
  expect(session).toBeNull();
});

test('clear-all-data wipes every session and the map returns to PRESS START', async ({ context, extensionId, site }) => {
  const page = await context.newPage();
  await page.goto(site + '/');
  await page.goto(site + '/b');

  const map = await openMap(context, extensionId);
  await expect(map.locator('#nodes .node')).not.toHaveCount(0);

  const options = await context.newPage();
  await options.goto(`chrome-extension://${extensionId}/src/options/options.html`);
  options.on('dialog', (d) => d.accept());
  await options.click('#clear');
  await new Promise((r) => setTimeout(r, 800));

  const leftovers = await options.evaluate(async () => Object.keys(await chrome.storage.local.get(null)));
  expect(leftovers.filter((k) => k.startsWith('session:'))).toHaveLength(0);

  await map.reload();
  await expect(map.locator('#empty')).toBeVisible();
});
