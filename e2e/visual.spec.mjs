// Visual-regression tier: screenshot assertions on the deterministic
// surfaces (fixed-timestamp session, pinned locale/TZ in fixtures.mjs).
// Baselines are darwin-only and committed; the tier is skipped on CI —
// run it locally before every release (`npx playwright test visual`).
// Regenerate on an intended UI change: npx playwright test visual --update-snapshots
import { test, expect } from './fixtures.mjs';
import { seedFixedSession } from './visual-session.mjs';

test.skip(!!process.env.CI, 'darwin-only baselines — run locally before release');

// The rabbit + carrots (#burrow-layer) are JS-animated from rAF and ROAM —
// a mask would follow their moving bounding box and flake, so the layer is
// hidden outright. CSS animations (clouds, empty-state hop) are disabled by
// config.
const hideRabbit = (page) => page.addStyleTag({ content: '#burrow-layer { display: none !important; }' });

test('map empty state (PRESS START)', async ({ context, extensionId }) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/src/map/map.html`);
  await page.waitForSelector('#empty:not([hidden])');
  await hideRabbit(page);
  await expect(page).toHaveScreenshot('map-empty.png');
});

test('map in untangle mode (seeded session)', async ({ context, extensionId }) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/src/map/map.html`);
  await seedFixedSession(page);
  await page.reload();
  await page.waitForSelector('#nodes .node');
  await page.click('#untangle'); // freezes every node onto the tidy grid
  await page.waitForTimeout(800); // zoom-to-fit transition
  await hideRabbit(page);
  await expect(page).toHaveScreenshot('map-untangle.png');
});

test('popup scoreboard (seeded session)', async ({ context, extensionId }) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/src/popup/popup.html`);
  await seedFixedSession(page);
  await page.reload();
  await expect(page).toHaveScreenshot('popup.png');
});

test('options page', async ({ context, extensionId }) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/src/options/options.html`);
  await expect(page).toHaveScreenshot('options.png');
});
