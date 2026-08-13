// Pure view-state decisions for the map page: what part of the session is
// visible under a replay cutoff, the replay timeline, the Untangle layout,
// zoom-to-fit, and edge-trim geometry. No DOM, no chrome.*, no globals —
// map.ts only wires these results onto SVG (emitted as dist/view.mjs for
// node --test).
import type { NavEdge, PageNode, Session } from '../model.js';

export interface ViewTransform {
  x: number;
  y: number;
  k: number;
}

// The slice of the session visible at a replay cutoff (Infinity = live).
export function visibleGraph(session: Session | null, cutoff: number): { nodes: PageNode[]; edges: NavEdge[] } {
  if (!session) return { nodes: [], edges: [] };
  const nodes = Object.values(session.nodes).filter((n) => n.firstVisit <= cutoff);
  const ids = new Set(nodes.map((n) => n.id));
  const edges = session.edges.filter((e) => e.time <= cutoff && ids.has(e.from) && ids.has(e.to));
  return { nodes, edges };
}

// Every moment something happened, deduplicated and in order — the replay
// slider's domain.
export function eventTimeline(session: Session | null): number[] {
  if (!session) return [];
  const times = [...Object.values(session.nodes).map((n) => n.firstVisit), ...session.edges.map((e) => e.time)];
  return [...new Set(times)].sort((a, b) => a - b);
}

// "Untangle" layout: arrange the navigation forest so no two trails overlap.
// Each node's parent is the source of its earliest incoming edge; depth maps
// to a column, and leaves are stacked on distinct rows (parents centered over
// their children), so every path reads left-to-right in its own lane.
export function tidyLayout(session: Session): Record<string, { col: number; row: number }> {
  const byTime = [...session.edges].sort((a, b) => a.time - b.time);
  const parent: Record<string, string> = {};
  const isAncestor = (maybeAncestor: string, of: string): boolean => {
    for (let cur: string | undefined = of; cur != null; cur = parent[cur]) {
      if (cur === maybeAncestor) return true;
    }
    return false;
  };
  for (const e of byTime) {
    if (e.from === e.to || parent[e.to] != null) continue;
    if (!session.nodes[e.from] || !session.nodes[e.to]) continue;
    if (isAncestor(e.to, e.from)) continue; // a back-edge must not create a cycle
    parent[e.to] = e.from;
  }

  const children: Record<string, string[]> = {};
  const roots: string[] = [];
  const inTimeOrder = Object.values(session.nodes).sort((a, b) => a.firstVisit - b.firstVisit);
  for (const n of inTimeOrder) {
    const p = parent[n.id];
    if (p == null) roots.push(n.id);
    else (children[p] ??= []).push(n.id);
  }

  const out: Record<string, { col: number; row: number }> = {};
  let row = 0;
  const place = (id: string, depth: number): number => {
    const kids = children[id] ?? [];
    if (kids.length === 0) {
      out[id] = { col: depth, row: row++ };
      return out[id].row;
    }
    const kidRows = kids.map((k) => place(k, depth + 1));
    const mid = (kidRows[0] + kidRows[kidRows.length - 1]) / 2;
    out[id] = { col: depth, row: mid };
    return mid;
  };
  for (const r of roots) {
    place(r, 0);
    row += 0.5; // breathing room between separate trees
  }
  return out;
}

const UNTANGLE_LEFT = 120;
const UNTANGLE_TOP = 160;
const COL_W = 190;
const ROW_H = 74;

// The Untangle layout in pixels: one point per node, lanes left-to-right.
export function untanglePositions(session: Session): Record<string, { x: number; y: number }> {
  const grid = tidyLayout(session);
  const out: Record<string, { x: number; y: number }> = {};
  for (const [id, p] of Object.entries(grid)) {
    out[id] = { x: UNTANGLE_LEFT + p.col * COL_W, y: UNTANGLE_TOP + p.row * ROW_H };
  }
  return out;
}

// Pan/zoom so the whole layout is visible below the HUD (never zooms in
// past 1:1). Margins leave room for labels on the right.
export function fitTransform(
  points: ReadonlyArray<{ x: number; y: number }>,
  viewport: { width: number; height: number; top: number },
): ViewTransform | null {
  if (!points.length) return null;
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs) - 90;
  const maxX = Math.max(...xs) + 170;
  const minY = Math.min(...ys) - 70;
  const maxY = Math.max(...ys) + 70;
  const { width: w, height: h, top } = viewport;
  const k = Math.min(1, w / (maxX - minX), (h - top) / (maxY - minY));
  return {
    k,
    x: (w - (maxX - minX) * k) / 2 - minX * k,
    y: top + (h - top - (maxY - minY) * k) / 2 - minY * k,
  };
}

// Shorten the line so the arrowhead lands on the target circle's rim.
export function trimmedEdge(
  a: { x: number; y: number },
  b: { x: number; y: number; r: number },
): { x1: number; y1: number; x2: number; y2: number } {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const d = Math.sqrt(dx * dx + dy * dy) || 1;
  const trim = b.r + 5;
  return { x1: a.x, y1: a.y, x2: b.x - (dx / d) * trim, y2: b.y - (dy / d) * trim };
}
