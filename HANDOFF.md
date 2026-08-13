# HANDOFF — Rabbit Hole Map

State of the project as of 2026-08-13, for whoever picks it up next
(human or agent). Current version: see `package.json` (never hardcode it
here — it goes stale).

## Status

**Store-ready.** All tests green: 56 unit tests (`npm test`) and 24
Playwright e2e tests (`npm run e2e`), plus `npm run lint`
(eslint + prettier), all enforced by GitHub Actions CI on every push. The
complete Web Store submission package exists: the latest
`release/rabbit-hole-map-<version>.zip`, listing copy in
`docs/STORE_LISTING.md`, assets in `marketing/store/` (screenshots, tiles,
promo video), privacy docs in place. Not yet uploaded to the store.

### Versions: live / queued / skipped

| Version | Tag        | Zip | Store status                                    |
| ------- | ---------- | --- | ----------------------------------------------- |
| 1.2.2   | — (no tag) | ✓   | skipped (predates rabbit mascot)                |
| 1.2.3   | v1.2.3     | ✓   | skipped                                         |
| 1.2.4   | v1.2.4     | ✓   | skipped                                         |
| 1.2.5   | v1.2.5     | ✓   | skipped (superseded before upload)              |
| 1.2.6   | v1.2.6     | ✓   | skipped (superseded by the SEO-title release)   |
| 1.2.7   | v1.2.7     | ✓   | skipped (superseded before upload)              |
| 1.2.8   | v1.2.8     | ✓   | **queued — upload this one** (nothing live yet) |

Keep this table current: versions superseded before reaching the store get
tags but no store upload. Record the submission date + review outcome here
once uploaded.

## How it works, in one paragraph

The MV3 service worker (`src/background.ts`) listens to
`webNavigation.onCommitted` / `onHistoryStateUpdated` and turns navigations
into a graph persisted through the Session Store (`src/storage.ts`, the one
module that talks to `chrome.storage`; key names live in `src/schema.ts`).
Cross-tab attribution works by remembering each tab's last URL in tab state
and, when a tab is created with an `openerTabId`, crediting the opener's URL
as the edge source. The map page (`src/map/`) renders the session as SVG
with a hand-rolled O(n²) force simulation and live-updates via the store's
typed change stream. The domain vocabulary is in `CONTEXT.md`; pure logic
(model / gameplay / schema / storage / force / view) is emitted as
`dist/*.mjs` for `node --test`.

## Design decisions worth knowing

The load-bearing decisions are ADRs in `docs/adr/` — architecture reviews
should read those before proposing changes:

- ADR-0001 pure logic lives in chrome-free modules
- ADR-0002 service-worker handlers funnel through a promise queue
- ADR-0003 no runtime dependencies
- ADR-0004 sessions split on a 30-minute gap
- ADR-0005 edges only for link/form_submit/client_redirect
- ADR-0006 the unit-test seam is the esbuild ESM emit
- ADR-0007 live arrival is signalled by the store, never inferred

Codebase notes that aren't ADRs:

- **Pinning**: dragged nodes get pinned permanently (gold ring, ⌥-click to
  release; the sim's `place`/`pin`/`release` are the only ways to move a
  node). Pinned nodes shed velocity in `force.ts#tick` so the sim still
  settles. Pin state lives only in the in-page sim — it does not survive a
  page reload. That's a known acceptable gap.
- **Sound** (`src/map/audio.ts`): Web Audio square-wave "coin" blips climbing
  a pentatonic scale; combo resets after 2s of quiet. Blips and carrots play
  only for live arrivals (ADR-0007). Mute persists in the map page's
  `localStorage` (`rhm-muted`).
- **Untangle mode** (`view.ts#tidyLayout` + `untanglePositions`): parent =
  source of each node's earliest incoming edge (cycle-guarded), depth →
  column, leaves get distinct rows, parents center over children; the map
  freezes all sim nodes onto that grid and zoom-fits. `userPinned` (gold
  rings) is tracked separately from sim-level pinning precisely because
  untangle pins everything — don't collapse the two.
- **Icon**: a white rabbit peeking from its hole. Source of truth is
  `icons/icon.svg`; `npm run icons` rasterizes 16/32/48/128 PNGs via resvg
  (`gen-icons.mjs` — it replaced a hand-rolled analytic PNG encoder with
  identical geometry). The store icon and promo tiles derive from it —
  regenerate assets after icon changes.
- **The rabbit**: behaviour is the pure Gameplay Step
  (`src/map/gameplay.ts`, `stepRabbit(state, input) → {state, events}` with
  clock/rng/viewport injected); `src/map/rabbit.ts` is the paint adapter
  that ticks it from the map's rAF loop, plays its events, and draws the
  SVG. Live-arrived sites drop carrots. Growth: +25% per milestone
  (5/10/20/40/60 eaten), compounding on the rabbit's _current_ size —
  hunger shrink (-10% per 30s unfed, floors at 1.0) carries forward, so
  the rule is path-dependent. A milestone triggers a 10s monster frenzy
  (fangs/red eyes/aura, 2x hops and bites, no alert pause). Chase locks
  ONE carrot and arrives by distance tolerance — never a facing-dependent
  point (regression: dithering between close carrots). Progress is
  per-page-load by design.

## Known quirks / bugs already fixed once (don't regress)

- **Hidden-tab rendering**: `requestAnimationFrame` pauses in background
  tabs, so `rebuild()` must call `renderPositions()` synchronously at the
  end — otherwise nodes created while the tab is hidden sit at (0,0) until
  the tab is refocused. This bit us via double-click-opens-active-tab.
- **Branded Chrome ≥ 137 ignores `--load-extension`** — the e2e must use
  Chrome for Testing (`CHROME_PATH` env var).
- **@puppeteer/browsers' unzip corrupts the CfT app bundle on macOS**
  (drops framework symlinks → dlopen failure). Fix: download the zip
  yourself and extract with `ditto -xk`. The working binary lives in
  `.cache/cft/` locally (gitignored).
- **`<select>` and `<input type=range>` can't carry CSS pseudo-element
  tooltips** — they're wrapped in `.tipwrap` spans that hold the bubble.
- **Node test runner**: `node --test tests/` fails on this setup; pass the
  file explicitly (`node --test tests/model.test.mjs`).

## Versioning

Odometer-style, per the user's spec: each of minor/patch is a single digit
0-9 and carries over — 1.1.9 → 1.2.0, 1.9.9 → 2.0.0 (major may grow past 9).
Never hand-edit versions: run `npm run bump` (`scripts/bump.mjs`), which
validates the scheme and keeps `package.json` and `manifest.json` in sync.
`npm run bump -- --dry` previews. Logic is unit-tested in
`tests/version.test.mjs`.

## Release & marketing flow

Two-phase, scripted (`scripts/release.mjs`, modeled on 10block's flow):

1. Write the `## [X.Y.Z]` CHANGELOG section for the next version
   (`npm run bump -- --dry` previews the number). The release refuses to
   run without it; it becomes the GitHub release notes verbatim.
2. `npm run release` — preflights (on main, tag/zip don't exist yet,
   changelog section present), gates (`tsc --noEmit`, `npm run lint`,
   `npm test`), odometer bump (package.json + manifest.json in lockstep),
   build, zip runtime files only, `Release vX.Y.Z` commit by explicit
   pathspec, **annotated** tag (lightweight tags silently don't push with
   `--follow-tags`).
3. Review the release commit, then `npm run release:publish` — push main +
   tag, `gh release create --verify-tag` with the zip and changelog notes.
4. `npm run assets` regenerates `marketing/store/` from the real extension
   in Chrome for Testing (seeded carbonara→trebuchet session; shared with
   the video via `marketing/session.mjs`). Screenshot pitch: constellation
   → untangle → replay → pin → scoreboard. `npm run assets:video` re-records
   the ~40s promo video in Playwright Chromium.
5. Escape hatches: `--dry-run` (gates only), `--zip-only`, `--no-bump`.

Never upload a zip whose version the store has already seen; bump first
(the script guarantees this — never hand-zip).

## Testing philosophy

Every user-facing behavior gets an e2e test. The suite is `@playwright/test`
(10block's pattern): `e2e/fixtures.mjs` provides a persistent context with
the extension loaded, the extension id, and a local test site; specs are
split by area (tracking / map / untangle / rabbit / session / popup — 17
tests, ~40s plus a 3-minute hunger-decay soak; the rabbit's gameplay also
has fast unit coverage via `dist/gameplay.mjs`). Two more tiers ride the same
fixtures: `e2e/a11y.spec.mjs` (axe scans of all three pages; per-element,
dated exceptions only — currently just the wordmark contrast) and
`e2e/visual.spec.mjs` (4 screenshot assertions on deterministic surfaces —
fixed-timestamp session from `e2e/visual-session.mjs`, pinned locale/TZ in
the fixture context, `#burrow-layer` hidden because a mask would follow the
roaming rabbit's bounding box and flake; `maxDiffPixels: 150`, verified to
pass 3× stable and fail on a 3px layout shift). Visual baselines are
darwin-only → the tier skips on CI; run it locally before a release.
Manual pre-submit QA: `docs/manual-checklist.md`. Playwright's own Chromium still supports `--load-extension`,
so no Chrome for Testing is needed for tests (only `npm run assets` still
uses CfT + puppeteer for marketing captures). CI runs unit + e2e on every
push (`.github/workflows/ci.yml`) and uploads traces on failure. The e2e
harness has caught five real bugs so far — extend it with every feature.

## Ideas discussed but not built

- Upload the latest release to the Web Store (package is ready; still needs
  a developer account). The privacy policy URL is this repo's own copy —
  the repo is public as of 2026-08-09:
  https://github.com/billye2/rabbit-hole-map/blob/main/rabbit-hole-map-PRIVACY.md
  (it briefly lived in the pdfxtn sibling while this repo was private; that
  copy is gone, there is nothing to keep in sync.)
- Upload the promo video to YouTube and paste the URL into
  `docs/STORE_LISTING.md` (the video itself exists:
  `marketing/store/promo-video.webm`, regenerated via `npm run assets:video`).
- Persist pinned positions and untangle state per session (both currently
  reset on page reload / session switch).
- Parked refactors from the 2026-08-13 architecture review: keyed DOM
  reconcile in `rebuild()` (stop the full teardown per live update) and
  splitting `audio.ts` into a pure combo ladder + speaker adapter (fold in
  whenever audio next changes).
- Achievements ("visited 50 pages after midnight"), 1-UP jingle at depth
  milestones.
- Share/export replay as animated GIF.

## Process note

The user directs this project in a manager/approval style: pitch options
first, build only what's approved. Aesthetic bar: playful, Nintendo-like,
bright candy colors — when in doubt, more fun, not less.
