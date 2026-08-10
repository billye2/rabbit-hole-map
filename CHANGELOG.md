# Changelog

Versioning is odometer-style: minor/patch are single digits that carry over
(1.1.9 → 1.2.0). Bump with `npm run bump`.

Before cutting a release, write the `## [X.Y.Z] — YYYY-MM-DD` section for the
_next_ version first (preview the number with `npm run bump -- --dry`).
`npm run release` refuses to run without it, and that section becomes the
GitHub release notes verbatim via `npm run release:publish`.

## [1.2.6] — 2026-08-09

- Accessibility: pages declare their language, the popup has a title, page
  content sits in proper landmarks, and the replay scrubber + session picker
  now carry accessible names for screen readers. Backed by a new axe-core
  e2e tier (documented per-element exceptions only).
- The popup's "🗺️ Open the map" button no longer shows a hover tooltip —
  the label already says what it does.
- Icon: added the 32px size (toolbar + extensions page); the icon is now
  generated from a single SVG source (`icons/icon.svg`, resvg) with
  pixel-identical art.
- Store readiness: ~40s promo video recorded from the real extension
  (`npm run assets:video`), privacy policy hosted at this now-public repo's
  own URL, paste-ready listing docs refreshed.
- Process: two-phase gated release (`npm run release` / `release:publish`),
  eslint + prettier with a CI lint step, visual-regression screenshot tier,
  manual pre-submit QA checklist, `/ship` skill.

## [1.2.5] — 2026-08-09

- **Monster feeding frenzy** — hitting a growth milestone transforms the
  rabbit for 10 seconds: glowing red eyes, fangs, a pulsing dark aura, and
  a synth roar. In monster mode it skips the startled pause, hops at double
  speed, and bites twice as fast until the ground is cleared, then reverts
  to its cute (bigger) form.
- Fix: drifting clouds no longer flash/reset at the end of each 80s
  animation cycle — layers now tile at exactly 100vw and drift by whole
  tile multiples, so the loop's last frame is identical to its first.
- **Hunger decay** — 30 seconds without a carrot shrinks the rabbit 10%,
  looping down until it returns to (never below) its original size. Eating
  resets the clock; the eating-speed achievement is kept.

- **Roaming rabbit + carrot drops** — a code-drawn rabbit hops along a grass
  band at the bottom of the map (screen-space layer, unaffected by pan/zoom).
  Each live-added site drops a carrot from its node; the rabbit alerts (!),
  chases the nearest landed carrot, and eats it in three nibbles (soft
  triangle-blip sound, respects mute). Same `soundArmed` guard as the coin
  blips, so opening an old session doesn't rain carrots — but replay does.
- **Rabbit growth** — +25% size (compounding, with a level-up pulse and coin
  chime) at 5/10/20/40/60 carrots eaten; eating speed rises 1.5× at the
  first milestone. Progression math in `model.ts#rabbitGrowth`, unit-tested.
- Fix: chasing no longer dithers between closely-spaced carrots (the rabbit
  locks one target and arrival uses a distance tolerance, not a
  facing-dependent point).
- Fix: a map opened on the empty state now picks up a brand-new session
  live (the background writes `currentSessionId` before the session data;
  the map now re-checks on any session key change).
- Testing: e2e migrated from a monolithic puppeteer script to
  `@playwright/test` (10block's fixture pattern) — 15 isolated tests
  including new adversarial coverage: fragment normalization, reload
  behavior, blocklist via the real Options UI, clear-all-data dialogs,
  alt-click unpin, popup scoreboard accuracy, and the rabbit growth
  milestone. GitHub Actions CI now runs unit + e2e on every push.
- Fix: pin gold ring no longer targets a detached element if a live update
  rebuilds the DOM mid-drag.

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
