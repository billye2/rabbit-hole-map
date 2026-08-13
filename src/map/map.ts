import { fmtDuration, type NavEdge, type PageNode, type Session, type SessionMeta } from '../model.js';
import * as store from '../storage.js';
import { ForceSim, hashSeed } from './force.js';
import { eventTimeline, fitTransform, trimmedEdge, untanglePositions, visibleGraph as visibleAt } from './view.js';
import { isMuted, playPop, setMuted } from './audio.js';
import { initRabbit } from './rabbit.js';

// The whole page lives behind main() — importing this module has no side
// effects, so the pure pieces stay reachable outside map.html. The build's
// map entry (boot.ts) is the only caller.
export function main(): void {
  const svg = document.getElementById('canvas') as unknown as SVGSVGElement;
  const viewport = document.getElementById('viewport') as unknown as SVGGElement;
  const edgesG = document.getElementById('edges') as unknown as SVGGElement;
  const nodesG = document.getElementById('nodes') as unknown as SVGGElement;
  const sessionSelect = document.getElementById('session-select') as HTMLSelectElement;
  const statsEl = document.getElementById('stats') as HTMLSpanElement;
  const emptyEl = document.getElementById('empty') as HTMLDivElement;
  const replayRange = document.getElementById('replay-range') as HTMLInputElement;
  const replayLabel = document.getElementById('replay-label') as HTMLSpanElement;
  const replayPlay = document.getElementById('replay-play') as HTMLButtonElement;
  const exportBtn = document.getElementById('export') as HTMLButtonElement;

  const SVGNS = 'http://www.w3.org/2000/svg';

  // The roaming rabbit + crate ground layer (screen-space, above the graph).
  const rabbit = initRabbit(svg);

  let session: Session | null = null;
  let sim = new ForceSim(window.innerWidth, window.innerHeight);
  let nodeEls = new Map<string, SVGGElement>();
  // Edge endpoint ids ride along on the line elements between ticks.
  type EdgeLine = SVGLineElement & { _from: string; _to: string };
  let edgeEls: EdgeLine[] = [];
  let settleTicks = 0;

  // Replay state: null = live view, otherwise index into the event timeline.
  let eventTimes: number[] = [];
  let replayCutoff: number | null = null;
  let replayTimer: number | null = null;

  // Nodes that have already popped in — so live updates only bounce newcomers.
  let seenNodeIds = new Set<string>();

  // Nodes the USER pinned by dragging (gold ring). Distinct from sim-level
  // pinning, which untangle mode also uses to freeze the tidy layout.
  const userPinned = new Set<string>();

  // Untangle mode: tidy tree layout instead of the force-directed tangle.
  let untangled = false;

  // Pan/zoom state applied to #viewport.
  let view = { x: 0, y: 0, k: 1 };

  // Candy-cabinet palette: every domain gets a power-up color.
  const CANDY = [
    '#ff4d6d', // cherry
    '#ff9f1c', // orange soda
    '#ffd60a', // coin
    '#06d6a0', // 1-up green
    '#4cc9f0', // ice flower
    '#f15bb5', // bubblegum
    '#9b5de5', // grape
    '#ff6b35', // fire flower
    '#00f5d4', // mint star
  ];

  function domainColor(domain: string): string {
    return CANDY[Math.floor(hashSeed(domain) * CANDY.length) % CANDY.length];
  }

  function nodeRadius(n: PageNode): number {
    return 8 + Math.min(14, (n.visits - 1) * 3);
  }

  function faviconUrl(pageUrl: string): string {
    const u = new URL(chrome.runtime.getURL('/_favicon/'));
    u.searchParams.set('pageUrl', pageUrl);
    u.searchParams.set('size', '32');
    return u.toString();
  }

  function label(n: PageNode): string {
    const t = n.title || n.domain || n.url;
    return t.length > 34 ? t.slice(0, 33) + '…' : t;
  }

  function fmtTime(ts: number): string {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function fmtSessionLabel(m: SessionMeta): string {
    const d = new Date(m.start);
    const day = d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    return `${day} ${fmtTime(m.start)} · ${m.pages} pages`;
  }

  function visibleGraph(): { nodes: PageNode[]; edges: NavEdge[] } {
    const cutoff = replayCutoff == null ? Infinity : (eventTimes[replayCutoff] ?? Infinity);
    return visibleAt(session, cutoff);
  }

  function rebuild(): void {
    const { nodes, edges } = visibleGraph();
    emptyEl.style.display = nodes.length === 0 ? 'flex' : 'none';

    // One call describes the visible graph: survivors keep their positions,
    // nodes scrubbed out of a replay are dropped, edges ride along by id.
    sim.setGraph(
      nodes.map((n) => ({ id: n.id, r: nodeRadius(n) })),
      edges.map((e) => [e.from, e.to]),
    );

    // --- edges ---
    edgesG.textContent = '';
    edgeEls = [];
    const lastEdgeTime = edges.length ? edges[edges.length - 1].time : -1;
    for (const e of edges) {
      const line = document.createElementNS(SVGNS, 'line') as EdgeLine;
      line.setAttribute('class', 'edge' + (e.time === lastEdgeTime && replayCutoff != null ? ' fresh' : ''));
      line.setAttribute('marker-end', 'url(#arrow)');
      edgesG.appendChild(line);
      edgeEls.push(line);
    }

    // --- nodes ---
    nodesG.textContent = '';
    nodeEls = new Map();
    const byId = new Map(nodes.map((n) => [n.id, n]));
    for (const n of nodes) {
      const g = document.createElementNS(SVGNS, 'g');
      g.setAttribute('class', 'node' + (userPinned.has(n.id) ? ' pinned' : ''));
      const r = nodeRadius(n);

      // Inner group carries the bounce-in animation so it doesn't fight the
      // outer group's position transform. Only brand-new nodes get the pop.
      const pop = document.createElementNS(SVGNS, 'g');
      pop.setAttribute('class', seenNodeIds.has(n.id) ? '' : 'pop');
      seenNodeIds.add(n.id);
      g.appendChild(pop);

      const shadow = document.createElementNS(SVGNS, 'circle');
      shadow.setAttribute('r', String(r + 5));
      shadow.setAttribute('cy', '3');
      shadow.setAttribute('fill', 'rgba(43, 40, 87, 0.35)');
      pop.appendChild(shadow);

      const ring = document.createElementNS(SVGNS, 'circle');
      ring.setAttribute('class', 'ring');
      ring.setAttribute('r', String(r + 3));
      pop.appendChild(ring);

      const dot = document.createElementNS(SVGNS, 'circle');
      dot.setAttribute('r', String(r));
      dot.setAttribute('fill', domainColor(n.domain));
      pop.appendChild(dot);

      const img = document.createElementNS(SVGNS, 'image');
      img.setAttribute('href', faviconUrl(n.url));
      const s = r * 1.1;
      img.setAttribute('x', String(-s / 2));
      img.setAttribute('y', String(-s / 2));
      img.setAttribute('width', String(s));
      img.setAttribute('height', String(s));
      img.setAttribute('pointer-events', 'none');
      pop.appendChild(img);

      const text = document.createElementNS(SVGNS, 'text');
      text.setAttribute('y', String(r + 16));
      text.setAttribute('text-anchor', 'middle');
      text.textContent = label(n);
      pop.appendChild(text);

      const tip = document.createElementNS(SVGNS, 'title');
      tip.textContent = `${n.title || '(untitled)'}\n${n.url}\n${n.visits} visit${n.visits === 1 ? '' : 's'}\n↪ double-click to jump back in\n📌 drag to place (stays put) · ⌥-click to release`;
      g.appendChild(tip);

      g.addEventListener('dblclick', () => chrome.tabs.create({ url: n.url }));
      attachDrag(g, n.id);

      nodesG.appendChild(g);
      nodeEls.set(n.id, g);
    }

    // Edge endpoints resolved per tick via sim node lookup.
    edgeEls.forEach((line, i) => {
      const e = edges[i];
      line._from = e.from;
      line._to = e.to;
      void byId;
    });

    updateStats(nodes, edges);
    settleTicks = 0;
    if (untangled) {
      applyUntangle(); // keep the tidy layout, including any just-added nodes
    } else {
      sim.reheat();
      // Position the fresh elements immediately: the rAF loop is paused while
      // the tab is hidden, and unpositioned nodes would all sit at (0,0).
      renderPositions();
    }
  }

  // Live arrivals only — the store names the nodes this very write added, so
  // opening an old session or scrubbing a replay is never a feast.
  function celebrateLiveArrivals(ids: string[]): void {
    if (replayCutoff != null) return; // replay renders history; it never feeds the rabbit
    // A burst of new nodes plays as a rising arpeggio, capped so a giant
    // update doesn't turn into a slot machine.
    for (let i = 0; i < Math.min(ids.length, 5); i++) setTimeout(playPop, i * 90);
    // Every live-added site drops a crate from its node for the rabbit.
    const pos = new Map(sim.nodes.map((sn) => [sn.id, sn]));
    for (const id of ids.slice(0, 12)) {
      const p = pos.get(id);
      if (p) rabbit.dropCrate(p.x * view.k + view.x, p.y * view.k + view.y);
    }
  }

  function updateStats(nodes: PageNode[], edges: NavEdge[]): void {
    if (!nodes.length || !session) {
      statsEl.textContent = '';
      return;
    }
    const wasted = fmtDuration(session.end - session.start);
    statsEl.textContent = `⭐ ${nodes.length} pages · ${edges.length} hops · ⏱ ${wasted} well wasted`;
  }

  function renderPositions(): void {
    const pos = new Map(sim.nodes.map((n) => [n.id, n]));
    for (const [id, g] of nodeEls) {
      const p = pos.get(id);
      if (p) g.setAttribute('transform', `translate(${p.x},${p.y})`);
    }
    for (const line of edgeEls) {
      const a = pos.get(line._from);
      const b = pos.get(line._to);
      if (!a || !b) continue;
      const t = trimmedEdge(a, b);
      line.setAttribute('x1', String(t.x1));
      line.setAttribute('y1', String(t.y1));
      line.setAttribute('x2', String(t.x2));
      line.setAttribute('y2', String(t.y2));
    }
  }

  function frame(): void {
    if (settleTicks < 600) {
      const v = sim.tick();
      renderPositions();
      if (v < 0.05) settleTicks = 600;
      else settleTicks++;
    }
    rabbit.tick(performance.now());
    requestAnimationFrame(frame);
  }

  // ---------- drag / pan / zoom ----------

  function svgPoint(clientX: number, clientY: number): { x: number; y: number } {
    return { x: (clientX - view.x) / view.k, y: (clientY - view.y) / view.k };
  }

  function applyView(): void {
    viewport.setAttribute('transform', `translate(${view.x},${view.y}) scale(${view.k})`);
  }

  function attachDrag(g: SVGGElement, id: string): void {
    g.addEventListener('pointerdown', (ev) => {
      ev.stopPropagation();
      if (!sim.has(id)) return;

      // Alt-click releases a user-pinned node back to the physics.
      if (ev.altKey && userPinned.has(id)) {
        userPinned.delete(id);
        if (!untangled) sim.release(id);
        g.classList.remove('pinned');
        settleTicks = 0;
        return;
      }

      sim.pin(id);
      const wasPinned = g.classList.contains('pinned');
      let moved = false;
      const startX = ev.clientX;
      const startY = ev.clientY;
      const move = (mv: PointerEvent) => {
        if (Math.hypot(mv.clientX - startX, mv.clientY - startY) > 4) moved = true;
        const p = svgPoint(mv.clientX, mv.clientY);
        // Address the node by id: a live rebuild mid-drag may have replaced
        // the sim's node set, and the current sim is always the right target.
        sim.place(id, p.x, p.y);
        settleTicks = 0;
        renderPositions();
      };
      const up = () => {
        // A real drag pins the node where the user left it — no scrunching
        // back. A plain click (no movement) keeps whatever state it had.
        // Look the element up fresh: a live rebuild mid-drag replaces the DOM
        // and `g` may be detached by the time the pointer lifts.
        if (moved) {
          userPinned.add(id);
          (nodeEls.get(id) ?? g).classList.add('pinned');
        } else if (!wasPinned && !untangled) {
          sim.release(id);
        }
        settleTicks = 0;
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    });
  }

  svg.addEventListener('pointerdown', (ev) => {
    svg.classList.add('panning');
    const start = { x: ev.clientX, y: ev.clientY, vx: view.x, vy: view.y };
    const move = (mv: PointerEvent) => {
      view.x = start.vx + (mv.clientX - start.x);
      view.y = start.vy + (mv.clientY - start.y);
      applyView();
    };
    const up = () => {
      svg.classList.remove('panning');
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  });

  svg.addEventListener(
    'wheel',
    (ev) => {
      ev.preventDefault();
      const factor = ev.deltaY < 0 ? 1.1 : 1 / 1.1;
      const k2 = Math.min(4, Math.max(0.2, view.k * factor));
      // Zoom around the cursor.
      view.x = ev.clientX - ((ev.clientX - view.x) / view.k) * k2;
      view.y = ev.clientY - ((ev.clientY - view.y) / view.k) * k2;
      view.k = k2;
      applyView();
    },
    { passive: false },
  );

  // ---------- replay ----------

  function computeTimeline(): void {
    eventTimes = eventTimeline(session);
    if (!session) return;
    replayRange.max = String(eventTimes.length);
    if (replayCutoff == null) replayRange.value = replayRange.max;
  }

  function setReplay(cutoff: number | null): void {
    replayCutoff = cutoff;
    if (cutoff == null) {
      replayLabel.textContent = 'live';
      replayRange.value = replayRange.max;
    } else {
      const t = eventTimes[cutoff];
      replayLabel.textContent = t != null ? fmtTime(t) : 'start';
    }
    rebuild();
  }

  replayRange.addEventListener('input', () => {
    stopReplayTimer();
    const v = Number(replayRange.value);
    setReplay(v >= eventTimes.length ? null : v);
  });

  function stopReplayTimer(): void {
    if (replayTimer != null) {
      clearInterval(replayTimer);
      replayTimer = null;
      replayPlay.textContent = '▶ Replay';
      replayPlay.dataset.tip = 'Replay your descent from the top';
    }
  }

  replayPlay.addEventListener('click', () => {
    if (replayTimer != null) {
      stopReplayTimer();
      return;
    }
    let i = replayCutoff != null && replayCutoff < eventTimes.length ? replayCutoff : 0;
    if (i === 0) seenNodeIds = new Set(); // fresh run: let every node bounce back in
    setReplay(i);
    replayPlay.textContent = '⏸ Pause';
    replayPlay.dataset.tip = 'Pause the replay';
    replayTimer = window.setInterval(() => {
      i++;
      if (i >= eventTimes.length) {
        stopReplayTimer();
        setReplay(null);
        return;
      }
      replayRange.value = String(i);
      setReplay(i);
    }, 650);
  });

  // ---------- export ----------

  exportBtn.addEventListener('click', async () => {
    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute('xmlns', SVGNS);
    clone.setAttribute('width', String(window.innerWidth));
    clone.setAttribute('height', String(window.innerHeight));
    const style = document.createElementNS(SVGNS, 'style');
    style.textContent = `
    .edge { stroke: #ffffff; stroke-width: 3.5; stroke-linecap: round; opacity: 0.95; }
    .edge.fresh { stroke: #ffd60a; }
    .node circle.ring { fill: none; stroke: #ffffff; stroke-width: 3.5; }
    .node.pinned circle.ring { stroke: #ffd60a; }
    .node text { fill: #2b2857; font: 700 11px "Arial Rounded MT Bold", sans-serif;
      paint-order: stroke; stroke: #ffffff; stroke-width: 3.5px; stroke-linejoin: round; }
  `;
    clone.insertBefore(style, clone.firstChild);

    const blob = new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    await new Promise((res, rej) => {
      img.onload = res;
      img.onerror = rej;
      img.src = url;
    });
    const scale = 2;
    const canvas = document.createElement('canvas');
    canvas.width = window.innerWidth * scale;
    canvas.height = window.innerHeight * scale;
    const ctx = canvas.getContext('2d')!;
    const skyGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    skyGrad.addColorStop(0, '#4aa3ff');
    skyGrad.addColorStop(1, '#8fd1ff');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0);
    URL.revokeObjectURL(url);

    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    const d = new Date(session ? session.start : Date.now());
    a.download = `rabbit-hole-${d.toISOString().slice(0, 10)}.png`;
    a.click();
  });

  // ---------- untangle mode ----------

  const untangleBtn = document.getElementById('untangle') as HTMLButtonElement;

  function applyUntangle(): void {
    if (!session) return;
    const pos = untanglePositions(session);
    for (const sn of sim.nodes) {
      const p = pos[sn.id];
      if (!p) continue;
      // Freeze the tidy layout against the physics.
      sim.place(sn.id, p.x, p.y, { pin: true });
    }
    fitView();
    renderPositions();
  }

  // Pan/zoom so the whole layout is visible (never zooms in past 1:1).
  function fitView(): void {
    const t = fitTransform(sim.nodes, { width: window.innerWidth, height: window.innerHeight, top: 90 /* HUD */ });
    if (!t) return;
    view = t;
    applyView();
  }

  function renderUntangle(): void {
    untangleBtn.textContent = untangled ? '🌀 Physics' : '🧶 Untangle';
    untangleBtn.dataset.tip = untangled
      ? 'Hand the map back to the physics'
      : 'Pull every path into its own lane — no more hairball';
    untangleBtn.classList.toggle('active', untangled);
  }

  untangleBtn.addEventListener('click', () => {
    untangled = !untangled;
    if (untangled) {
      applyUntangle();
    } else {
      for (const sn of sim.nodes) {
        if (userPinned.has(sn.id)) sim.pin(sn.id);
        else sim.release(sn.id);
      }
      settleTicks = 0;
      sim.reheat();
    }
    renderUntangle();
  });

  renderUntangle();

  // ---------- sound toggle ----------

  const muteBtn = document.getElementById('mute') as HTMLButtonElement;

  function renderMute(): void {
    muteBtn.textContent = isMuted() ? '🙉' : '🎵';
    muteBtn.dataset.tip = isMuted() ? 'Un-mute the coin blips' : 'Mute the coin blips';
  }

  muteBtn.addEventListener('click', () => {
    setMuted(!isMuted());
    renderMute();
    if (!isMuted()) playPop(); // instant feedback that sound is back on
  });

  renderMute();

  // ---------- session loading / live updates ----------

  async function loadSessionList(selectId?: string | null): Promise<void> {
    const index = (await store.loadIndex()).sort((a, b) => b.start - a.start);
    sessionSelect.textContent = '';
    for (const m of index) {
      const opt = document.createElement('option');
      opt.value = m.id;
      opt.textContent = fmtSessionLabel(m);
      sessionSelect.appendChild(opt);
    }
    if (selectId && index.some((m) => m.id === selectId)) sessionSelect.value = selectId;
  }

  async function showSession(id: string | null): Promise<void> {
    stopReplayTimer();
    replayCutoff = null;
    session = id ? await store.loadSession(id) : null;
    sim = new ForceSim(window.innerWidth, window.innerHeight);
    seenNodeIds = new Set();
    userPinned.clear();
    untangled = false;
    renderUntangle();
    view = { x: 0, y: 0, k: 1 };
    applyView();
    computeTimeline();
    setReplay(null);
  }

  sessionSelect.addEventListener('change', () => showSession(sessionSelect.value));

  store.onSessionsChanged({
    // The map was opened on the empty state and a session just started —
    // switch to it live instead of sitting on "PRESS START" forever. The
    // store has already waited out the current-before-data write order.
    onCurrentSession: (s) => {
      if (session) return;
      void loadSessionList(s.id).then(() => showSession(s.id));
    },
    onSession: (s, liveNodeIds) => {
      if (!session || s.id !== session.id) return;
      session = s;
      computeTimeline();
      if (replayCutoff == null) rebuild(); // don't yank the user out of a replay
      if (liveNodeIds.length) celebrateLiveArrivals(liveNodeIds);
    },
    onIndex: () => {
      if (session) void loadSessionList(session.id);
    },
  });

  async function init(): Promise<void> {
    const cur = await store.currentSessionId();
    await loadSessionList(cur);
    const pick = sessionSelect.value || cur;
    await showSession(pick || null);
    requestAnimationFrame(frame);
  }

  window.addEventListener('resize', () => {
    sim.resize(window.innerWidth, window.innerHeight);
    settleTicks = 0;
    rabbit.resize();
  });

  void init();
}
