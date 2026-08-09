import { test, expect, readSession, waitForNodes, openMap } from './fixtures.mjs';

test('builds the graph from a click chain, including cross-tab hops', async ({ context, extensionId, site }) => {
  const page = await context.newPage();
  await page.goto(site + '/');
  await Promise.all([page.waitForNavigation(), page.click('#to-b')]);
  await Promise.all([page.waitForNavigation(), page.click('#to-c')]);
  await page.goto(site + '/');
  const popupPromise = context.waitForEvent('page');
  await page.click('#to-d');
  await popupPromise;

  const probe = await openMap(context, extensionId);
  await waitForNodes(probe, 4);
  const session = await readSession(probe);

  expect(Object.keys(session.nodes)).toHaveLength(4);
  const has = (from, to) => session.edges.some((e) => e.from === site + from && e.to === site + to);
  expect(has('/', '/b')).toBe(true);
  expect(has('/b', '/c')).toBe(true);
  expect(has('/', '/d')).toBe(true); // via tab opener
  expect(Object.values(session.nodes).some((n) => n.title === 'Page C')).toBe(true);
});

test('URL fragments normalize onto one node', async ({ context, extensionId, site }) => {
  const page = await context.newPage();
  await page.goto(site + '/b');
  await page.goto(site + '/c');
  await page.goto(site + '/b#section'); // cross-document nav to a fragment URL

  const probe = await openMap(context, extensionId);
  await waitForNodes(probe, 2);
  const session = await readSession(probe);

  const urls = Object.keys(session.nodes);
  expect(urls.filter((u) => u.includes('/b'))).toEqual([site + '/b']);
  expect(session.nodes[site + '/b'].visits).toBe(2);
});

test('reloads do not inflate visits or add self-edges', async ({ context, extensionId, site }) => {
  const page = await context.newPage();
  await page.goto(site + '/b');
  const probe = await openMap(context, extensionId);
  await waitForNodes(probe, 1);
  const before = await readSession(probe);

  await page.reload();
  await page.reload();
  await new Promise((r) => setTimeout(r, 1000));

  const after = await readSession(probe);
  expect(after.nodes[site + '/b'].visits).toBe(before.nodes[site + '/b'].visits);
  expect(after.edges.some((e) => e.from === e.to)).toBe(false);
});
