# 🕳️ Rabbit Hole Map

A Chrome extension that draws your browsing trail as a live constellation.
Watch tonight's Wikipedia spiral bloom into a node graph, replay how you got
from "pasta recipe" to "Byzantine siege engines", and export the map as a PNG.

Everything stays on your machine. Nothing is ever sent anywhere.

## Features

- **Live trail map** — pages become nodes (sized by visits, colored by domain,
  with favicons), link clicks become arrows. Cross-tab hops (`target=_blank`,
  middle-click) are connected back to the page that spawned them.
- **Sessions** — a 30-minute pause starts a fresh map, so "tonight's rabbit
  hole" doesn't blur into "this morning's".
- **Replay** — scrub or play the trail back in chronological order.
- **Export PNG** — share the constellation.
- **Popup stats** — pages visited, hops, deepest chain, top domain.
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

## Test

```sh
npm test          # unit tests for the pure graph model (node --test)
npm run e2e       # launches Chrome for Testing with the extension loaded,
                  # clicks through a local site, asserts the rendered graph
```

The e2e run needs a Chromium that still supports `--load-extension`
(branded Chrome ≥ 137 does not). Point `CHROME_PATH` at a
[Chrome for Testing](https://googlechromelabs.github.io/chrome-for-testing/)
binary.

## Architecture

```
src/background.ts   MV3 service worker: webNavigation + tabs events -> graph
src/model.ts        pure graph model (nodes/edges/sessions) — unit tested
src/storage.ts      chrome.storage.local persistence
src/map/            full-tab map page: SVG render, force layout, replay, export
src/popup/          toolbar popup with session stats
src/options/        blocklist + clear-data
```
