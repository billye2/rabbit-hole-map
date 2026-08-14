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
import baseIdle0 from './sprites/front-0.png';
import baseIdle1 from './sprites/front-1.png';
import baseIdle2 from './sprites/front-2.png';
import baseIdle3 from './sprites/front-3.png';
import baseWalk0 from './sprites/side-0.png';
import baseWalk1 from './sprites/side-1.png';
import baseWalk2 from './sprites/side-2.png';
import baseWalk3 from './sprites/side-3.png';
import cannonIdle0 from './sprites/cannon-idle-0.png';
import cannonIdle1 from './sprites/cannon-idle-1.png';
import cannonWalk0 from './sprites/cannon-walk-0.png';
import cannonWalk1 from './sprites/cannon-walk-1.png';
import cannonWalk2 from './sprites/cannon-walk-2.png';
import battleIdle0 from './sprites/battle-idle-0.png';
import battleIdle1 from './sprites/battle-idle-1.png';
import battleIdle2 from './sprites/battle-idle-2.png';
import battleWalk0 from './sprites/battle-walk-0.png';
import battleWalk1 from './sprites/battle-walk-1.png';
import battleWalk2 from './sprites/battle-walk-2.png';
import battleWalk3 from './sprites/battle-walk-3.png';
import battleWalk4 from './sprites/battle-walk-4.png';
import battleWalk5 from './sprites/battle-walk-5.png';
import jeepIdle0 from './sprites/jeep-idle-0.png';
import jeepIdle1 from './sprites/jeep-idle-1.png';
import jeepIdle2 from './sprites/jeep-idle-2.png';
import jeepIdle3 from './sprites/jeep-idle-3.png';
import jeepWalk0 from './sprites/jeep-walk-0.png';
import jeepWalk1 from './sprites/jeep-walk-1.png';
import jeepWalk2 from './sprites/jeep-walk-2.png';
import jeepWalk3 from './sprites/jeep-walk-3.png';
import tankIdle0 from './sprites/tank-idle-0.png';
import tankIdle1 from './sprites/tank-idle-1.png';
import tankIdle2 from './sprites/tank-idle-2.png';
import tankWalk0 from './sprites/tank-walk-0.png';
import tankWalk1 from './sprites/tank-walk-1.png';
import tankWalk2 from './sprites/tank-walk-2.png';

const SVGNS = 'http://www.w3.org/2000/svg';

// The rabbit's sprite forms — one per milestone from phase 2 up: base gold
// (0-1), gold + cannon (2), grey battle armor (3), the jeep (4), and the
// gold tank at peak (5). `flip` is the frame art's native facing (side
// frames face right = 1, left = -1); the root transform's dir flip composes
// with it. `h` is display height at scale 1; width follows the frame's
// aspect (`aspect` = frame w / h).
interface SpriteForm {
  idle: string[];
  walk: string[];
  flip: 1 | -1;
  h: number;
  aspect: number;
}
const FORMS: SpriteForm[] = [
  {
    idle: [baseIdle0, baseIdle1, baseIdle2, baseIdle3],
    walk: [baseWalk0, baseWalk1, baseWalk2, baseWalk3],
    flip: 1,
    h: 72,
    aspect: 103 / 139,
  },
  {
    // The cannon sheet only has two clean front frames; the third is a
    // back view, so the idle cycle is two-beat.
    idle: [cannonIdle0, cannonIdle1],
    walk: [cannonWalk0, cannonWalk1, cannonWalk2],
    flip: -1,
    h: 74,
    aspect: 99 / 147,
  },
  {
    idle: [battleIdle0, battleIdle1, battleIdle2],
    walk: [battleWalk0, battleWalk1, battleWalk2, battleWalk3, battleWalk4, battleWalk5],
    flip: 1,
    h: 74,
    aspect: 1,
  },
  {
    idle: [jeepIdle0, jeepIdle1, jeepIdle2, jeepIdle3],
    walk: [jeepWalk0, jeepWalk1, jeepWalk2, jeepWalk3],
    flip: -1,
    h: 78,
    aspect: 128 / 152,
  },
  {
    idle: [tankIdle0, tankIdle1, tankIdle2],
    walk: [tankWalk0, tankWalk1, tankWalk2],
    flip: 1,
    h: 80,
    aspect: 136 / 129,
  },
];
const formForPhase = (phase: number): SpriteForm => FORMS[Math.max(0, Math.min(phase - 1, FORMS.length - 1))];
const NAVY = '#2b2857';
const WHITE = '#ffffff';
const LEAF = '#06d6a0';
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
  armorGroups: SVGGElement[];
  imgWrap: SVGGElement;
  img: SVGImageElement;
}

function buildRabbit(parent: SVGGElement): RabbitParts {
  const root = el('g', { class: 'rabbit', 'data-overdrive': 0 }, parent);
  const squash = el('g', {}, root);
  // Origin is the rabbit's ground contact point; the sprite is drawn upward.
  // The body is a bitmap frame from the current sprite form; imgWrap holds
  // the form's native-facing flip so the root's dir flip stays universal.
  // Size/position attributes are stamped whenever the form changes.
  const imgWrap = el('g', {}, squash);
  const img = el('image', { 'image-rendering': 'pixelated' }, imgWrap);

  // Milestone markers: one <g> per phase, lit cumulatively — armor-N turns
  // visible at phase N and stays (phase never decreases; it derives from
  // crates opened). The VISUAL of each milestone is the sprite form swap
  // (and the growth pulse); these groups carry no geometry — they exist so
  // phase is inspectable in the DOM (and e2e-pinned).
  const armorGroups: SVGGElement[] = [];
  for (let n = 1; n <= 5; n++) armorGroups.push(el('g', { class: `armor armor-${n}`, visibility: 'hidden' }, squash));

  // "!" alert bubble
  const bubble = el('g', { class: 'alert-bubble', visibility: 'hidden' }, root);
  el('rect', { x: -9, y: -104, width: 18, height: 22, rx: 7, fill: WHITE, stroke: NAVY, 'stroke-width': 2 }, bubble);
  el(
    'text',
    {
      x: 0,
      y: -87,
      'text-anchor': 'middle',
      fill: NAVY,
      'font-size': 16,
      'font-weight': 'bold',
      'font-family': 'Arial Rounded MT Bold, sans-serif',
    },
    bubble,
  ).textContent = '!';
  return { root, squash, bubble, armorGroups, imgWrap, img };
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
  const { root: rabbitEl, squash, bubble, armorGroups, imgWrap, img } = buildRabbit(layer);

  const viewport = (): Viewport => ({ width: window.innerWidth, height: window.innerHeight });
  let state: RabbitState = initialRabbitState(viewport());
  let pendingDrops: { x: number; y: number }[] = [];
  const crateEls = new Map<number, { el: SVGGElement; scaleEl: SVGGElement; paintedCranks: number }>();
  let paintedPhase = -1;
  let paintedOverdrive = false;
  let paintedAlert = false;
  let paintedForm: SpriteForm | null = null;
  let paintedHref = '';

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

  // No dedicated overdrive visuals (by request — the sprites carry the
  // look): overdrive reads as the double-speed rampage. The data attribute
  // keeps the state inspectable in the DOM (and e2e-pinned).
  function setOverdrive(on: boolean): void {
    rabbitEl.setAttribute('data-overdrive', on ? '1' : '0');
  }

  // Project the state onto a sprite frame: which form (by phase), which
  // strip (walk while moving or cranking, idle otherwise), which frame
  // (time-cycled — hops are short enough that a clock drives the gait).
  function paintSprite(now: number): void {
    const form = formForPhase(state.phase);
    if (form !== paintedForm) {
      paintedForm = form;
      const w = form.h * form.aspect;
      img.setAttribute('width', String(w));
      img.setAttribute('height', String(form.h));
      img.setAttribute('x', String(-w / 2));
      img.setAttribute('y', String(-form.h));
      imgWrap.setAttribute('transform', `scale(${form.flip},1)`);
    }
    const moving = state.mode === 'roam' || state.mode === 'chase' || state.mode === 'open';
    const frames = moving ? form.walk : form.idle;
    const idx = Math.floor(now / (moving ? 110 : 420)) % frames.length;
    const href = frames[idx];
    if (href !== paintedHref) {
      paintedHref = href;
      img.setAttribute('href', href);
    }
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

    paintSprite(now);

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
