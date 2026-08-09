import { test, expect, readSession, waitForNodes, waitForTracked, openMap } from './fixtures.mjs';

test('builds the graph from a click chain, including cross-tab hops', async ({ context, extensionId, site }) => {
  // Probe first, so each navigation can be confirmed flushed before the
  // next one fires (CI runners are slow enough to race otherwise).
  const probe = await openMap(context, extensionId);
  const page = await context.newPage();
  await page.goto(site + '/');
  await waitForTracked(probe, site + '/');
  await Promise.all([page.waitForNavigation(), page.click('#to-b')]);
  await waitForTracked(probe, site + '/b');
  await Promise.all([page.waitForNavigation(), page.click('#to-c')]);
  await waitForTracked(probe, site + '/c');
  await page.goto(site + '/');
  const popupPromise = context.waitForEvent('page');
  await page.click('#to-d');
  await popupPromise;

  await waitForNodes(probe, 4);
  const session = await readSession(probe);

  expect(Object.keys(session.nodes)).toHaveLength(4);
  const edgeDump = () => JSON.stringify(session.edges.map((e) => `${e.from}->${e.to}(${e.transition})`));
  const has = (from, to) => session.edges.some((e) => e.from === site + from && e.to === site + to);
  expect(has('/', '/b'), edgeDump()).toBe(true);
  expect(has('/b', '/c'), edgeDump()).toBe(true);
  expect(has('/', '/d'), edgeDump()).toBe(true); // via tab opener
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
