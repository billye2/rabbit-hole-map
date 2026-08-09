import { test, expect, openMap } from './fixtures.mjs';

test('untangle spreads nodes into lanes and toggles back to physics', async ({ context, extensionId, site }) => {
  const page = await context.newPage();
  await page.goto(site + '/');
  await Promise.all([page.waitForNavigation(), page.click('#to-b')]);
  await Promise.all([page.waitForNavigation(), page.click('#to-c')]);
  await page.goto(site + '/d');

  const map = await openMap(context, extensionId);
  await map.bringToFront();
  await expect(map.locator('#nodes .node')).toHaveCount(4);

  await map.click('#untangle');
  await expect(map.locator('#untangle')).toContainText('Physics');
  await new Promise((r) => setTimeout(r, 800));

  const minGap = await map.evaluate(() => {
    const pts = [...document.querySelectorAll('#nodes .node')].map((n) => {
      const cs = n.querySelectorAll('circle');
      const r = cs[cs.length - 1].getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });
    let min = Infinity;
    for (let i = 0; i < pts.length; i++)
      for (let j = i + 1; j < pts.length; j++) min = Math.min(min, Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y));
    return min;
  });
  expect(minGap).toBeGreaterThan(40);

  await map.click('#untangle');
  await expect(map.locator('#untangle')).toContainText('Untangle');
});
