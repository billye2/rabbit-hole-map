// A fully deterministic seeded session for the visual-regression and a11y
// tiers: fixed timestamps (no Date.now, no randomness) so every render is
// pixel-stable. Same storage shape as marketing/session.mjs.
export function fixedSession() {
  const nodes = {};
  const edges = [];
  let time = Date.UTC(2026, 0, 15, 20, 0, 0); // 2026-01-15 12:00 PST
  const visit = (url, title, from, extraVisits = 0) => {
    time += 6 * 60e3;
    nodes[url] = {
      id: url,
      url,
      title,
      domain: new URL(url).hostname.replace(/^www\./, ''),
      firstVisit: time,
      lastVisit: time,
      visits: 1 + extraVisits,
    };
    if (from) edges.push({ from, to: url, time, transition: 'link' });
    return url;
  };

  const a = visit('https://example.com/start', 'Where it began', null);
  const b = visit('https://example.com/one', 'First hop', a);
  const c = visit('https://example.com/two', 'Second hop', b, 2);
  visit('https://example.com/side', 'Side quest', b);
  const d = visit('https://example.com/three', 'Third hop', c);
  visit('https://example.com/bottom', 'The bottom of the hole', d, 1);

  const start = Object.values(nodes).reduce((m, n) => Math.min(m, n.firstVisit), Infinity);
  return { id: String(start), start, end: time, nodes, edges };
}

export function seedFixedSession(page, session = fixedSession()) {
  return page.evaluate(
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
    session,
  );
}
