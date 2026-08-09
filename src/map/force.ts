// Tiny force-directed layout: pairwise repulsion, spring edges, center
// gravity, velocity damping. O(n²) per tick — fine for the hundreds of nodes
// a browsing session produces.

export interface SimNode {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  pinned: boolean;
}

export interface SimEdge {
  from: number; // index into nodes
  to: number;
}

const REPULSION = 6000;
const SPRING_K = 0.03;
const SPRING_LEN = 110;
const GRAVITY = 0.015;
const DAMPING = 0.85;
const MAX_SPEED = 12;

// Deterministic pseudo-random seed from a string, so layouts are stable
// across reloads for the same session.
export function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

export class ForceSim {
  nodes: SimNode[] = [];
  edges: SimEdge[] = [];
  width: number;
  height: number;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

  // Adds a node if new, keeping existing positions so live updates don't
  // scramble the layout.
  ensureNode(id: string, r: number): SimNode {
    let n = this.nodes.find((n) => n.id === id);
    if (!n) {
      const a = hashSeed(id) * Math.PI * 2;
      const dist = 60 + hashSeed(id + '#') * 160;
      n = {
        id,
        x: this.width / 2 + Math.cos(a) * dist,
        y: this.height / 2 + Math.sin(a) * dist,
        vx: 0,
        vy: 0,
        r,
        pinned: false,
      };
      this.nodes.push(n);
    }
    n.r = r;
    return n;
  }

  setEdges(pairs: Array<[string, string]>): void {
    const index = new Map(this.nodes.map((n, i) => [n.id, i]));
    this.edges = [];
    for (const [a, b] of pairs) {
      const i = index.get(a);
      const j = index.get(b);
      if (i != null && j != null && i !== j) this.edges.push({ from: i, to: j });
    }
  }

  // Returns max node speed this tick (used to detect settling).
  tick(): number {
    const ns = this.nodes;
    for (let i = 0; i < ns.length; i++) {
      for (let j = i + 1; j < ns.length; j++) {
        const a = ns[i];
        const b = ns[j];
        let dx = a.x - b.x;
        let dy = a.y - b.y;
        let d2 = dx * dx + dy * dy;
        if (d2 < 1) {
          // Coincident nodes: nudge apart deterministically.
          dx = (hashSeed(a.id + b.id) - 0.5) * 2;
          dy = (hashSeed(b.id + a.id) - 0.5) * 2;
          d2 = dx * dx + dy * dy;
        }
        const d = Math.sqrt(d2);
        const f = Math.min(REPULSION / d2, 40);
        const fx = (dx / d) * f;
        const fy = (dy / d) * f;
        a.vx += fx;
        a.vy += fy;
        b.vx -= fx;
        b.vy -= fy;
      }
    }

    for (const e of this.edges) {
      const a = ns[e.from];
      const b = ns[e.to];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      const f = SPRING_K * (d - SPRING_LEN);
      const fx = (dx / d) * f;
      const fy = (dy / d) * f;
      a.vx += fx;
      a.vy += fy;
      b.vx -= fx;
      b.vy -= fy;
    }

    const cx = this.width / 2;
    const cy = this.height / 2;
    let maxSpeed = 0;
    for (const n of ns) {
      if (n.pinned) {
        // Pinned nodes are immovable anchors: shed accumulated forces so
        // they neither drift nor keep the sim from settling.
        n.vx = 0;
        n.vy = 0;
        continue;
      }
      n.vx += (cx - n.x) * GRAVITY;
      n.vy += (cy - n.y) * GRAVITY;
      n.vx *= DAMPING;
      n.vy *= DAMPING;
      const speed = Math.sqrt(n.vx * n.vx + n.vy * n.vy);
      if (speed > MAX_SPEED) {
        n.vx = (n.vx / speed) * MAX_SPEED;
        n.vy = (n.vy / speed) * MAX_SPEED;
      }
      n.x += n.vx;
      n.y += n.vy;
      if (speed > maxSpeed) maxSpeed = speed;
    }
    return maxSpeed;
  }

  reheat(): void {
    for (const n of this.nodes) {
      n.vx += (hashSeed(n.id + '!') - 0.5) * 4;
      n.vy += (hashSeed(n.id + '?') - 0.5) * 4;
    }
  }
}
