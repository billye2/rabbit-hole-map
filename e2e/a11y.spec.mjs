// Accessibility tier: axe-core scans of every extension page. Failures are
// real defects — fix them or add a documented, dated exception below, never
// a silent disable.
import AxeBuilder from '@axe-core/playwright';
import { test, expect } from './fixtures.mjs';
import { seedFixedSession } from './visual-session.mjs';

// Documented exceptions. Keep this list empty-ish, dated, and per-element —
// never disable a whole rule.
//
// 2026-08-09: `.hole`/`.map` — the "Rabbit Hole Map" wordmark colors the two
// words cherry/grass on the cream HUD as brand identity (Nintendo palette is
// a product decision, see README Scope). The words are decorative repetition
// of the page title, so the contrast shortfall carries no information loss.
const EXCLUDED_SELECTORS = ['.hole', '.map'];

async function scan(page) {
  let builder = new AxeBuilder({ page });
  for (const sel of EXCLUDED_SELECTORS) builder = builder.exclude(sel);
  const results = await builder.analyze();
  return results.violations.map((v) => ({
    rule: v.id,
    impact: v.impact,
    nodes: v.nodes.map((n) => n.target.join(' ')).slice(0, 5),
  }));
}

test('options page has no axe violations', async ({ context, extensionId }) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/src/options/options.html`);
  expect(await scan(page)).toEqual([]);
});

test('popup has no axe violations (seeded session)', async ({ context, extensionId }) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/src/popup/popup.html`);
  await seedFixedSession(page);
  await page.reload();
  expect(await scan(page)).toEqual([]);
});

test('map page has no axe violations (seeded session)', async ({ context, extensionId }) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/src/map/map.html`);
  await seedFixedSession(page);
  await page.reload();
  await page.waitForSelector('#nodes .node');
  expect(await scan(page)).toEqual([]);
});
