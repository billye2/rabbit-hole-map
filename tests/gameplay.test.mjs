import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GROUND_LIFT,
  HUNGER_INTERVAL_MS,
  displaySize,
  hungerShrink,
  initialRabbitState,
  rabbitStages,
  stepRabbit,
} from '../dist/gameplay.mjs';

const VIEW = { width: 1000, height: 600 };
const GROUND_Y = VIEW.height - GROUND_LIFT;
const input = (now, over = {}) => ({ now, rng: () => 0.5, viewport: VIEW, drops: [], ...over });

// A landed carrot sitting at screen-x `x`, ready to be chased or eaten.
const landedCarrot = (id, x) => ({ id, x, y: GROUND_Y - 18, vy: 0, rot: 0, vrot: 0, landed: true, bites: 0 });

test('initial rabbit idles at 30% of the viewport width', () => {
  const s = initialRabbitState(VIEW);
  assert.equal(s.mode, 'idle');
  assert.equal(s.x, VIEW.width * 0.3);
  assert.equal(s.sizeScale, 1);
  assert.equal(s.eaten, 0);
});

test('a dropped carrot falls, lands tip-down on the grass, and startles the rabbit', () => {
  let s = { ...initialRabbitState(VIEW), modeUntil: Infinity }; // rest forever: isolate the drop
  let r = stepRabbit(s, input(1000, { drops: [{ x: 500, y: 100 }] }));
  assert.equal(r.state.carrots.length, 1);
  assert.equal(r.state.carrots[0].landed, false);
  let t = 1000;
  while (!r.state.carrots[0].landed && t < 30_000) {
    t += 16;
    r = stepRabbit(r.state, input(t));
  }
  assert.equal(r.state.carrots[0].landed, true);
  assert.equal(r.state.carrots[0].y, GROUND_Y - 18); // tip (17px below origin) rests on the grass
  assert.equal(r.state.mode, 'alert'); // "!" moment before the chase
});

test('drop positions are clamped inside the viewport', () => {
  const s = { ...initialRabbitState(VIEW), modeUntil: Infinity };
  const r = stepRabbit(s, {
    ...input(1000),
    drops: [
      { x: 5, y: 100 },
      { x: 995, y: 100 },
    ],
  });
  assert.equal(r.state.carrots[0].x, 24);
  assert.equal(r.state.carrots[1].x, VIEW.width - 24);
});

test('a carrot landing mid-frenzy skips the startle: monsters are not surprised', () => {
  let s = { ...initialRabbitState(VIEW), modeUntil: Infinity, frenzyUntil: Infinity };
  let r = stepRabbit(s, input(1000, { drops: [{ x: 500, y: 100 }] }));
  let t = 1000;
  while (!r.state.carrots[0].landed && t < 30_000) {
    t += 16;
    r = stepRabbit(r.state, input(t));
  }
  assert.equal(r.state.mode, 'chase');
});

test('full journey: chase, eat in 3 bites, hunger clock resets to the last bite', () => {
  let s = { ...initialRabbitState(VIEW), modeUntil: Infinity };
  let r = stepRabbit(s, input(1000, { drops: [{ x: 600, y: 100 }] }));
  let t = 1000;
  let nibbles = 0;
  let lastNibbleAt = 0;
  while (r.state.carrots.length > 0 && t < 60_000) {
    t += 16;
    r = stepRabbit(r.state, input(t));
    if (r.events.includes('nibble')) {
      nibbles++;
      lastNibbleAt = t;
    }
  }
  assert.equal(r.state.carrots.length, 0, 'carrot fully eaten');
  assert.equal(nibbles, 3);
  assert.equal(r.state.eaten, 1);
  assert.equal(r.state.eatingId, null);
  // Fed: the 30s starvation countdown restarts from the meal, not from page load.
  assert.equal(r.state.nextHungerAt, lastNibbleAt + HUNGER_INTERVAL_MS);
});

test('chase locks one target: a nearer carrot does not cause dithering', () => {
  const s = {
    ...initialRabbitState(VIEW),
    mode: 'chase',
    chasingId: 1,
    x: 500,
    carrots: [landedCarrot(1, 400), landedCarrot(2, 490)], // #2 is closer
  };
  const r = stepRabbit(s, input(1000));
  assert.equal(r.state.chasingId, 1, 'stays locked on the original target');
  assert.ok(r.state.hopTo < r.state.x || r.state.midHop, 'hops toward the locked carrot');
});

test('arrival is a tolerance band and the rabbit turns to face its meal', () => {
  const s = {
    ...initialRabbitState(VIEW),
    mode: 'chase',
    chasingId: 7,
    x: 500,
    dir: -1, // facing away — must not matter for arrival, must flip for eating
    carrots: [landedCarrot(7, 510)],
  };
  const r = stepRabbit(s, input(1000));
  assert.equal(r.state.mode, 'eat');
  assert.equal(r.state.eatingId, 7);
  assert.equal(r.state.dir, 1);
});

test('bites arrive on the 260ms clock (stage 0)', () => {
  const s = {
    ...initialRabbitState(VIEW),
    mode: 'eat',
    eatingId: 3,
    x: 300,
    lastBite: 1000,
    nextHungerAt: Infinity,
    carrots: [landedCarrot(3, 300)],
  };
  const early = stepRabbit(s, input(1259));
  assert.ok(!early.events.includes('nibble'));
  const onTime = stepRabbit(s, input(1260));
  assert.ok(onTime.events.includes('nibble'));
  assert.equal(onTime.state.carrots[0].bites, 1);
});

test('frenzy halves the bite interval', () => {
  const s = {
    ...initialRabbitState(VIEW),
    mode: 'eat',
    eatingId: 3,
    x: 300,
    lastBite: 1000,
    frenzyUntil: Infinity,
    nextHungerAt: Infinity,
    carrots: [landedCarrot(3, 300)],
  };
  const early = stepRabbit(s, input(1129));
  assert.ok(!early.events.includes('nibble'));
  const onTime = stepRabbit(s, input(1130)); // 260 / 2
  assert.ok(onTime.events.includes('nibble'));
});

// CHARACTERIZATION of the real growth rule (formerly rabbit.ts:362): a milestone
// multiplies the rabbit's CURRENT size by 1.25 per stage gained. The rule is
// path-dependent — hunger shrink between milestones carries forward. The old
// model.rabbitGrowth().scale (deleted, was dead in production) recomputed
// 1.25^stages from scratch and would give 1.5625 here.
test('milestone growth compounds on the current, possibly hunger-shrunken, size', () => {
  const s = {
    ...initialRabbitState(VIEW),
    mode: 'eat',
    eatingId: 5,
    x: 300,
    eaten: 9, // next carrot is the 10th: second milestone
    stages: 1,
    sizeScale: 1.125, // grew to 1.25 at stage 1, then one hunger tick
    lastBite: 0,
    nextHungerAt: Infinity,
    carrots: [{ ...landedCarrot(5, 300), bites: 2 }], // one bite from done
  };
  const r = stepRabbit(s, input(1000));
  assert.equal(r.state.eaten, 10);
  assert.equal(r.state.stages, 2);
  assert.equal(r.state.sizeScale, 1.125 * 1.25); // 1.40625 — not 1.25 ** 2
  assert.ok(r.events.includes('roar'), 'milestone unleashes the monster');
  assert.equal(r.state.frenzyUntil, 1000 + 10_000);
});

test('an unfed rabbit shrinks 10% every 30s, and the clock keeps ticking at the floor', () => {
  const s = {
    ...initialRabbitState(VIEW),
    modeUntil: Infinity,
    stages: 1,
    sizeScale: 1.25,
    nextHungerAt: 5000,
  };
  let r = stepRabbit(s, input(5000));
  assert.equal(r.state.sizeScale, 1.125);
  assert.ok(r.events.includes('shrink'));
  assert.equal(r.state.nextHungerAt, 5000 + HUNGER_INTERVAL_MS);

  // At the original size the clock still advances but nothing shrinks or plays.
  r = stepRabbit({ ...r.state, sizeScale: 1 }, input(r.state.nextHungerAt));
  assert.equal(r.state.sizeScale, 1);
  assert.ok(!r.events.includes('shrink'));
  assert.equal(r.state.nextHungerAt, 5000 + 2 * HUNGER_INTERVAL_MS);
});

test('the ground never becomes a carrot warehouse: capped at 12, oldest evicted', () => {
  const s = { ...initialRabbitState(VIEW), modeUntil: Infinity };
  const drops = Array.from({ length: 13 }, (_, i) => ({ x: 100 + i * 60, y: 100 }));
  const r = stepRabbit(s, input(1000, { drops }));
  assert.equal(r.state.carrots.length, 12);
  const ids = r.state.carrots.map((c) => c.id);
  assert.ok(!ids.includes(1), 'the first-dropped carrot was evicted');
});

test('a rested rabbit picks a roam target from the rng', () => {
  const s = { ...initialRabbitState(VIEW), modeUntil: 0 };
  const r = stepRabbit(s, input(1000));
  assert.equal(r.state.mode, 'roam');
  assert.equal(r.state.roamTarget, 40 + 0.5 * (VIEW.width - 80));
});

test('stepRabbit returns a new state and leaves its input untouched', () => {
  const s = { ...initialRabbitState(VIEW), modeUntil: Infinity };
  const frozen = JSON.stringify(s);
  const r = stepRabbit(s, input(1000, { drops: [{ x: 500, y: 100 }] }));
  assert.notEqual(r.state, s);
  assert.equal(JSON.stringify(s), frozen);
});

test('displaySize: grow pulse overshoots, then settles back to the true size', () => {
  const s = { ...initialRabbitState(VIEW), sizeScale: 2, growPulseAt: 100 };
  const mid = displaySize(s, 100 + 225); // sin peak of the 450ms pulse
  assert.ok(Math.abs(mid - 2 * 1.18) < 1e-9);
  assert.equal(displaySize(s, 100 + 450), 2);
});

test('rabbitStages: milestones at 5/10/20/40/60, capped', () => {
  assert.equal(rabbitStages(0), 0);
  assert.equal(rabbitStages(4), 0);
  assert.equal(rabbitStages(5), 1);
  assert.equal(rabbitStages(60), 5);
  assert.equal(rabbitStages(500), 5);
});

test('hungerShrink: -10% per tick, converges to exactly 1 and stays there', () => {
  assert.equal(hungerShrink(1.25), 1.125);
  let s = 1.25 ** 2;
  for (let i = 0; i < 10; i++) s = hungerShrink(s);
  assert.equal(s, 1);
  assert.equal(hungerShrink(1), 1);
});
