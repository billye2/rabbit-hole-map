import test from 'node:test';
import assert from 'node:assert/strict';
import { eventTimeline, fitTransform, tidyLayout, trimmedEdge, untanglePositions, visibleGraph } from '../dist/view.mjs';
import { applyNavEvent, createSession } from '../dist/model.mjs';

function chainSession() {
  const s = createSession(0);
  const visit = (url, src, t) => applyNavEvent(s, { url, sourceUrl: src, time: t, transition: 'link' });
  visit('https://a.com/', null, 0);
  visit('https://b.com/', 'https://a.com/', 1000);
  visit('https://c.com/', 'https://b.com/', 2000);
  visit('https://d.com/', 'https://a.com/', 3000); // branch off a
  return s;
}

test('visibleGraph: the cutoff hides later nodes and their edges', () => {
  const s = chainSession();
  const early = visibleGraph(s, 999);
  assert.deepEqual(
    early.nodes.map((n) => n.id),
    ['https://a.com/'],
  );
  assert.equal(early.edges.length, 0);

  const mid = visibleGraph(s, 1000);
  assert.equal(mid.nodes.length, 2);
  assert.equal(mid.edges.length, 1);

  const all = visibleGraph(s, Infinity);
  assert.equal(all.nodes.length, 4);
  assert.equal(all.edges.length, 3);

  assert.deepEqual(visibleGraph(null, Infinity), { nodes: [], edges: [] });
});

test('eventTimeline: unique, sorted times of every visit and hop', () => {
  const s = chainSession();
  assert.deepEqual(eventTimeline(s), [0, 1000, 2000, 3000]);
  assert.deepEqual(eventTimeline(null), []);
});

test('tidyLayout: chains go right, branches get their own rows', () => {
  const s = chainSession();
  const g = tidyLayout(s);
  assert.equal(g['https://a.com/'].col, 0);
  assert.equal(g['https://b.com/'].col, 1);
  assert.equal(g['https://c.com/'].col, 2);
  assert.equal(g['https://d.com/'].col, 1);
  // the two leaves (c and d) sit on different rows — no overlap
  assert.notEqual(g['https://c.com/'].row, g['https://d.com/'].row);
  // no two nodes share a cell
  const cells = Object.values(g).map((p) => `${p.col}:${p.row}`);
  assert.equal(new Set(cells).size, cells.length);
});

test('tidyLayout: separate trees stack without colliding, back-edges cannot cycle', () => {
  const s = createSession(0);
  const visit = (url, src, t) => applyNavEvent(s, { url, sourceUrl: src, time: t, transition: 'link' });
  visit('https://a.com/', null, 0);
  visit('https://b.com/', 'https://a.com/', 1000);
  visit('https://a.com/', 'https://b.com/', 5000); // back to a — must not re-parent a under b
  visit('https://x.com/', null, 9000); // a second root/tree

  const g = tidyLayout(s);
  assert.equal(g['https://a.com/'].col, 0); // still a root
  assert.equal(Object.keys(g).length, 3);
  const cells = Object.values(g).map((p) => `${p.col}:${p.row}`);
  assert.equal(new Set(cells).size, cells.length);
});

test('untanglePositions: columns map left-to-right, every node gets its own point', () => {
  const pos = untanglePositions(chainSession());
  assert.ok(pos['https://a.com/'].x < pos['https://b.com/'].x);
  assert.ok(pos['https://b.com/'].x < pos['https://c.com/'].x);
  assert.equal(pos['https://b.com/'].x, pos['https://d.com/'].x); // same column
  assert.notEqual(pos['https://b.com/'].y, pos['https://d.com/'].y); // own lane
  const pts = Object.values(pos).map((p) => `${p.x}:${p.y}`);
  assert.equal(new Set(pts).size, pts.length);
});

test('fitTransform: the whole layout lands inside the viewport, below the HUD', () => {
  const points = [
    { x: 0, y: 0 },
    { x: 2000, y: 1000 },
  ];
  const vp = { width: 1000, height: 800, top: 90 };
  const t = fitTransform(points, vp);
  assert.ok(t.k < 1);
  for (const p of points) {
    const sx = p.x * t.k + t.x;
    const sy = p.y * t.k + t.y;
    assert.ok(sx >= 0 && sx <= vp.width, `x on screen: ${sx}`);
    assert.ok(sy >= vp.top && sy <= vp.height, `y below the HUD: ${sy}`);
  }
});

test('fitTransform: never zooms in past 1:1, and null on an empty layout', () => {
  const t = fitTransform([{ x: 400, y: 300 }], { width: 1000, height: 800, top: 90 });
  assert.equal(t.k, 1);
  assert.equal(fitTransform([], { width: 1000, height: 800, top: 90 }), null);
});

test('trimmedEdge shortens the line so the arrowhead lands on the rim', () => {
  const e = trimmedEdge({ x: 0, y: 0 }, { x: 100, y: 0, r: 10 });
  assert.deepEqual(e, { x1: 0, y1: 0, x2: 100 - 15, y2: 0 });
  const diag = trimmedEdge({ x: 0, y: 0 }, { x: 30, y: 40, r: 5 }); // 3-4-5, trim 10
  assert.ok(Math.abs(diag.x2 - 24) < 1e-9);
  assert.ok(Math.abs(diag.y2 - 32) < 1e-9);
});
