import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SESSION_GAP_MS,
  applyNavEvent,
  createSession,
  longestChain,
  needsNewSession,
  normalizeUrl,
  shouldTrack,
  topDomain,
  updateTitle,
} from '../dist/model.mjs';

test('normalizeUrl strips fragments, keeps query', () => {
  assert.equal(normalizeUrl('https://en.wikipedia.org/wiki/Rabbit#Diet'), 'https://en.wikipedia.org/wiki/Rabbit');
  assert.equal(normalizeUrl('https://a.com/x?q=1#frag'), 'https://a.com/x?q=1');
  assert.equal(normalizeUrl('not a url'), 'not a url');
});

test('shouldTrack rejects non-http and blocklisted domains (incl. subdomains)', () => {
  assert.equal(shouldTrack('https://example.com/', []), true);
  assert.equal(shouldTrack('chrome://extensions', []), false);
  assert.equal(shouldTrack('about:blank', []), false);
  assert.equal(shouldTrack('https://bank.com/x', ['bank.com']), false);
  assert.equal(shouldTrack('https://secure.bank.com/x', ['bank.com']), false);
  assert.equal(shouldTrack('https://www.bank.com/x', ['bank.com']), false);
  assert.equal(shouldTrack('https://notbank.com/x', ['bank.com']), true);
});

test('a 30-minute gap starts a new session', () => {
  const t0 = 1_000_000;
  const s = createSession(t0);
  applyNavEvent(s, { url: 'https://a.com/', sourceUrl: null, time: t0, transition: 'typed' });
  assert.equal(needsNewSession(s, t0 + SESSION_GAP_MS), false);
  assert.equal(needsNewSession(s, t0 + SESSION_GAP_MS + 1), true);
  assert.equal(needsNewSession(null, t0), true);
});

test('applyNavEvent builds nodes and edges, skips self-loops and rapid duplicates', () => {
  const s = createSession(0);
  applyNavEvent(s, { url: 'https://a.com/', sourceUrl: null, time: 0, transition: 'typed' });
  applyNavEvent(s, { url: 'https://b.com/', sourceUrl: 'https://a.com/', time: 100, transition: 'link' });
  // duplicate within 2s window
  applyNavEvent(s, { url: 'https://b.com/', sourceUrl: 'https://a.com/', time: 600, transition: 'link' });
  // self-loop
  applyNavEvent(s, { url: 'https://b.com/', sourceUrl: 'https://b.com/', time: 700, transition: 'link' });
  // edge from unknown source is dropped
  applyNavEvent(s, { url: 'https://c.com/', sourceUrl: 'https://ghost.com/', time: 800, transition: 'link' });

  assert.equal(Object.keys(s.nodes).length, 3);
  assert.equal(s.edges.length, 1);
  assert.deepEqual([s.edges[0].from, s.edges[0].to], ['https://a.com/', 'https://b.com/']);
  assert.equal(s.nodes['https://b.com/'].visits, 3);
  assert.equal(s.end, 800);
});

test('updateTitle patches only known nodes', () => {
  const s = createSession(0);
  applyNavEvent(s, { url: 'https://a.com/', sourceUrl: null, time: 0, transition: 'typed' });
  assert.equal(updateTitle(s, 'https://a.com/#frag', 'Page A'), true);
  assert.equal(s.nodes['https://a.com/'].title, 'Page A');
  assert.equal(updateTitle(s, 'https://nope.com/', 'X'), false);
});

test('longestChain follows time-ordered hops', () => {
  const s = createSession(0);
  const visit = (url, src, t) => applyNavEvent(s, { url, sourceUrl: src, time: t, transition: 'link' });
  visit('https://a.com/', null, 0);
  visit('https://b.com/', 'https://a.com/', 10_000);
  visit('https://c.com/', 'https://b.com/', 20_000);
  visit('https://d.com/', 'https://a.com/', 30_000); // branch, shorter
  assert.equal(longestChain(s), 3);
});

test('topDomain weighs by visits', () => {
  const s = createSession(0);
  applyNavEvent(s, { url: 'https://a.com/1', sourceUrl: null, time: 0, transition: 'typed' });
  applyNavEvent(s, { url: 'https://b.com/1', sourceUrl: null, time: 5_000, transition: 'typed' });
  applyNavEvent(s, { url: 'https://b.com/2', sourceUrl: null, time: 10_000, transition: 'typed' });
  assert.equal(topDomain(s), 'b.com');
});
