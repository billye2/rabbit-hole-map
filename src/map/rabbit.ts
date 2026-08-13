// The burrow layer: a rabbit that roams the bottom of the map, plus the
// carrots that drop from freshly-visited sites. Lives in SCREEN space (a
// sibling of #viewport), so panning/zooming the graph never moves the
// ground. Everything uses attribute fills — no CSS — so the PNG export's
// SVG-clone path renders it as-is.
//
// This file is the paint adapter: it builds the sprites, feeds each rAF
// into the pure gameplay step (gameplay.ts), plays the step's events, and
// projects the resulting RabbitState onto SVG attributes. All behaviour
// decisions live in gameplay.ts.
import {
  BITES,
  GROUND_LIFT,
  displaySize,
  initialRabbitState,
  stepRabbit,
  type GameEvent,
  type RabbitState,
  type Viewport,
} from './gameplay.js';
import { playNibble, playRoar, playShrink } from './audio.js';

const SVGNS = 'http://www.w3.org/2000/svg';
const NAVY = '#2b2857';
const WHITE = '#ffffff';
const PINK = '#ff9eb5';
const ORANGE = '#ff9f1c';
const LEAF = '#06d6a0';
const MONSTER_RED = '#ff2244';
const AURA = '#6b21a8';

export interface RabbitLayer {
  tick(now: number): void;
  dropCarrot(screenX: number, screenY: number): void;
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
  innerEars: SVGRectElement[];
  aura: SVGEllipseElement;
  fangs: SVGPathElement;
}

function buildRabbit(parent: SVGGElement): RabbitParts {
  const root = el('g', { class: 'rabbit' }, parent);
  const squash = el('g', {}, root);
  // Origin is the rabbit's ground contact point; the sprite is drawn upward.
  // Dark aura behind everything — invisible until frenzy.
  const aura = el('ellipse', { class: 'aura', cx: 2, cy: -22, rx: 34, ry: 32, fill: AURA, opacity: 0 }, squash);
  el('circle', { cx: -15, cy: -12, r: 5, fill: WHITE }, squash); // tail
  el('ellipse', { cx: 0, cy: -13, rx: 16, ry: 12, fill: WHITE }, squash); // body
  // ears (behind the head), slightly splayed
  el('rect', { x: 3, y: -55, width: 7, height: 24, rx: 3.5, fill: WHITE, transform: 'rotate(-8 6.5 -43)' }, squash);
  el('rect', { x: 13, y: -54, width: 7, height: 24, rx: 3.5, fill: WHITE, transform: 'rotate(8 16.5 -42)' }, squash);
  const earL = el(
    'rect',
    { x: 5, y: -52, width: 3, height: 17, rx: 1.5, fill: PINK, transform: 'rotate(-8 6.5 -43)' },
    squash,
  );
  const earR = el(
    'rect',
    { x: 15, y: -51, width: 3, height: 17, rx: 1.5, fill: PINK, transform: 'rotate(8 16.5 -42)' },
    squash,
  );
  el('circle', { cx: 10, cy: -27, r: 10.5, fill: WHITE }, squash); // head
  const eye = el('circle', { class: 'eye', cx: 13, cy: -29, r: 1.7, fill: NAVY }, squash); // eye
  el('circle', { cx: 20, cy: -26, r: 1.8, fill: PINK }, squash); // nose
  // fangs — hidden until frenzy
  const fangs = el(
    'path',
    {
      class: 'fangs',
      d: 'M 12 -17.5 l 2.4 5.5 l 2.4 -5.5 z M 5.5 -17.5 l 2.4 5.5 l 2.4 -5.5 z',
      fill: WHITE,
      stroke: NAVY,
      'stroke-width': 0.9,
      visibility: 'hidden',
    },
    squash,
  );
  el('ellipse', { cx: 8, cy: -2.5, rx: 6, ry: 2.5, fill: WHITE }, squash); // front paw

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
  return { root, squash, bubble, eye, innerEars: [earL, earR], aura, fangs };
}

function buildCarrot(parent: SVGGElement): { el: SVGGElement; scaleEl: SVGGElement } {
  const root = el('g', { class: 'carrot' }, parent);
  const scaleEl = el('g', {}, root);
  el('path', { d: 'M -5.5 0 L 5.5 0 L 0 17 Z', fill: ORANGE }, scaleEl); // body, tip down
  el('ellipse', { cx: -3, cy: -4, rx: 3, ry: 5.5, fill: LEAF, transform: 'rotate(-24 -3 -4)' }, scaleEl);
  el('ellipse', { cx: 3, cy: -4, rx: 3, ry: 5.5, fill: LEAF, transform: 'rotate(24 3 -4)' }, scaleEl);
  el('ellipse', { cx: 0, cy: -5.5, rx: 2.6, ry: 6, fill: LEAF }, scaleEl);
  return { el: root, scaleEl };
}

export function initRabbit(svg: SVGSVGElement): RabbitLayer {
  const layer = el('g', { id: 'burrow-layer', 'pointer-events': 'none' }, svg as unknown as SVGGElement);
  const ground = el('rect', { x: -20, y: 0, width: 40, height: 26, rx: 12, fill: LEAF, opacity: 0.35 }, layer);
  const carrotG = el('g', {}, layer);
  const { root: rabbitEl, squash, bubble, eye, innerEars, aura, fangs } = buildRabbit(layer);

  const viewport = (): Viewport => ({ width: window.innerWidth, height: window.innerHeight });
  let state: RabbitState = initialRabbitState(viewport());
  let pendingDrops: { x: number; y: number }[] = [];
  const carrotEls = new Map<number, { el: SVGGElement; scaleEl: SVGGElement; paintedBites: number }>();
  let paintedMonster = false;
  let paintedAlert = false;

  const SOUNDS: Record<GameEvent, () => void> = { nibble: playNibble, roar: playRoar, shrink: playShrink };

  function layoutGround(): void {
    ground.setAttribute('x', '-20');
    ground.setAttribute('width', String(window.innerWidth + 40));
    ground.setAttribute('y', String(window.innerHeight - 18));
  }
  layoutGround();

  function setMonster(on: boolean): void {
    eye.setAttribute('fill', on ? MONSTER_RED : NAVY);
    eye.setAttribute('r', on ? '2.6' : '1.7');
    fangs.setAttribute('visibility', on ? 'visible' : 'hidden');
    for (const e of innerEars) e.setAttribute('fill', on ? MONSTER_RED : PINK);
    aura.setAttribute('opacity', on ? '0.3' : '0');
  }

  function paint(now: number): void {
    // Carrots: keyed by id — create, update, and remove to match the state.
    const alive = new Set<number>();
    for (const c of state.carrots) {
      alive.add(c.id);
      let entry = carrotEls.get(c.id);
      if (!entry) {
        entry = { ...buildCarrot(carrotG), paintedBites: -1 };
        carrotEls.set(c.id, entry);
      }
      entry.el.setAttribute('transform', `translate(${c.x},${c.y}) rotate(${c.rot})`);
      if (c.bites !== entry.paintedBites) {
        entry.paintedBites = c.bites;
        const s = Math.max(0, 1 - c.bites / BITES);
        entry.scaleEl.setAttribute('transform', `scale(${0.4 + 0.6 * s})`);
        entry.scaleEl.setAttribute('opacity', String(0.3 + 0.7 * s));
      }
    }
    for (const [id, entry] of carrotEls) {
      if (!alive.has(id)) {
        entry.el.remove();
        carrotEls.delete(id);
      }
    }

    const alertOn = state.mode === 'alert';
    if (alertOn !== paintedAlert) {
      paintedAlert = alertOn;
      bubble.setAttribute('visibility', alertOn ? 'visible' : 'hidden');
    }

    const monsterOn = now < state.frenzyUntil;
    if (monsterOn !== paintedMonster) {
      paintedMonster = monsterOn;
      setMonster(monsterOn);
    }
    if (monsterOn) {
      // Pulsing dark aura while the monster is out.
      aura.setAttribute('rx', String(34 + Math.sin(now / 110) * 5));
      aura.setAttribute('ry', String(32 + Math.cos(now / 130) * 4));
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

  function dropCarrot(screenX: number, screenY: number): void {
    pendingDrops.push({ x: screenX, y: screenY });
  }

  function resize(): void {
    layoutGround();
  }

  return { tick, dropCarrot, resize };
}
