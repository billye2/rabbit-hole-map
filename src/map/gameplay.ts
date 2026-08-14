// The mech rabbit's gameplay: hunger, overdrive, growth phases, chasing and
// crate physics — pure. No DOM, no chrome.*, no globals: the clock, rng
// and viewport are injected through StepInput, so the whole progression is
// unit-testable under node --test (emitted as dist/gameplay.mjs).
// Rendering (SVG, sounds) lives in rabbit.ts, which owns a RabbitState and
// advances it one stepRabbit() per animation frame.

export interface Viewport {
  width: number;
  height: number;
}

export interface CrateState {
  id: number;
  x: number;
  y: number;
  vy: number;
  rot: number;
  vrot: number;
  landed: boolean;
  cranks: number;
  tier: number; // 1..CRATE_TIER_MAX, stamped at drop time and fixed for life
}

export type RabbitMode = 'idle' | 'roam' | 'alert' | 'chase' | 'open';

export interface RabbitState {
  mode: RabbitMode;
  modeUntil: number;
  x: number;
  dir: 1 | -1;
  roamTarget: number;
  midHop: boolean;
  hopFrom: number;
  hopTo: number;
  hopStart: number;
  hopDur: number;
  hopHeight: number;
  openingId: number | null;
  chasingId: number | null; // locked target — prevents dithering between close crates
  lastCrank: number;
  lastNow: number;
  opened: number;
  phase: number;
  sizeScale: number; // current size: milestones grow it, hunger shrinks it
  nextHungerAt: number; // -1 until the first step arms the clock
  growPulseAt: number;
  shrinkPulseAt: number;
  overdriveUntil: number; // overdrive window
  crates: CrateState[];
  nextCrateId: number;
  lastViewportWidth: number;
  pose: { hopOffset: number; squashY: number }; // per-step render pose
}

export type GameEvent = 'clank' | 'powerup' | 'powerdown';

export interface StepInput {
  now: number;
  rng: () => number; // uniform [0, 1)
  viewport: Viewport;
  drops: { x: number; y: number }[]; // crate drops requested since the last step
}

export interface StepResult {
  state: RabbitState;
  events: GameEvent[];
}

export const GROUND_LIFT = 8; // rabbit/crate baseline above the very bottom
export const HUNGER_INTERVAL_MS = 30_000;
export const MECH_MILESTONES = [5, 10, 20, 40, 60];
export const CRANKS = 3;
export const CRATE_TIER_MAX = 5;

const BASE_CRANK_MS = 260;
const GROWTH_FACTOR = 1.25; // per phase, compounding on the current size
export const MAX_CRATES = 20; // ground cap; also the per-burst drop cap in the map
const ROAM_HOP_MS = 450;
const CHASE_HOP_MS = 300;
const ROAM_HOP_LEN = 75;
const CHASE_HOP_LEN = 95;
const ALERT_MS = 650;
const GROW_PULSE_MS = 450;
const OVERDRIVE_MS = 10_000; // overdrive after a milestone

export function mechPhase(opened: number): number {
  return MECH_MILESTONES.filter((m) => opened >= m).length;
}

// The tier of a freshly dropped crate: one above the current phase, capped.
export function crateTier(opened: number): number {
  return Math.min(mechPhase(opened) + 1, CRATE_TIER_MAX);
}

// One hunger tick: 10% smaller, but never below the original size.
export function hungerShrink(scale: number): number {
  return Math.max(1, scale * 0.9);
}

// Cranking speed: 1.5x once the first milestone is reached.
function crankMs(phase: number): number {
  return phase > 0 ? BASE_CRANK_MS / 1.5 : BASE_CRANK_MS;
}

// The size actually shown on screen: the true size modulated by a short
// pulse — overshoot on growth, dip on a hunger shrink.
export function displaySize(state: RabbitState, now: number): number {
  const sinceGrow = now - state.growPulseAt;
  const sinceShrink = now - state.shrinkPulseAt;
  let pulse = 1;
  if (sinceGrow < GROW_PULSE_MS) pulse = 1 + 0.18 * Math.sin((sinceGrow / GROW_PULSE_MS) * Math.PI);
  else if (sinceShrink < GROW_PULSE_MS) pulse = 1 - 0.12 * Math.sin((sinceShrink / GROW_PULSE_MS) * Math.PI);
  return state.sizeScale * pulse;
}

export function initialRabbitState(viewport: Viewport): RabbitState {
  return {
    mode: 'idle',
    modeUntil: 0,
    x: viewport.width * 0.3,
    dir: 1,
    roamTarget: viewport.width * 0.3,
    midHop: false,
    hopFrom: 0,
    hopTo: 0,
    hopStart: 0,
    hopDur: ROAM_HOP_MS,
    hopHeight: 22,
    openingId: null,
    chasingId: null,
    lastCrank: 0,
    lastNow: 0,
    opened: 0,
    phase: 0,
    sizeScale: 1,
    nextHungerAt: -1,
    growPulseAt: -Infinity,
    shrinkPulseAt: -Infinity,
    overdriveUntil: -Infinity,
    crates: [],
    nextCrateId: 1,
    lastViewportWidth: viewport.width,
    pose: { hopOffset: 0, squashY: 1 },
  };
}

function findCrate(s: RabbitState, id: number | null): CrateState | null {
  if (id == null) return null;
  return s.crates.find((c) => c.id === id) ?? null;
}

function nearestLanded(s: RabbitState): CrateState | null {
  let best: CrateState | null = null;
  let bestD = Infinity;
  for (const c of s.crates) {
    if (!c.landed) continue;
    const d = Math.abs(c.x - s.x);
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return best;
}

function removeCrate(s: RabbitState, id: number): void {
  const i = s.crates.findIndex((c) => c.id === id);
  if (i >= 0) s.crates.splice(i, 1);
  if (s.openingId === id) s.openingId = null;
  if (s.chasingId === id) s.chasingId = null;
}

function onCrateLanded(s: RabbitState, now: number): void {
  if (s.mode === 'idle' || s.mode === 'roam') {
    if (now < s.overdriveUntil) {
      s.mode = 'chase'; // an overdriven mech doesn't pause to be startled
      return;
    }
    s.mode = 'alert';
    s.modeUntil = now + ALERT_MS;
    s.midHop = false;
  }
}

function startHop(s: RabbitState, now: number, target: number, chase: boolean): void {
  const overdrive = now < s.overdriveUntil;
  const len = (chase ? CHASE_HOP_LEN : ROAM_HOP_LEN) * (overdrive ? 1.5 : 1);
  const delta = Math.max(-len, Math.min(len, target - s.x));
  s.hopFrom = s.x;
  s.hopTo = s.x + delta;
  s.hopStart = now;
  s.hopDur = (chase ? CHASE_HOP_MS : ROAM_HOP_MS) / (overdrive ? 2 : 1);
  s.hopHeight = overdrive ? 32 : chase ? 26 : 22;
  if (Math.abs(delta) > 1) s.dir = delta > 0 ? 1 : -1;
  s.midHop = true;
}

function ingestDrops(s: RabbitState, input: StepInput): void {
  const gy = input.viewport.height - GROUND_LIFT;
  for (const d of input.drops) {
    const cx = Math.max(24, Math.min(input.viewport.width - 24, d.x));
    const startY = Math.max(60, Math.min(d.y, gy - 60));
    s.crates.push({
      id: s.nextCrateId++,
      x: cx,
      y: startY,
      vy: 0,
      rot: (input.rng() - 0.5) * 30,
      vrot: (input.rng() - 0.5) * 3,
      landed: false,
      cranks: 0,
      tier: crateTier(s.opened),
    });
    // Keep the ground from becoming a crate warehouse.
    while (s.crates.length > MAX_CRATES) {
      const oldest = s.crates.find((k) => k.id !== s.openingId);
      if (!oldest) break;
      removeCrate(s, oldest.id);
    }
  }
}

export function stepRabbit(state: RabbitState, input: StepInput): StepResult {
  const s: RabbitState = {
    ...state,
    crates: state.crates.map((c) => ({ ...c })),
    pose: { hopOffset: 0, squashY: 1 },
  };
  const events: GameEvent[] = [];
  const { now } = input;
  const dt = s.lastNow ? Math.min(50, now - s.lastNow) : 16;
  s.lastNow = now;
  const gy = input.viewport.height - GROUND_LIFT;

  ingestDrops(s, input);

  // A shrunken viewport must not strand the rabbit off-screen.
  if (input.viewport.width !== s.lastViewportWidth) {
    s.lastViewportWidth = input.viewport.width;
    s.x = Math.max(30, Math.min(input.viewport.width - 30, s.x));
  }

  // --- hunger clock: every 30s without a meal, shrink 10% back toward
  // the original size (never below it) ---
  if (s.nextHungerAt < 0) s.nextHungerAt = now + HUNGER_INTERVAL_MS;
  if (now >= s.nextHungerAt) {
    s.nextHungerAt = now + HUNGER_INTERVAL_MS;
    if (s.sizeScale > 1) {
      s.sizeScale = hungerShrink(s.sizeScale);
      s.shrinkPulseAt = now;
      events.push('powerdown');
    }
  }

  // --- crate physics ---
  for (const c of s.crates) {
    if (!c.landed) {
      c.vy += 0.0022 * dt * dt; // gravity, dt-scaled
      c.y += c.vy;
      c.rot += c.vrot;
      // Land so the crate's base (drawn 17px below its origin) rests on the grass.
      if (c.y >= gy - 18) {
        c.y = gy - 18;
        c.landed = true;
        c.rot = (c.rot % 20) - 10; // settle at a slight tilt
        onCrateLanded(s, now);
      }
    }
  }

  // --- state machine ---
  if (s.mode === 'alert' && now >= s.modeUntil) s.mode = 'chase';

  if (s.mode === 'idle') {
    s.pose.squashY = 1 + Math.sin(now / 380) * 0.02; // breathing
    if (nearestLanded(s)) {
      s.mode = 'chase';
    } else if (now >= s.modeUntil) {
      s.roamTarget = 40 + input.rng() * (input.viewport.width - 80);
      s.mode = 'roam';
    }
  } else if (s.mode === 'roam' || s.mode === 'chase') {
    const chase = s.mode === 'chase';
    let target = s.roamTarget;
    if (chase) {
      // Stay locked on one crate until it's gone — re-picking "nearest"
      // every hop makes the rabbit dither between two close crates.
      const locked = findCrate(s, s.chasingId);
      if (!locked || !locked.landed) s.chasingId = nearestLanded(s)?.id ?? null;
      const chasing = findCrate(s, s.chasingId);
      if (!chasing) {
        s.mode = 'idle';
        s.modeUntil = now + 800;
        target = s.x;
      } else {
        target = chasing.x;
      }
    }
    if (s.mode === 'roam' || s.mode === 'chase') {
      if (!s.midHop) {
        // Arrival is a tolerance band, not an exact point — the target
        // must never depend on which way the rabbit currently faces.
        const tol = chase ? Math.max(16, 14 * s.sizeScale) : 10;
        if (Math.abs(target - s.x) < tol) {
          const chasing = findCrate(s, s.chasingId);
          if (chase && chasing) {
            s.mode = 'open';
            s.openingId = chasing.id;
            s.chasingId = null;
            s.lastCrank = now;
            s.dir = chasing.x >= s.x ? 1 : -1;
          } else if (!chase) {
            s.mode = 'idle';
            s.modeUntil = now + 1200 + input.rng() * 2600;
          }
        } else {
          startHop(s, now, target, chase);
        }
      }
      if (s.midHop) {
        const t = Math.min(1, (now - s.hopStart) / s.hopDur);
        s.x = s.hopFrom + (s.hopTo - s.hopFrom) * t;
        s.pose.hopOffset = Math.sin(t * Math.PI) * s.hopHeight;
        s.pose.squashY = 1 + Math.sin(t * Math.PI) * 0.08; // stretch mid-air
        if (t >= 1) {
          s.midHop = false;
          s.pose.squashY = 0.94; // landing squash
        }
      }
    }
  } else if (s.mode === 'open') {
    const opening = findCrate(s, s.openingId);
    if (!opening) {
      s.openingId = null;
      s.mode = nearestLanded(s) ? 'chase' : 'idle';
      s.modeUntil = now + 900;
    } else {
      s.pose.squashY = 1 - Math.abs(Math.sin(now / 90)) * 0.06; // cranking bob
      const crankEvery = now < s.overdriveUntil ? crankMs(s.phase) / 2 : crankMs(s.phase);
      if (now - s.lastCrank >= crankEvery) {
        s.lastCrank = now;
        opening.cranks++;
        events.push('clank');
        if (opening.cranks >= CRANKS) {
          removeCrate(s, opening.id);
          s.opened++;
          s.nextHungerAt = now + HUNGER_INTERVAL_MS; // refueled — hunger clock resets
          const np = mechPhase(s.opened);
          if (np > s.phase) {
            s.sizeScale *= Math.pow(GROWTH_FACTOR, np - s.phase); // level up!
            s.phase = np;
            s.growPulseAt = now;
            // MILESTONE: new armor bolts on — 10s overdrive.
            s.overdriveUntil = now + OVERDRIVE_MS;
            events.push('powerup');
          }
          s.mode = nearestLanded(s) ? 'chase' : 'idle';
          s.modeUntil = now + 1000;
        }
      }
    }
  }

  return { state: s, events };
}
