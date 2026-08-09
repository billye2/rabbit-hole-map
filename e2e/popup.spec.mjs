import { test, expect } from './fixtures.mjs';

// Seed a deterministic session straight into storage so the scoreboard
// numbers are exactly predictable.
const T0 = 1_700_000_000_000;
const SESSION = {
  id: String(T0),
  start: T0,
  end: T0 + 10 * 60_000, // 10 minutes wasted
  nodes: Object.fromEntries(
    [
      ['https://a.com/', 'Alpha', 1],
      ['https://b.com/', 'Beta', 1],
      ['https://b.com/two', 'Beta Two', 2],
    ].map(([url, title, visits]) => [
      url,
      { id: url, url, title, domain: new URL(url).hostname, firstVisit: T0, lastVisit: T0, visits },
    ]),
  ),
  edges: [
    { from: 'https://a.com/', to: 'https://b.com/', time: T0 + 60_000, transition: 'link' },
    { from: 'https://b.com/', to: 'https://b.com/two', time: T0 + 120_000, transition: 'link' },
  ],
};

test('popup scoreboard reports the session accurately', async ({ context, extensionId }) => {
  const seedPage = await context.newPage();
  await seedPage.goto(`chrome-extension://${extensionId}/src/map/map.html`);
  await seedPage.evaluate(
    (s) =>
      new Promise((res) =>
        chrome.storage.local.set(
          {
            ['session:' + s.id]: s,
            currentSessionId: s.id,
            sessionIndex: [{ id: s.id, start: s.start, end: s.end, pages: Object.keys(s.nodes).length }],
          },
          res,
        ),
      ),
    SESSION,
  );

  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/src/popup/popup.html`);
  await expect(popup.locator('#pages')).toHaveText('3');
  await expect(popup.locator('#hops')).toHaveText('2');
  await expect(popup.locator('#chain')).toHaveText('3 pages'); // a -> b -> b/two
  await expect(popup.locator('#domain')).toHaveText('b.com'); // 3 visits vs 1
  await expect(popup.locator('#wasted')).toContainText('10 min gloriously wasted');
});
