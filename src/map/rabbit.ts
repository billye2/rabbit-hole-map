// The burrow layer: a rabbit that roams the bottom of the map, plus the
// carrots that drop from freshly-visited sites. Lives in SCREEN space (a
// sibling of #viewport), so panning/zooming the graph never moves the
// ground. Everything uses attribute fills — no CSS — so the PNG export's
// SVG-clone path renders it as-is.
import { HUNGER_INTERVAL_MS, hungerShrink, rabbitGrowth, rabbitStages } from '../model.js';
import { playNibble, playPop, playShrink } from './audio.js';

const SVGNS = 'http://www.w3.org/2000/svg';
const NAVY = '#2b2857';
const WHITE = '#ffffff';
const PINK = '#ff9eb5';
const ORANGE = '#ff9f1c';
const LEAF = '#06d6a0';

const GROUND_LIFT = 8; // rabbit/carrot baseline above the very bottom
const MAX_CARROTS = 12;
const ROAM_HOP_MS = 450;
const CHASE_HOP_MS = 300;
const ROAM_HOP_LEN = 75;
const CHASE_HOP_LEN = 95;
const ALERT_MS = 650;
const BITES = 3;
const GROW_PULSE_MS = 450;

interface Carrot {
  el: SVGGElement;
  scaleEl: SVGGElement;
  x: number;
  y: number;
  vy: number;
  rot: number;
  vrot: number;
  landed: boolean;
  bites: number;
}

type State = 'idle' | 'roam' | 'alert' | 'chase' | 'eat';

export interface RabbitLayer {
  tick(now: number): void;
  dropCarrot(screenX: number, screenY: number): void;
  resize(): void;
}

function el<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number>,
  parent?: SVGElement
): SVGElementTagNameMap[K] {
  const e = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  parent?.appendChild(e);
  return e;
}

function buildRabbit(parent: SVGGElement): { root: SVGGElement; squash: SVGGElement; bubble: SVGGElement } {
  const root = el('g', { class: 'rabbit' }, parent);
  const squash = el('g', {}, root);
  // Origin is the rabbit's ground contact point; the sprite is drawn upward.
  el('circle', { cx: -15, cy: -12, r: 5, fill: WHITE }, squash); // tail
  el('ellipse', { cx: 0, cy: -13, rx: 16, ry: 12, fill: WHITE }, squash); // body
  // ears (behind the head), slightly splayed
  el('rect', { x: 3, y: -55, width: 7, height: 24, rx: 3.5, fill: WHITE, transform: 'rotate(-8 6.5 -43)' }, squash);
  el('rect', { x: 13, y: -54, width: 7, height: 24, rx: 3.5, fill: WHITE, transform: 'rotate(8 16.5 -42)' }, squash);
  el('rect', { x: 5, y: -52, width: 3, height: 17, rx: 1.5, fill: PINK, transform: 'rotate(-8 6.5 -43)' }, squash);
  el('rect', { x: 15, y: -51, width: 3, height: 17, rx: 1.5, fill: PINK, transform: 'rotate(8 16.5 -42)' }, squash);
  el('circle', { cx: 10, cy: -27, r: 10.5, fill: WHITE }, squash); // head
  el('circle', { cx: 13, cy: -29, r: 1.7, fill: NAVY }, squash); // eye
  el('circle', { cx: 20, cy: -26, r: 1.8, fill: PINK }, squash); // nose
  el('ellipse', { cx: 8, cy: -2.5, rx: 6, ry: 2.5, fill: WHITE }, squash); // front paw

  // "!" alert bubble
  const bubble = el('g', { class: 'alert-bubble', visibility: 'hidden' }, root);
  el('rect', { x: -9, y: -86, width: 18, height: 22, rx: 7, fill: WHITE, stroke: NAVY, 'stroke-width': 2 }, bubble);
  el('text', {
    x: 0,
    y: -69,
    'text-anchor': 'middle',
    fill: NAVY,
    'font-size': 16,
    'font-weight': 'bold',
    'font-family': 'Arial Rounded MT Bold, sans-serif',
  }, bubble).textContent = '!';
  return { root, squash, bubble };
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
  const { root: rabbitEl, squash, bubble } = buildRabbit(layer);

  const groundY = () => window.innerHeight - GROUND_LIFT;
  const carrots: Carrot[] = [];

  let x = window.innerWidth * 0.3;
  let dir = 1;
  let state: State = 'idle';
  let stateUntil = 0;
  let roamTarget = x;
  let midHop = false;
  let hopFrom = 0;
  let hopTo = 0;
  let hopStart = 0;
  let hopDur = ROAM_HOP_MS;
  let hopHeight = 22;
  let eating: Carrot | null = null;
  let chasing: Carrot | null = null; // locked target — prevents dithering between close carrots
  let lastBite = 0;
  let lastNow = 0;
  let eaten = 0;
  let growth = rabbitGrowth(0); // supplies bite speed (a kept achievement)
  let stages = 0;
  let sizeScale = 1; // current displayed size: milestones grow it, hunger shrinks it
  let nextHungerAt = -1;
  let growPulseAt = -Infinity;
  let shrinkPulseAt = -Infinity;

  function layoutGround(): void {
    ground.setAttribute('x', '-20');
    ground.setAttribute('width', String(window.innerWidth + 40));
    ground.setAttribute('y', String(window.innerHeight - 18));
  }
  layoutGround();

  function nearestLanded(): Carrot | null {
    let best: Carrot | null = null;
    let bestD = Infinity;
    for (const c of carrots) {
      if (!c.landed) continue;
      const d = Math.abs(c.x - x);
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }
    return best;
  }

  function removeCarrot(c: Carrot): void {
    const i = carrots.indexOf(c);
    if (i >= 0) carrots.splice(i, 1);
    c.el.remove();
    if (eating === c) eating = null;
    if (chasing === c) chasing = null;
  }

  function onCarrotLanded(now: number): void {
    if (state === 'idle' || state === 'roam') {
      state = 'alert';
      stateUntil = now + ALERT_MS;
      midHop = false;
      bubble.setAttribute('visibility', 'visible');
    }
  }

  function startHop(now: number, target: number, chase: boolean): void {
    const len = chase ? CHASE_HOP_LEN : ROAM_HOP_LEN;
    const delta = Math.max(-len, Math.min(len, target - x));
    hopFrom = x;
    hopTo = x + delta;
    hopStart = now;
    hopDur = chase ? CHASE_HOP_MS : ROAM_HOP_MS;
    hopHeight = chase ? 26 : 22;
    if (Math.abs(delta) > 1) dir = delta > 0 ? 1 : -1;
    midHop = true;
  }

  function tick(now: number): void {
    const dt = lastNow ? Math.min(50, now - lastNow) : 16;
    lastNow = now;
    const gy = groundY();

    // --- hunger clock: every 30s without a meal, shrink 10% back toward
    // the original size (never below it) ---
    if (nextHungerAt < 0) nextHungerAt = now + HUNGER_INTERVAL_MS;
    if (now >= nextHungerAt) {
      nextHungerAt = now + HUNGER_INTERVAL_MS;
      if (sizeScale > 1) {
        sizeScale = hungerShrink(sizeScale);
        shrinkPulseAt = now;
        playShrink();
      }
    }

    // --- carrot physics ---
    for (const c of [...carrots]) {
      if (!c.landed) {
        c.vy += 0.0022 * dt * dt; // gravity, dt-scaled
        c.y += c.vy;
        c.rot += c.vrot;
        // Land so the carrot's tip (17px below its origin) rests on the grass.
        if (c.y >= gy - 18) {
          c.y = gy - 18;
          c.landed = true;
          c.rot = c.rot % 20 - 10; // settle at a slight tilt
          onCarrotLanded(now);
        }
        c.el.setAttribute('transform', `translate(${c.x},${c.y}) rotate(${c.rot})`);
      }
    }

    // --- state machine ---
    let hopOffset = 0;
    let squashY = 1;

    if (state === 'alert' && now >= stateUntil) {
      bubble.setAttribute('visibility', 'hidden');
      state = 'chase';
    }

    if (state === 'idle') {
      squashY = 1 + Math.sin(now / 380) * 0.02; // breathing
      if (nearestLanded()) {
        state = 'chase';
      } else if (now >= stateUntil) {
        roamTarget = 40 + Math.random() * (window.innerWidth - 80);
        state = 'roam';
      }
    } else if (state === 'roam' || state === 'chase') {
      const chase = state === 'chase';
      let target = roamTarget;
      if (chase) {
        // Stay locked on one carrot until it's gone — re-picking "nearest"
        // every hop makes the rabbit dither between two close carrots.
        if (!chasing || !carrots.includes(chasing) || !chasing.landed) chasing = nearestLanded();
        if (!chasing) {
          state = 'idle';
          stateUntil = now + 800;
          target = x;
        } else {
          target = chasing.x;
        }
      }
      if (state === 'roam' || state === 'chase') {
        if (!midHop) {
          // Arrival is a tolerance band, not an exact point — the target
          // must never depend on which way the rabbit currently faces.
          const tol = chase ? Math.max(16, 14 * sizeScale) : 10;
          if (Math.abs(target - x) < tol) {
            if (chase && chasing) {
              state = 'eat';
              eating = chasing;
              chasing = null;
              lastBite = now;
              dir = eating.x >= x ? 1 : -1;
            } else if (!chase) {
              state = 'idle';
              stateUntil = now + 1200 + Math.random() * 2600;
            }
          } else {
            startHop(now, target, chase);
          }
        }
        if (midHop) {
          const t = Math.min(1, (now - hopStart) / hopDur);
          x = hopFrom + (hopTo - hopFrom) * t;
          hopOffset = Math.sin(t * Math.PI) * hopHeight;
          squashY = 1 + Math.sin(t * Math.PI) * 0.08; // stretch mid-air
          if (t >= 1) {
            midHop = false;
            squashY = 0.94; // landing squash
          }
        }
      }
    } else if (state === 'eat') {
      if (!eating || !carrots.includes(eating)) {
        eating = null;
        state = nearestLanded() ? 'chase' : 'idle';
        stateUntil = now + 900;
      } else {
        squashY = 1 - Math.abs(Math.sin(now / 90)) * 0.06; // munching bob
        if (now - lastBite >= growth.biteMs) {
          lastBite = now;
          eating.bites++;
          playNibble();
          const s = Math.max(0, 1 - eating.bites / BITES);
          eating.scaleEl.setAttribute('transform', `scale(${0.4 + 0.6 * s})`);
          eating.scaleEl.setAttribute('opacity', String(0.3 + 0.7 * s));
          if (eating.bites >= BITES) {
            removeCarrot(eating);
            eaten++;
            nextHungerAt = now + HUNGER_INTERVAL_MS; // fed — hunger clock resets
            const ns = rabbitStages(eaten);
            if (ns > stages) {
              sizeScale *= Math.pow(1.25, ns - stages); // level up!
              stages = ns;
              growPulseAt = now;
              playPop();
            }
            growth = rabbitGrowth(eaten);
            state = nearestLanded() ? 'chase' : 'idle';
            stateUntil = now + 1000;
          }
        }
      }
    }

    const sinceGrow = now - growPulseAt;
    const sinceShrink = now - shrinkPulseAt;
    let pulse = 1;
    if (sinceGrow < GROW_PULSE_MS) pulse = 1 + 0.18 * Math.sin((sinceGrow / GROW_PULSE_MS) * Math.PI);
    else if (sinceShrink < GROW_PULSE_MS) pulse = 1 - 0.12 * Math.sin((sinceShrink / GROW_PULSE_MS) * Math.PI);
    const size = sizeScale * pulse;
    rabbitEl.setAttribute('transform', `translate(${x},${gy - hopOffset}) scale(${dir * size},${size})`);
    squash.setAttribute('transform', `scale(1,${squashY})`);
  }

  function dropCarrot(screenX: number, screenY: number): void {
    const w = window.innerWidth;
    const cx = Math.max(24, Math.min(w - 24, screenX));
    const startY = Math.max(60, Math.min(screenY, groundY() - 60));
    const { el: cEl, scaleEl } = buildCarrot(carrotG);
    const c: Carrot = {
      el: cEl,
      scaleEl,
      x: cx,
      y: startY,
      vy: 0,
      rot: (Math.random() - 0.5) * 30,
      vrot: (Math.random() - 0.5) * 3,
      landed: false,
      bites: 0,
    };
    cEl.setAttribute('transform', `translate(${c.x},${c.y}) rotate(${c.rot})`);
    carrots.push(c);
    // Keep the ground from becoming a carrot warehouse.
    while (carrots.length > MAX_CARROTS) {
      const oldest = carrots.find((k) => k !== eating);
      if (!oldest) break;
      removeCarrot(oldest);
    }
  }

  function resize(): void {
    layoutGround();
    x = Math.max(30, Math.min(window.innerWidth - 30, x));
  }

  return { tick, dropCarrot, resize };
}
