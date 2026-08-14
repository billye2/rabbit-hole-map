import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GROUND_LIFT,
  HUNGER_INTERVAL_MS,
  MAX_CRATES,
  crateTier,
  displaySize,
  hungerShrink,
  initialRabbitState,
  mechPhase,
  stepRabbit,
} from '../dist/gameplay.mjs';

const VIEW = { width: 1000, height: 600 };
const GROUND_Y = VIEW.height - GROUND_LIFT;
const input = (now, over = {}) => ({ now, rng: () => 0.5, viewport: VIEW, drops: [], ...over });

// A landed crate sitting at screen-x `x`, ready to be chased or cranked open.
const landedCrate = (id, x) => ({ id, x, y: GROUND_Y - 18, vy: 0, rot: 0, vrot: 0, landed: true, cranks: 0, tier: 1 });

test('initial rabbit idles at 30% of the viewport width', () => {
  const s = initialRabbitState(VIEW);
  assert.equal(s.mode, 'idle');
  assert.equal(s.x, VIEW.width * 0.3);
  assert.equal(s.sizeScale, 1);
  assert.equal(s.opened, 0);
});

test('a dropped crate falls, lands base-down on the grass, and startles the rabbit', () => {
  let s = { ...initialRabbitState(VIEW), modeUntil: Infinity }; // rest forever: isolate the drop
  let r = stepRabbit(s, input(1000, { drops: [{ x: 500, y: 100 }] }));
  assert.equal(r.state.crates.length, 1);
  assert.equal(r.state.crates[0].landed, false);
  let t = 1000;
  while (!r.state.crates[0].landed && t < 30_000) {
    t += 16;
    r = stepRabbit(r.state, input(t));
  }
  assert.equal(r.state.crates[0].landed, true);
  assert.equal(r.state.crates[0].y, GROUND_Y - 18); // base (17px below origin) rests on the grass
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
  assert.equal(r.state.crates[0].x, 24);
  assert.equal(r.state.crates[1].x, VIEW.width - 24);
});

test('a crate landing mid-overdrive skips the startle: an overdriven mech is not surprised', () => {
  let s = { ...initialRabbitState(VIEW), modeUntil: Infinity, overdriveUntil: Infinity };
  let r = stepRabbit(s, input(1000, { drops: [{ x: 500, y: 100 }] }));
  let t = 1000;
  while (!r.state.crates[0].landed && t < 30_000) {
    t += 16;
    r = stepRabbit(r.state, input(t));
  }
  assert.equal(r.state.mode, 'chase');
});

test('full journey: chase, open in 3 cranks, hunger clock resets to the last crank', () => {
  let s = { ...initialRabbitState(VIEW), modeUntil: Infinity };
  let r = stepRabbit(s, input(1000, { drops: [{ x: 600, y: 100 }] }));
  let t = 1000;
  let clanks = 0;
  let lastClankAt = 0;
  while (r.state.crates.length > 0 && t < 60_000) {
    t += 16;
    r = stepRabbit(r.state, input(t));
    if (r.events.includes('clank')) {
      clanks++;
      lastClankAt = t;
    }
  }
  assert.equal(r.state.crates.length, 0, 'crate fully opened');
  assert.equal(clanks, 3);
  assert.equal(r.state.opened, 1);
  assert.equal(r.state.openingId, null);
  // Refueled: the 30s starvation countdown restarts from the meal, not from page load.
  assert.equal(r.state.nextHungerAt, lastClankAt + HUNGER_INTERVAL_MS);
});

test('chase locks one target: a nearer crate does not cause dithering', () => {
  const s = {
    ...initialRabbitState(VIEW),
    mode: 'chase',
    chasingId: 1,
    x: 500,
    crates: [landedCrate(1, 400), landedCrate(2, 490)], // #2 is closer
  };
  const r = stepRabbit(s, input(1000));
  assert.equal(r.state.chasingId, 1, 'stays locked on the original target');
  assert.ok(r.state.hopTo < r.state.x || r.state.midHop, 'hops toward the locked crate');
});

test('arrival is a tolerance band and the rabbit turns to face its crate', () => {
  const s = {
    ...initialRabbitState(VIEW),
    mode: 'chase',
    chasingId: 7,
    x: 500,
    dir: -1, // facing away — must not matter for arrival, must flip for opening
    crates: [landedCrate(7, 510)],
  };
  const r = stepRabbit(s, input(1000));
  assert.equal(r.state.mode, 'open');
  assert.equal(r.state.openingId, 7);
  assert.equal(r.state.dir, 1);
});

test('cranks arrive on the 260ms clock (phase 0)', () => {
  const s = {
    ...initialRabbitState(VIEW),
    mode: 'open',
    openingId: 3,
    x: 300,
    lastCrank: 1000,
    nextHungerAt: Infinity,
    crates: [landedCrate(3, 300)],
  };
  const early = stepRabbit(s, input(1259));
  assert.ok(!early.events.includes('clank'));
  const onTime = stepRabbit(s, input(1260));
  assert.ok(onTime.events.includes('clank'));
  assert.equal(onTime.state.crates[0].cranks, 1);
});

test('overdrive halves the crank interval', () => {
  const s = {
    ...initialRabbitState(VIEW),
    mode: 'open',
    openingId: 3,
    x: 300,
    lastCrank: 1000,
    overdriveUntil: Infinity,
    nextHungerAt: Infinity,
    crates: [landedCrate(3, 300)],
  };
  const early = stepRabbit(s, input(1129));
  assert.ok(!early.events.includes('clank'));
  const onTime = stepRabbit(s, input(1130)); // 260 / 2
  assert.ok(onTime.events.includes('clank'));
});

// CHARACTERIZATION of the real growth rule (formerly rabbit.ts:362): a milestone
// multiplies the rabbit's CURRENT size by 1.25 per phase gained. The rule is
// path-dependent — hunger shrink between milestones carries forward. The old
// model.rabbitGrowth().scale (deleted, was dead in production) recomputed
// 1.25^phases from scratch and would give 1.5625 here.
test('milestone growth compounds on the current, possibly hunger-shrunken, size', () => {
  const s = {
    ...initialRabbitState(VIEW),
    mode: 'open',
    openingId: 5,
    x: 300,
    opened: 9, // next crate is the 10th: second milestone
    phase: 1,
    sizeScale: 1.125, // grew to 1.25 at phase 1, then one hunger tick
    lastCrank: 0,
    nextHungerAt: Infinity,
    crates: [{ ...landedCrate(5, 300), cranks: 2 }], // one crank from done
  };
  const r = stepRabbit(s, input(1000));
  assert.equal(r.state.opened, 10);
  assert.equal(r.state.phase, 2);
  assert.equal(r.state.sizeScale, 1.125 * 1.25); // 1.40625 — not 1.25 ** 2
  assert.ok(r.events.includes('powerup'), 'milestone bolts on new armor');
  assert.equal(r.state.overdriveUntil, 1000 + 10_000);
});

test('an unfed rabbit shrinks 10% every 30s, and the clock keeps ticking at the floor', () => {
  const s = {
    ...initialRabbitState(VIEW),
    modeUntil: Infinity,
    phase: 1,
    sizeScale: 1.25,
    nextHungerAt: 5000,
  };
  let r = stepRabbit(s, input(5000));
  assert.equal(r.state.sizeScale, 1.125);
  assert.ok(r.events.includes('powerdown'));
  assert.equal(r.state.nextHungerAt, 5000 + HUNGER_INTERVAL_MS);

  // At the original size the clock still advances but nothing shrinks or plays.
  r = stepRabbit({ ...r.state, sizeScale: 1 }, input(r.state.nextHungerAt));
  assert.equal(r.state.sizeScale, 1);
  assert.ok(!r.events.includes('powerdown'));
  assert.equal(r.state.nextHungerAt, 5000 + 2 * HUNGER_INTERVAL_MS);
});

test('the ground never becomes a crate warehouse: capped at MAX_CRATES, oldest evicted', () => {
  const s = { ...initialRabbitState(VIEW), modeUntil: Infinity };
  const drops = Array.from({ length: MAX_CRATES + 1 }, (_, i) => ({ x: 100 + i * 40, y: 100 }));
  const r = stepRabbit(s, input(1000, { drops }));
  assert.equal(r.state.crates.length, MAX_CRATES);
  const ids = r.state.crates.map((c) => c.id);
  assert.ok(!ids.includes(1), 'the first-dropped crate was evicted');
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

test('mechPhase: milestones at 5/10/20/40/60, capped', () => {
  assert.equal(mechPhase(0), 0);
  assert.equal(mechPhase(4), 0);
  assert.equal(mechPhase(5), 1);
  assert.equal(mechPhase(60), 5);
  assert.equal(mechPhase(500), 5);
});

test('crateTier: one above the phase, stepping at each milestone, capped at 5', () => {
  assert.equal(crateTier(0), 1);
  assert.equal(crateTier(4), 1);
  assert.equal(crateTier(5), 2);
  assert.equal(crateTier(10), 3);
  assert.equal(crateTier(20), 4);
  assert.equal(crateTier(40), 5);
  assert.equal(crateTier(60), 5); // capped: no tier 6
  assert.equal(crateTier(500), 5);
});

test('new drops are stamped with the tier of the current phase', () => {
  const s = { ...initialRabbitState(VIEW), modeUntil: Infinity, opened: 5, phase: 1 };
  const r = stepRabbit(s, input(1000, { drops: [{ x: 500, y: 100 }] }));
  assert.equal(r.state.crates[0].tier, 2);
});

test('a crate keeps its tier for life: milestones only upgrade future drops', () => {
  // A tier-1 crate is already on the ground when the rabbit crosses a milestone.
  const s = {
    ...initialRabbitState(VIEW),
    mode: 'open',
    openingId: 5,
    x: 300,
    opened: 4, // next crate is the 5th: first milestone
    lastCrank: 0,
    nextHungerAt: Infinity,
    crates: [{ ...landedCrate(5, 300), cranks: 2 }, landedCrate(6, 700)],
  };
  const r = stepRabbit(s, input(1000, { drops: [{ x: 500, y: 100 }] }));
  assert.equal(r.state.phase, 1);
  assert.equal(r.state.crates.find((c) => c.id === 6).tier, 1, 'grounded crate stays tier 1');
  assert.equal(r.state.crates.at(-1).tier, 1, 'drop ingested before the milestone crank is tier 1');
  // The next drop after the milestone comes down a tier higher.
  const r2 = stepRabbit(r.state, input(1016, { drops: [{ x: 800, y: 100 }] }));
  assert.equal(r2.state.crates.at(-1).tier, 2);
});

test('hungerShrink: -10% per tick, converges to exactly 1 and stays there', () => {
  assert.equal(hungerShrink(1.25), 1.125);
  let s = 1.25 ** 2;
  for (let i = 0; i < 10; i++) s = hungerShrink(s);
  assert.equal(s, 1);
  assert.equal(hungerShrink(1), 1);
});
