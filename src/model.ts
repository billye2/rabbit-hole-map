// Pure graph model for Rabbit Hole Map. No chrome.* usage here so it can be
// unit-tested in plain Node.

export interface PageNode {
  id: string; // normalized URL
  url: string;
  title: string;
  domain: string;
  firstVisit: number;
  lastVisit: number;
  visits: number;
}

export interface NavEdge {
  from: string; // node id
  to: string; // node id
  time: number;
  transition: string;
}

export interface Session {
  id: string;
  start: number;
  end: number;
  nodes: Record<string, PageNode>;
  edges: NavEdge[];
}

export interface SessionMeta {
  id: string;
  start: number;
  end: number;
  pages: number;
}

export interface NavEvent {
  url: string;
  sourceUrl: string | null;
  time: number;
  transition: string;
  title?: string;
}

export const SESSION_GAP_MS = 30 * 60 * 1000;

export function normalizeUrl(raw: string): string {
  try {
    const u = new URL(raw);
    u.hash = '';
    return u.toString();
  } catch {
    return raw;
  }
}

export function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

export function shouldTrack(url: string, blocklist: string[]): boolean {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
  const host = u.hostname.replace(/^www\./, '');
  return !blocklist.some((b) => host === b || host.endsWith('.' + b));
}

export function needsNewSession(session: Session | null, time: number): boolean {
  return !session || time - session.end > SESSION_GAP_MS;
}

export function createSession(time: number): Session {
  return { id: String(time), start: time, end: time, nodes: {}, edges: [] };
}

export function applyNavEvent(session: Session, ev: NavEvent): void {
  const id = normalizeUrl(ev.url);
  let node = session.nodes[id];
  if (!node) {
    node = {
      id,
      url: id,
      title: ev.title ?? '',
      domain: domainOf(id),
      firstVisit: ev.time,
      lastVisit: ev.time,
      visits: 0,
    };
    session.nodes[id] = node;
  }
  node.visits += 1;
  node.lastVisit = ev.time;
  if (ev.title) node.title = ev.title;

  const from = ev.sourceUrl ? normalizeUrl(ev.sourceUrl) : null;
  if (from && from !== id && session.nodes[from]) {
    const last = session.edges[session.edges.length - 1];
    const dup = last && last.from === from && last.to === id && ev.time - last.time < 2000;
    if (!dup) session.edges.push({ from, to: id, time: ev.time, transition: ev.transition });
  }
  session.end = Math.max(session.end, ev.time);
}

export function updateTitle(session: Session, url: string, title: string): boolean {
  const node = session.nodes[normalizeUrl(url)];
  if (node && title && node.title !== title) {
    node.title = title;
    return true;
  }
  return false;
}

// Longest time-ordered chain of hops: edges sorted by time form a DAG in
// practice, so a single DP pass gives the deepest rabbit hole.
export function longestChain(session: Session): number {
  const edges = [...session.edges].sort((a, b) => a.time - b.time);
  const depth = new Map<string, number>();
  let best = Object.keys(session.nodes).length > 0 ? 1 : 0;
  for (const e of edges) {
    const d = (depth.get(e.from) ?? 1) + 1;
    if (d > (depth.get(e.to) ?? 1)) depth.set(e.to, d);
    if (d > best) best = d;
  }
  return best;
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

export function fmtDuration(ms: number): string {
  const m = Math.round(ms / 60000);
  if (m < 1) return 'under a minute';
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

export function topDomain(session: Session): string | null {
  const counts = new Map<string, number>();
  for (const n of Object.values(session.nodes)) {
    counts.set(n.domain, (counts.get(n.domain) ?? 0) + n.visits);
  }
  let bestDomain: string | null = null;
  let bestCount = 0;
  for (const [d, c] of counts) {
    if (c > bestCount) {
      bestCount = c;
      bestDomain = d;
    }
  }
  return bestDomain;
}
