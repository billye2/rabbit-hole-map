import { test, expect, openMap } from './fixtures.mjs';

const rabbitScale = (map) =>
  map.evaluate(() => {
    const g = document.querySelector('#burrow-layer .rabbit');
    const m = /scale\(([-\d.]+)/.exec(g?.getAttribute('transform') ?? '');
    return m ? Math.abs(Number(m[1])) : 1;
  });

test('the rabbit roams the ground', async ({ context, extensionId, site }) => {
  const page = await context.newPage();
  await page.goto(site + '/');
  const map = await openMap(context, extensionId);
  await map.bringToFront();
  await expect(map.locator('#burrow-layer .rabbit')).toHaveCount(1);

  const moved = await map.evaluate(async () => {
    const g = document.querySelector('#burrow-layer .rabbit');
    // Include the inner squash group: an idle rabbit only "breathes".
    const snap = () => g.getAttribute('transform') + '|' + (g.querySelector('g')?.getAttribute('transform') ?? '');
    const t1 = snap();
    await new Promise((r) => setTimeout(r, 1200));
    return snap() !== t1;
  });
  expect(moved).toBe(true);
});

test('a live-added site drops a carrot and the rabbit eats it', async ({ context, extensionId, site }) => {
  const page = await context.newPage();
  await page.goto(site + '/');
  const map = await openMap(context, extensionId);
  await map.bringToFront();
  await expect(map.locator('#nodes .node')).not.toHaveCount(0);

  await page.goto(site + '/e'); // background tab; map keeps focus + rAF
  await expect(map.locator('#burrow-layer .carrot')).not.toHaveCount(0, { timeout: 8000 });
  await expect(map.locator('#burrow-layer .carrot')).toHaveCount(0, { timeout: 15000 });
});

test('the rabbit grows 25% after its 5th carrot', async ({ context, extensionId, site }) => {
  test.setTimeout(120_000);
  const page = await context.newPage();
  await page.goto(site + '/');
  const map = await openMap(context, extensionId);
  await map.bringToFront();
  await expect(map.locator('#nodes .node')).not.toHaveCount(0);

  for (const path of ['/b', '/c', '/d', '/e', '/f', '/g']) {
    await page.goto(site + path);
    await new Promise((r) => setTimeout(r, 700));
  }

  // Wait for the feast to finish and the milestone to land.
  await map.waitForFunction(
    () => {
      const g = document.querySelector('#burrow-layer .rabbit');
      const m = /scale\(([-\d.]+)/.exec(g?.getAttribute('transform') ?? '');
      const scale = m ? Math.abs(Number(m[1])) : 1;
      return scale >= 1.2 && document.querySelectorAll('#burrow-layer .carrot').length === 0;
    },
    { timeout: 90_000, polling: 500 }
  );
});

test('an unfed rabbit gets hungry and shrinks 10% after 30 seconds', async ({ context, extensionId, site }) => {
  test.setTimeout(180_000);
  const page = await context.newPage();
  await page.goto(site + '/');
  const map = await openMap(context, extensionId);
  await map.bringToFront();
  await expect(map.locator('#nodes .node')).not.toHaveCount(0);

  // Grow it to 1.25 first (5+ carrots).
  for (const path of ['/b', '/c', '/d', '/e', '/f', '/g']) {
    await page.goto(site + path);
    await new Promise((r) => setTimeout(r, 700));
  }
  await map.waitForFunction(
    () => document.querySelectorAll('#burrow-layer .carrot').length === 0,
    { timeout: 60_000, polling: 500 }
  );
  expect(await rabbitScale(map)).toBeGreaterThanOrEqual(1.2);

  // Starve it: one hunger tick (30s after the last meal) shrinks it 10%.
  await map.waitForFunction(
    () => {
      const g = document.querySelector('#burrow-layer .rabbit');
      const m = /scale\(([-\d.]+)/.exec(g?.getAttribute('transform') ?? '');
      return m && Math.abs(Number(m[1])) < 1.2;
    },
    { timeout: 45_000, polling: 1000 }
  );
  const shrunk = await rabbitScale(map);
  expect(shrunk).toBeGreaterThanOrEqual(1); // decays toward, never below, original
  expect(shrunk).toBeLessThan(1.2); // 1.25 -> 1.125 after the first tick
});
