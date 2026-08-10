# 🐰 Rabbit Hole Map

A Chrome extension that draws your browsing trail as a playful, Nintendo-styled
constellation. Watch tonight's Wikipedia spiral bloom into a candy-colored node
graph, replay how you got from "pasta recipe" to "Byzantine siege engines",
and export the map as a PNG.

Everything stays on your machine. Nothing is ever sent anywhere.

## Scope

Permanent non-goals — these are core to what the product is, don't re-propose
them:

- **No data ever leaves the machine.** No telemetry, no sync, no accounts, no
  cloud anything. Local-only storage is the product's whole privacy story
  (and what the store listing promises).
- **No runtime dependencies.** The force layout and sound are hand-rolled on
  purpose; MV3 CSP forbids remote code anyway. (Dev-time tooling like esbuild
  and resvg is fine — nothing ships in the extension.)
- **Incognito is never recorded.**

## Features

- **Live trail map** — pages become nodes (sized by visits, candy-colored by
  domain, with favicons), link clicks become arrows. Cross-tab hops
  (`target=_blank`, middle-click) are connected back to the page that spawned
  them. New nodes bounce in with a squash-and-stretch pop.
- **Coin-blip sound effects** — synthesized with the Web Audio API (no audio
  files). Consecutive pops climb a pentatonic scale like a combo counter.
  Mute toggle (🎵/🙉) in the HUD, persisted.
- **Sessions** — a 30-minute pause starts a fresh map, so "tonight's rabbit
  hole" doesn't blur into "this morning's".
- **Replay** — scrub or play the trail back in chronological order; a full
  replay re-bounces every node with its own ascending blip.
- **Drag to pin** — drag a node and it stays exactly where you dropped it
  (gold ring); the physics settles around your arrangement. ⌥-click releases
  a pinned node back to the simulation.
- **Untangle** — one click swaps the force layout for a tidy left-to-right
  tree: every trail gets its own lane, branches get their own rows, and the
  view auto-zooms to fit. No more hairball on 50-page nights. Click again
  to hand the map back to the physics.
- **Double-click a node** to reopen that page in a new tab.
- **A resident rabbit** roams the grass at the bottom of the map. Every site
  you visit live drops a carrot from its node; the rabbit startles (❗),
  chases it down, and nibbles it gone. It **grows +25%** at 5, 10, 20, 40,
  and 60 carrots eaten, and eats 1.5× faster from the first milestone on.
  Hitting a milestone unleashes a **10-second monster feeding frenzy** —
  red eyes, fangs, dark aura, a roar — as it rampages at double speed until
  every carrot on the ground is gone, then reverts to its cute (bigger)
  self. Go 30 seconds without feeding it and hunger shrinks it 10% at a
  time, back down to — but never below — its original size.
- **Speech-bubble tooltips** on every map control, with state-aware text
  (the popup keeps its single button self-explanatory, no bubble).
- **Export PNG** — share the constellation (pinned rings and all).
- **Popup scoreboard** — pages visited, hops, deepest burrow, top haunt, and
  time gloriously wasted.
- **Privacy** — local-only storage, incognito is never recorded, domain
  blocklist in Options, one-click "clear all data".

## Build

```sh
npm install
npm run build     # bundles src/ -> dist/ with esbuild
npm run icons     # rasterizes icons/icon.svg -> 16/32/48/128 PNGs (resvg)
```

## Install (unpacked)

1. Open `chrome://extensions`
2. Toggle **Developer mode** (top right)
3. **Load unpacked** → select this project folder
4. Browse a few links, then click the toolbar icon → **Open the map**

## Release

```sh
# 1. write the CHANGELOG section for the next version (npm run bump -- --dry previews it)
npm run release          # gates (tsc/lint/tests) → bump → zip → Release commit → tag
npm run release:publish  # push main + tag → GitHub release with the zip attached
npm run assets           # regenerate marketing/store/ screenshots + tiles
npm run assets:video     # re-record marketing/store/promo-video.webm
```

Escape hatches: `--dry-run` (gates only), `--zip-only`, `--no-bump`.

Store listing copy lives in `docs/STORE_LISTING.md`; privacy docs in
`rabbit-hole-map-PRIVACY.md` and `docs/privacy-practices-copy.md`.

## Test

```sh
npm test          # unit tests for the pure graph model (node --test)
npm run e2e       # Playwright: 16 behavior + 3 axe a11y + 4 visual-regression
npm run lint      # eslint + prettier --check (lint:fix to auto-fix)
```

The visual tier's baselines are darwin-only, so it skips on CI — run it
locally before a release (`npx playwright test visual`). Manual pre-submit
QA lives in `docs/manual-checklist.md`.

The e2e suite (`e2e/*.spec.mjs`, `@playwright/test`) loads the unpacked
extension into Playwright's own Chromium — no manual browser wrangling —
and covers tracking (click chains, cross-tab hops, fragment normalization,
reload behavior), the map (render, double-click reopen, drag-to-pin,
alt-click release, tooltips), untangle, the rabbit (roam, carrot drop, eat,
growth milestone), sessions (live pickup from the empty state, blocklist via
the real Options UI, clear-all-data), and popup scoreboard accuracy. Both
suites run in CI on every push (`.github/workflows/ci.yml`), with Playwright
traces uploaded on failure.

Note: `npm run assets` (marketing captures) still uses puppeteer-core with a
Chrome for Testing binary — see HANDOFF.md.

## Architecture

```
src/background.ts   MV3 service worker: webNavigation + tabs events -> graph
src/model.ts        pure graph model (nodes/edges/sessions) — unit tested
src/storage.ts      chrome.storage.local persistence
src/map/            full-tab map page: SVG render, force layout, replay,
                    sound (audio.ts), pinning, export
src/popup/          toolbar popup with session scoreboard
src/options/        blocklist + clear-data
```

See [HANDOFF.md](HANDOFF.md) for design decisions, known quirks, and ideas.
