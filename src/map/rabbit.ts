// The burrow layer: a mech rabbit that roams the bottom of the map, plus
// the crates that drop from freshly-visited sites. Lives in SCREEN space (a
// sibling of #viewport), so panning/zooming the graph never moves the
// ground. Everything uses attribute fills — no CSS — so the PNG export's
// SVG-clone path renders it as-is.
//
// This file is the paint adapter: it builds the sprites, feeds each rAF
// into the pure gameplay step (gameplay.ts), plays the step's events, and
// projects the resulting RabbitState onto SVG attributes. All behaviour
// decisions live in gameplay.ts.
import {
  CRANKS,
  GROUND_LIFT,
  displaySize,
  initialRabbitState,
  stepRabbit,
  type GameEvent,
  type RabbitState,
  type Viewport,
} from './gameplay.js';
import { playClank, playPowerup, playPowerdown } from './audio.js';

const SVGNS = 'http://www.w3.org/2000/svg';
const NAVY = '#2b2857';
const WHITE = '#ffffff';
const PINK = '#ff9eb5';
const ORANGE = '#ff9f1c';
const LEAF = '#06d6a0';
const MECH_RED = '#ff2244';
const STEEL = '#b8c4d9';
const STEEL_DARK = '#7d8aa5';
const GOLD = '#ffd166';
const GOLD_DARK = '#d9a520';
const ENERGY = '#00e5ff';
const PLASMA = '#ff2bd6';
const PLASMA_DARK = '#6b21a8';
const WOOD = '#b07d3f';
const WOOD_DARK = '#8a5a2b';

// Crate looks per tier: Wooden, Iron, Gold, Energy, Plasma.
const TIER_STYLES = [
  { body: WOOD, brace: WOOD_DARK, latch: WOOD_DARK },
  { body: STEEL, brace: STEEL_DARK, latch: NAVY },
  { body: GOLD, brace: GOLD_DARK, latch: WHITE },
  { body: NAVY, brace: ENERGY, latch: ENERGY },
  { body: PLASMA_DARK, brace: PLASMA, latch: PLASMA },
];

export interface RabbitLayer {
  tick(now: number): void;
  dropCrate(screenX: number, screenY: number): void;
  resize(): void;
}

function el<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number>,
  parent?: SVGElement,
): SVGElementTagNameMap[K] {
  const e = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  parent?.appendChild(e);
  return e;
}

interface RabbitParts {
  root: SVGGElement;
  squash: SVGGElement;
  bubble: SVGGElement;
  eye: SVGCircleElement;
  aura: SVGEllipseElement;
  armorGroups: SVGGElement[];
  visor: SVGRectElement;
  flames: SVGPathElement;
  antennaTip: SVGCircleElement;
}

function buildRabbit(parent: SVGGElement): RabbitParts {
  const root = el('g', { class: 'rabbit' }, parent);
  const squash = el('g', {}, root);
  // Origin is the rabbit's ground contact point; the sprite is drawn upward.
  // Energy aura behind everything — invisible until overdrive.
  const aura = el('ellipse', { class: 'aura', cx: 2, cy: -22, rx: 34, ry: 32, fill: ENERGY, opacity: 0 }, squash);
  el('circle', { cx: -15, cy: -12, r: 5, fill: WHITE }, squash); // tail
  el('ellipse', { cx: 0, cy: -13, rx: 16, ry: 12, fill: WHITE }, squash); // body
  // ears (behind the head), slightly splayed
  el('rect', { x: 3, y: -55, width: 7, height: 24, rx: 3.5, fill: WHITE, transform: 'rotate(-8 6.5 -43)' }, squash);
  el('rect', { x: 13, y: -54, width: 7, height: 24, rx: 3.5, fill: WHITE, transform: 'rotate(8 16.5 -42)' }, squash);
  el('rect', { x: 5, y: -52, width: 3, height: 17, rx: 1.5, fill: PINK, transform: 'rotate(-8 6.5 -43)' }, squash);
  el('rect', { x: 15, y: -51, width: 3, height: 17, rx: 1.5, fill: PINK, transform: 'rotate(8 16.5 -42)' }, squash);
  el('circle', { cx: 10, cy: -27, r: 10.5, fill: WHITE }, squash); // head
  const eye = el('circle', { class: 'eye', cx: 13, cy: -29, r: 1.7, fill: NAVY }, squash); // eye
  el('circle', { cx: 20, cy: -26, r: 1.8, fill: PINK }, squash); // nose
  el('ellipse', { cx: 8, cy: -2.5, rx: 6, ry: 2.5, fill: WHITE }, squash); // front paw

  // Armor: one <g> per phase, bolted on cumulatively — armor-N appears at
  // phase N and stays (phase never decreases; it derives from crates opened).
  const armorGroups: SVGGElement[] = [];
  const armor = (n: number): SVGGElement => {
    const g = el('g', { class: `armor armor-${n}`, visibility: 'hidden' }, squash);
    armorGroups.push(g);
    return g;
  };

  // Phase 1: ear plating + rivets, reusing the exact ear transforms.
  const a1 = armor(1);
  const earPlateL = el('g', { transform: 'rotate(-8 6.5 -43)' }, a1);
  el(
    'rect',
    { x: 3.5, y: -54.5, width: 6, height: 14, rx: 3, fill: STEEL, stroke: STEEL_DARK, 'stroke-width': 0.8 },
    earPlateL,
  );
  el('circle', { cx: 6.5, cy: -47.5, r: 0.8, fill: STEEL_DARK }, earPlateL);
  const earPlateR = el('g', { transform: 'rotate(8 16.5 -42)' }, a1);
  el(
    'rect',
    { x: 13.5, y: -53.5, width: 6, height: 14, rx: 3, fill: STEEL, stroke: STEEL_DARK, 'stroke-width': 0.8 },
    earPlateR,
  );
  el('circle', { cx: 16.5, cy: -46.5, r: 0.8, fill: STEEL_DARK }, earPlateR);

  // Phase 2: chest plate with a glowing core.
  const a2 = armor(2);
  el('ellipse', { cx: 2, cy: -11, rx: 11, ry: 8, fill: STEEL, stroke: STEEL_DARK, 'stroke-width': 1 }, a2);
  el('circle', { cx: -6, cy: -13, r: 0.8, fill: STEEL_DARK }, a2); // bolt
  el('circle', { cx: 10, cy: -13, r: 0.8, fill: STEEL_DARK }, a2); // bolt
  el('circle', { class: 'core', cx: 2, cy: -13, r: 2.5, fill: ENERGY }, a2);

  // Phase 3: cyan visor over the eye (overdrive recolors it).
  const a3 = armor(3);
  const visor = el(
    'rect',
    {
      class: 'visor',
      x: 8,
      y: -33,
      width: 12,
      height: 7,
      rx: 3,
      fill: ENERGY,
      stroke: STEEL_DARK,
      'stroke-width': 0.8,
      opacity: 0.9,
    },
    a3,
  );

  // Phase 4: back thrusters; flames only show during overdrive.
  const a4 = armor(4);
  el('rect', { x: -21, y: -26, width: 6, height: 12, rx: 2, fill: STEEL_DARK }, a4);
  el('rect', { x: -15, y: -30, width: 5, height: 10, rx: 2, fill: STEEL_DARK }, a4);
  const flames = el(
    'path',
    {
      class: 'flames',
      d: 'M -20.5 -13 l 2.5 7 l 2.5 -7 z M -14.5 -19 l 2 6 l 2 -6 z',
      fill: ORANGE,
      visibility: 'hidden',
    },
    a4,
  );

  // Phase 5: head dome + paw guard + antenna with a glowing tip.
  const a5 = armor(5);
  el('ellipse', { cx: 10, cy: -32, rx: 10, ry: 6, fill: STEEL, stroke: STEEL_DARK, 'stroke-width': 1 }, a5);
  el('ellipse', { cx: 8, cy: -2.5, rx: 6.5, ry: 2.8, fill: STEEL, stroke: STEEL_DARK, 'stroke-width': 0.8 }, a5);
  el('rect', { x: 9.4, y: -46, width: 1.2, height: 9, fill: STEEL_DARK }, a5);
  const antennaTip = el('circle', { class: 'antenna-tip', cx: 10, cy: -47, r: 1.8, fill: ENERGY }, a5);

  // "!" alert bubble
  const bubble = el('g', { class: 'alert-bubble', visibility: 'hidden' }, root);
  el('rect', { x: -9, y: -86, width: 18, height: 22, rx: 7, fill: WHITE, stroke: NAVY, 'stroke-width': 2 }, bubble);
  el(
    'text',
    {
      x: 0,
      y: -69,
      'text-anchor': 'middle',
      fill: NAVY,
      'font-size': 16,
      'font-weight': 'bold',
      'font-family': 'Arial Rounded MT Bold, sans-serif',
    },
    bubble,
  ).textContent = '!';
  return { root, squash, bubble, eye, aura, armorGroups, visor, flames, antennaTip };
}

function buildCrate(parent: SVGGElement, tier: number): { el: SVGGElement; scaleEl: SVGGElement } {
  const style = TIER_STYLES[Math.max(1, Math.min(tier, TIER_STYLES.length)) - 1];
  const root = el('g', { class: `crate tier-${tier}` }, parent);
  const scaleEl = el('g', {}, root);
  // Drawn below the origin so the base (17px down) rests on the grass —
  // gameplay's landing constant assumes this.
  el(
    'rect',
    { x: -8, y: 1, width: 16, height: 16, rx: 2, fill: style.body, stroke: style.brace, 'stroke-width': 1 },
    scaleEl,
  );
  el('line', { x1: -8, y1: 1, x2: 8, y2: 17, stroke: style.brace, 'stroke-width': 1.6 }, scaleEl);
  el('line', { x1: 8, y1: 1, x2: -8, y2: 17, stroke: style.brace, 'stroke-width': 1.6 }, scaleEl);
  if (tier === 3) {
    // The gold crate gets a star latch.
    el(
      'path',
      { d: 'M 0 5.5 L 1.1 7.9 L 3.5 9 L 1.1 10.1 L 0 12.5 L -1.1 10.1 L -3.5 9 L -1.1 7.9 Z', fill: style.latch },
      scaleEl,
    );
  } else {
    el('circle', { cx: 0, cy: 9, r: 2.2, fill: style.latch }, scaleEl);
  }
  return { el: root, scaleEl };
}

export function initRabbit(svg: SVGSVGElement): RabbitLayer {
  const layer = el('g', { id: 'burrow-layer', 'pointer-events': 'none' }, svg as unknown as SVGGElement);
  const ground = el('rect', { x: -20, y: 0, width: 40, height: 26, rx: 12, fill: LEAF, opacity: 0.35 }, layer);
  const crateG = el('g', {}, layer);
  const { root: rabbitEl, squash, bubble, eye, aura, armorGroups, visor, flames, antennaTip } = buildRabbit(layer);

  const viewport = (): Viewport => ({ width: window.innerWidth, height: window.innerHeight });
  let state: RabbitState = initialRabbitState(viewport());
  let pendingDrops: { x: number; y: number }[] = [];
  const crateEls = new Map<number, { el: SVGGElement; scaleEl: SVGGElement; paintedCranks: number }>();
  let paintedPhase = -1;
  let paintedOverdrive = false;
  let paintedAlert = false;

  const SOUNDS: Record<GameEvent, () => void> = { clank: playClank, powerup: playPowerup, powerdown: playPowerdown };

  function layoutGround(): void {
    ground.setAttribute('x', '-20');
    ground.setAttribute('width', String(window.innerWidth + 40));
    ground.setAttribute('y', String(window.innerHeight - 18));
  }
  layoutGround();

  function setArmor(phase: number): void {
    armorGroups.forEach((g, i) => g.setAttribute('visibility', i < phase ? 'visible' : 'hidden'));
  }

  function setOverdrive(on: boolean): void {
    eye.setAttribute('fill', on ? MECH_RED : NAVY);
    eye.setAttribute('r', on ? '2.6' : '1.7');
    visor.setAttribute('fill', on ? MECH_RED : ENERGY);
    flames.setAttribute('visibility', on ? 'visible' : 'hidden');
    aura.setAttribute('opacity', on ? '0.3' : '0');
  }

  function paint(now: number): void {
    // Crates: keyed by id — create, update, and remove to match the state.
    // Tier is stamped at drop time, so a crate's look never needs repainting.
    const alive = new Set<number>();
    for (const c of state.crates) {
      alive.add(c.id);
      let entry = crateEls.get(c.id);
      if (!entry) {
        entry = { ...buildCrate(crateG, c.tier), paintedCranks: -1 };
        crateEls.set(c.id, entry);
      }
      entry.el.setAttribute('transform', `translate(${c.x},${c.y}) rotate(${c.rot})`);
      if (c.cranks !== entry.paintedCranks) {
        entry.paintedCranks = c.cranks;
        const s = Math.max(0, 1 - c.cranks / CRANKS);
        entry.scaleEl.setAttribute('transform', `scale(${0.4 + 0.6 * s})`);
        entry.scaleEl.setAttribute('opacity', String(0.3 + 0.7 * s));
      }
    }
    for (const [id, entry] of crateEls) {
      if (!alive.has(id)) {
        entry.el.remove();
        crateEls.delete(id);
      }
    }

    const alertOn = state.mode === 'alert';
    if (alertOn !== paintedAlert) {
      paintedAlert = alertOn;
      bubble.setAttribute('visibility', alertOn ? 'visible' : 'hidden');
    }

    if (state.phase !== paintedPhase) {
      paintedPhase = state.phase;
      setArmor(state.phase);
    }

    const overdriveOn = now < state.overdriveUntil;
    if (overdriveOn !== paintedOverdrive) {
      paintedOverdrive = overdriveOn;
      setOverdrive(overdriveOn);
    }
    if (overdriveOn) {
      // Pulsing energy aura while overdrive is hot.
      aura.setAttribute('rx', String(34 + Math.sin(now / 110) * 5));
      aura.setAttribute('ry', String(32 + Math.cos(now / 130) * 4));
    }
    if (state.phase >= 5) {
      // The full-mech antenna beacon breathes.
      antennaTip.setAttribute('opacity', String(0.6 + 0.4 * Math.sin(now / 150)));
    }

    const gy = window.innerHeight - GROUND_LIFT;
    const size = displaySize(state, now);
    rabbitEl.setAttribute(
      'transform',
      `translate(${state.x},${gy - state.pose.hopOffset}) scale(${state.dir * size},${size})`,
    );
    squash.setAttribute('transform', `scale(1,${state.pose.squashY})`);
  }

  function tick(now: number): void {
    const result = stepRabbit(state, { now, rng: Math.random, viewport: viewport(), drops: pendingDrops });
    pendingDrops = [];
    state = result.state;
    for (const e of result.events) SOUNDS[e]();
    paint(now);
  }

  function dropCrate(screenX: number, screenY: number): void {
    pendingDrops.push({ x: screenX, y: screenY });
  }

  function resize(): void {
    layoutGround();
  }

  return { tick, dropCrate, resize };
}
