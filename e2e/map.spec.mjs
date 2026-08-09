import { test, expect, openMap, waitForNodes, waitForTracked, dotCenter } from './fixtures.mjs';

async function browseChain(context, extensionId, site) {
  const probe = await openMap(context, extensionId);
  const page = await context.newPage();
  await page.goto(site + '/');
  await waitForTracked(probe, site + '/');
  await Promise.all([page.waitForNavigation(), page.click('#to-b')]);
  await waitForTracked(probe, site + '/b');
  await Promise.all([page.waitForNavigation(), page.click('#to-c')]);
  await waitForTracked(probe, site + '/c');
  await probe.close();
  return page;
}

test('renders the session as nodes and edges', async ({ context, extensionId, site }) => {
  await browseChain(context, extensionId, site);
  const map = await openMap(context, extensionId);
  await waitForNodes(map, 3);
  await map.reload();
  await expect(map.locator('#nodes .node')).toHaveCount(3);
  await expect(map.locator('#edges .edge')).toHaveCount(2);
});

test('double-clicking a node reopens the page in a new tab', async ({ context, extensionId, site }) => {
  await browseChain(context, extensionId, site);
  const map = await openMap(context, extensionId);
  await map.bringToFront();
  await expect(map.locator('#nodes .node')).not.toHaveCount(0);
  await new Promise((r) => setTimeout(r, 2500)); // settle

  const dot = await dotCenter(map, 'Page C');
  expect(dot).not.toBeNull();
  const opened = context.waitForEvent('page');
  await map.mouse.dblclick(dot.x, dot.y);
  const newTab = await opened;
  await newTab.waitForLoadState();
  expect(newTab.url()).toBe(site + '/c');
});

test('dragging pins a node where it was dropped; alt-click releases it', async ({ context, extensionId, site }) => {
  await browseChain(context, extensionId, site);
  const map = await openMap(context, extensionId);
  await map.bringToFront();
  await expect(map.locator('#nodes .node')).not.toHaveCount(0);
  await new Promise((r) => setTimeout(r, 2500));

  const before = await dotCenter(map, 'Page B');
  const drop = { x: before.x + 220, y: before.y + 120 };
  await map.mouse.move(before.x, before.y);
  await map.mouse.down();
  await map.mouse.move(drop.x, drop.y, { steps: 8 });
  await map.mouse.up();
  await new Promise((r) => setTimeout(r, 2500)); // let the sim settle again

  const after = await dotCenter(map, 'Page B');
  expect(Math.hypot(after.x - drop.x, after.y - drop.y)).toBeLessThan(10);
  const pinned = map.locator('#nodes .node.pinned');
  await expect(pinned).toHaveCount(1);

  // Alt-click hands it back to the physics.
  await map.keyboard.down('Alt');
  await map.mouse.click(after.x, after.y);
  await map.keyboard.up('Alt');
  await expect(pinned).toHaveCount(0);
});

test('hovering a HUD button shows its speech-bubble tooltip', async ({ context, extensionId, site }) => {
  await browseChain(context, extensionId, site);
  const map = await openMap(context, extensionId);
  await map.bringToFront();
  await map.hover('#export');
  await map.waitForFunction(() => {
    const st = getComputedStyle(document.getElementById('export'), '::after');
    return st.content.includes('Snapshot') && !st.transform.startsWith('matrix(0');
  });
});
