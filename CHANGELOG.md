# Changelog

Versioning is odometer-style: minor/patch are single digits that carry over
(1.1.9 → 1.2.0). Bump with `npm run bump`.

## [Unreleased]

- **Roaming rabbit + carrot drops** — a code-drawn rabbit hops along a grass
  band at the bottom of the map (screen-space layer, unaffected by pan/zoom).
  Each live-added site drops a carrot from its node; the rabbit alerts (!),
  chases the nearest landed carrot, and eats it in three nibbles (soft
  triangle-blip sound, respects mute). Same `soundArmed` guard as the coin
  blips, so opening an old session doesn't rain carrots — but replay does.

## [1.2.4] — 2026-08-08

- New icon: a white rabbit peeking out of its hole (replaces the spiral),
  across toolbar, store icon, and promo tiles.
- Store screenshots updated: Untangle is now shot 2 of the pitch; the empty
  state shot was retired.

## [1.2.3] — 2026-08-08

- **Untangle mode** — toggle button that lays the graph out as a tidy
  left-to-right tree (each trail in its own lane, parents centered over
  branches, auto zoom-to-fit) instead of the force-directed tangle. Layout
  logic lives in `model.ts#tidyLayout`, unit-tested; toggling back re-warms
  the physics. User-pinned nodes keep their gold rings in both modes.

## [1.2.2] — 2026-08-08

First store-ready release.

- Live force-directed constellation of the current browsing session: candy
  nodes sized by visits and colored by domain, arrows for link hops, cross-tab
  trails connected via tab openers, favicons, drifting-cloud sky.
- Sessions split after 30 minutes of quiet.
- Replay with timeline scrubber; nodes re-bounce in with rising coin blips.
- Web Audio coin-blip sound effects with pentatonic combo ladder; 🎵/🙉 mute.
- Drag-to-pin layout (gold ring, ⌥-click to release), double-click a node to
  reopen its page, speech-bubble tooltips on every control.
- PNG export of the constellation.
- Popup scoreboard: pages, hops, deepest burrow, top haunt, time wasted.
- Privacy: local-only storage, incognito never recorded, domain blocklist,
  clear-all-data. No network requests of any kind.

## [0.1.x] — 2026-08-08 (internal)

- 0.1.1 — odometer version bump tooling.
- 0.1.0 — initial build: tracking service worker, map page, popup, options,
  unit tests, puppeteer e2e harness.
