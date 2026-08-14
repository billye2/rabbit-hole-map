# CONTEXT — the domain language of Rabbit Hole Map

The words this codebase uses, so code, tests, and docs all mean the same
thing by them. Architectural decisions behind these terms live in
`docs/adr/`.

## Tracking

- **Session** — one continuous stretch of browsing, split when 30 minutes
  pass without a navigation (ADR-0004). Stored as one record with **nodes**
  (pages, keyed by normalized URL) and **edges** (hops between them).
- **Hop / Edge** — a navigation credited from one page to another. Only
  `link` / `form_submit` / `client_redirect` transitions (plus opener
  attribution for new tabs) create edges; typed URLs start new roots
  (ADR-0005).
- **Session Store** (`src/storage.ts`) — the one module that talks to
  `chrome.storage`. Owns the key **schema** (`src/schema.ts`), the session
  index, tab state, the write sequence (**drain signal**), and the typed
  change stream. Everything else — pages, tests, marketing seeders — goes
  through its doors.
- **Live Visit** — the fact that a site was visited _just now_ (a node the
  write added **or re-visited**), named by the Session Store's change
  stream (ADR-0007, widened by ADR-0008). Coin blips and live crate drops
  key off this signal; re-renders can never fabricate it. Replay drops
  crates through its own separate path (see **Replay**).

## Map page

- **View-State** (`src/map/view.ts`) — the pure decisions of the map page:
  the visible slice under a replay cutoff, the replay timeline, the
  Untangle layout, zoom-to-fit, edge-trim geometry. `map.ts` only wires
  these onto SVG, behind an exported `main()` (boot.ts is the only caller).
- **Replay** — scrubbing or playing the session's timeline. Replay renders
  history silently (no coin blips), but it DOES feed the rabbit: every
  node a replay pass reveals drops a crate, and a fresh run drops them all
  again — a deliberate crate faucet (ADR-0008).
- **Untangle** — the tidy per-lane tree layout (vs. the force-directed
  "physics" tangle). Freezes every node onto a grid via sim pinning.
- **Pinning** — two distinct kinds, deliberately not collapsed: **user
  pins** (gold ring, made by dragging, ⌥-click releases) and **sim pins**
  (the force sim's frozen nodes, which Untangle applies to everything).
- **Force sim** (`src/map/force.ts`) — sealed physics: callers describe
  the graph with `setGraph` and move nodes only via `place`/`pin`/`release`.

## The rabbit

- **Gameplay Step** (`src/map/gameplay.ts`) — the rabbit's whole behaviour
  as a pure `stepRabbit(state, input) → {state, events}` with clock, rng,
  and viewport injected. `rabbit.ts` is its **paint adapter**: it feeds
  each animation frame in, plays the step's events, and projects state
  onto SVG.
- **Crate** — dropped from a live-arrived site's node; cranked open in 3
  clanks. Its **Tier** (1–5: Wooden/Iron/Gold/Energy/Plasma) is stamped
  from the phase at drop time — one above the current phase, capped at 5 —
  and never changes afterward.
- **Milestone / Phase** — crate counts (5/10/20/40/60) that grow the
  rabbit +25%, compounding on its _current_ size (hunger shrink carries
  forward — the growth rule is path-dependent). From phase 2 on, each
  phase swaps the rabbit's **Sprite Form**, permanently.
- **Sprite Form** (`rabbit.ts` `FORMS`) — the rabbit's body is a bitmap
  frame (data-URL PNGs sliced from Billy's sprite sheets, inlined by
  esbuild's dataurl loader). The escalation ladder by phase: base gold
  (0–1) → gold + cannon (2) → grey battle armor (3) → jeep (4) → gold
  tank at peak (5). Idle plays the front-facing strip, movement the side
  strip; each form's native facing (`flip`) composes with the dir flip.
  The `armor-N` groups remain as phase markers in the DOM (e2e-pinned)
  but carry no geometry — the form swap IS the milestone visual.
- **Overdrive** — the 10-second surge a milestone triggers: double-speed
  hops and cranks, no startle pause. No overlay visuals (by request — the
  sprites carry the look); the state is exposed as `data-overdrive` on
  the `.rabbit` group, which e2e pins.
- **Hunger** — 30 seconds unfed shrinks the rabbit 10% (`powerdown`),
  never below its original size. A form never reverts: phase derives
  from crates opened, which only grows.

## Test seam

Pure modules (`model`, `gameplay`, `schema`, `storage` + its in-memory
fake, `force`, `view`) are emitted as `dist/*.mjs` by `build.mjs` for
`node --test` (ADR-0006). Everything user-facing also has an e2e test.
