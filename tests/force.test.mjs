import test from 'node:test';
import assert from 'node:assert/strict';
import { ForceSim, hashSeed } from '../dist/force.mjs';

const N = (id, r = 10) => ({ id, r });
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const byId = (sim, id) => sim.nodes.find((n) => n.id === id);

test('hashSeed is deterministic and stays in [0, 1)', () => {
  assert.equal(hashSeed('https://a.com/'), hashSeed('https://a.com/'));
  for (const s of ['a', 'b', 'https://en.wikipedia.org/wiki/Trebuchet', '']) {
    const v = hashSeed(s);
    assert.ok(v >= 0 && v < 1, `${s} -> ${v}`);
  }
});

test('setGraph places new nodes deterministically around the center', () => {
  const a = new ForceSim(1000, 800);
  const b = new ForceSim(1000, 800);
  a.setGraph([N('x'), N('y')], []);
  b.setGraph([N('x'), N('y')], []);
  assert.deepEqual(
    a.nodes.map((n) => [n.id, n.x, n.y]),
    b.nodes.map((n) => [n.id, n.x, n.y]),
  );
  for (const n of a.nodes) {
    assert.ok(Math.abs(n.x - 500) <= 220, 'seeded near the horizontal center');
    assert.ok(Math.abs(n.y - 400) <= 220, 'seeded near the vertical center');
  }
});

test('setGraph keeps survivor positions, drops the missing, updates radii', () => {
  const sim = new ForceSim(1000, 800);
  sim.setGraph([N('a'), N('b'), N('c')], []);
  sim.place('a', 111, 222);
  sim.setGraph([N('a', 20), N('c')], []);
  assert.equal(sim.nodes.length, 2);
  assert.equal(byId(sim, 'a').x, 111);
  assert.equal(byId(sim, 'a').y, 222);
  assert.equal(byId(sim, 'a').r, 20);
  assert.equal(byId(sim, 'b'), undefined);
});

test('edges hold ids: removing an unrelated node cannot corrupt a spring', () => {
  const sim = new ForceSim(1000, 800);
  sim.setGraph([N('a'), N('b'), N('c')], [['b', 'c']]);
  // Stretch the spring pair far apart, park the unrelated node, re-set the
  // graph without it — the b~c spring must still act on b and c.
  sim.place('b', 100, 400);
  sim.place('c', 900, 400);
  sim.setGraph([N('b'), N('c')], [['b', 'c']]);
  const before = dist(byId(sim, 'b'), byId(sim, 'c'));
  for (let i = 0; i < 30; i++) sim.tick();
  const after = dist(byId(sim, 'b'), byId(sim, 'c'));
  assert.ok(after < before, `spring pulled ${before} -> ${after}`);
});

test('tick repels unconnected nodes and settles toward stillness', () => {
  const sim = new ForceSim(1000, 800);
  sim.setGraph([N('a'), N('b')], []);
  sim.place('a', 500, 400);
  sim.place('b', 503, 400);
  sim.tick();
  assert.ok(dist(byId(sim, 'a'), byId(sim, 'b')) > 3, 'near-coincident nodes pushed apart');
  let v = Infinity;
  for (let i = 0; i < 400; i++) v = sim.tick();
  assert.ok(v < 0.05, `settles (final max speed ${v})`);
});

test('place with pin freezes a node; release hands it back to the physics', () => {
  const sim = new ForceSim(1000, 800);
  sim.setGraph([N('a'), N('b')], [['a', 'b']]);
  sim.place('a', 200, 200, { pin: true });
  for (let i = 0; i < 10; i++) sim.tick();
  assert.equal(byId(sim, 'a').x, 200);
  assert.equal(byId(sim, 'a').y, 200);
  sim.release('a');
  for (let i = 0; i < 10; i++) sim.tick();
  assert.notEqual(byId(sim, 'a').x, 200, 'released node moves again');
});

test('pin freezes in place without supplying coordinates', () => {
  const sim = new ForceSim(1000, 800);
  sim.setGraph([N('a'), N('b')], []);
  const { x, y } = byId(sim, 'a');
  sim.pin('a');
  for (let i = 0; i < 5; i++) sim.tick();
  assert.equal(byId(sim, 'a').x, x);
  assert.equal(byId(sim, 'a').y, y);
  assert.equal(sim.has('a'), true);
  assert.equal(sim.has('ghost'), false);
});

test('resize retargets gravity: an off-center node drifts toward the new center', () => {
  const sim = new ForceSim(1000, 800);
  sim.setGraph([N('a')], []);
  sim.resize(2000, 800);
  const before = Math.abs(byId(sim, 'a').x - 1000);
  for (let i = 0; i < 200; i++) sim.tick();
  const after = Math.abs(byId(sim, 'a').x - 1000);
  assert.ok(after < before, `drifted toward new center: ${before} -> ${after}`);
});
