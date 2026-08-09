# Changelog

Versioning is odometer-style: minor/patch are single digits that carry over
(1.1.9 → 1.2.0). Bump with `npm run bump`.

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
