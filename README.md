# 🐰 Rabbit Hole Map

A Chrome extension that draws your browsing trail as a playful, Nintendo-styled
constellation. Watch tonight's Wikipedia spiral bloom into a candy-colored node
graph, replay how you got from "pasta recipe" to "Byzantine siege engines",
and export the map as a PNG.

Everything stays on your machine. Nothing is ever sent anywhere.

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
  and 60 carrots eaten (with a level-up pulse), and eats 1.5× faster once
  it hits the first milestone. Keep browsing and watch it thrive.
- **Speech-bubble tooltips** on every control, with state-aware text.
- **Export PNG** — share the constellation (pinned rings and all).
- **Popup scoreboard** — pages visited, hops, deepest burrow, top haunt, and
  time gloriously wasted.
- **Privacy** — local-only storage, incognito is never recorded, domain
  blocklist in Options, one-click "clear all data".

## Build

```sh
npm install
npm run build     # bundles src/ -> dist/ with esbuild
npm run icons     # regenerates icons/ (no image deps — hand-rolled PNG encoder)
```

## Install (unpacked)

1. Open `chrome://extensions`
2. Toggle **Developer mode** (top right)
3. **Load unpacked** → select this project folder
4. Browse a few links, then click the toolbar icon → **Open the map**

## Release

```sh
npm run bump      # odometer version bump (1.1.9 -> 1.2.0); add X.Y.Z to jump
npm run release   # build + zip runtime files -> release/rabbit-hole-map-<v>.zip
npm run assets    # regenerate marketing/store/ from the live extension
```

Store listing copy lives in `docs/STORE_LISTING.md`; privacy docs in
`rabbit-hole-map-PRIVACY.md` and `docs/privacy-practices-copy.md`.

## Test

```sh
npm test          # unit tests for the pure graph model (node --test)
npm run e2e       # full browser test — see CHROME_PATH note below
```

The e2e launches a real Chrome with the extension loaded, clicks through a
local test site (same-tab links plus a `target=_blank` hop), then opens the
map and asserts the stored graph, rendered SVG, double-click reopen,
drag-to-pin behavior, and tooltip visibility.

**CHROME_PATH note:** branded Chrome ≥ 137 removed `--load-extension`, so the
e2e needs a [Chrome for Testing](https://googlechromelabs.github.io/chrome-for-testing/)
binary:

```sh
npx @puppeteer/browsers install chrome --path "$PWD/.cache/browsers"
CHROME_PATH="<printed path>" npm run e2e
```

If the downloaded app bundle fails to launch with a dlopen error, the JS
unzipper mangled its symlinks — download the zip from the Chrome for Testing
site and extract it with `ditto -xk` instead.

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
