# HANDOFF — Rabbit Hole Map

State of the project as of 2026-08-08, for whoever picks it up next
(human or agent).

## Status

Feature-complete v0.1.0. All tests green: 7 unit tests (`npm test`) and an
11-assertion puppeteer e2e (`npm run e2e`). Not yet published to the Chrome
Web Store; installed via Load Unpacked.

## How it works, in one paragraph

The MV3 service worker (`src/background.ts`) listens to
`webNavigation.onCommitted` / `onHistoryStateUpdated` and turns navigations
into a graph stored in `chrome.storage.local` (one `session:<id>` key per
session, plus a `sessionIndex`). Cross-tab attribution works by remembering
each tab's last URL in `chrome.storage.session` and, when a tab is created
with an `openerTabId`, crediting the opener's URL as the edge source. The map
page (`src/map/`) renders the session as SVG with a hand-rolled O(n²) force
simulation and live-updates via `chrome.storage.onChanged`.

## Design decisions worth knowing

- **`src/model.ts` is deliberately pure** (no `chrome.*`) so the graph logic
  is unit-testable in plain Node. esbuild emits it separately as
  `dist/model.mjs` for the tests. Keep it that way.
- **All service-worker event handlers funnel through a promise queue**
  (`enqueue` in background.ts) because each does read-modify-write on shared
  storage keys and MV3 handlers interleave.
- **No runtime dependencies at all.** Force layout, PNG icon encoder, and
  sound effects are all hand-rolled. MV3 CSP forbids remote code anyway.
- **Sessions split on a 30-minute gap** (`SESSION_GAP_MS` in model.ts).
- **Edges are only created for `link`/`form_submit`/`client_redirect`
  transitions** (plus opener attribution); typed URLs and omnibox searches
  start new roots on purpose.
- **Pinning**: dragged nodes get `pinned = true` permanently (gold ring,
  ⌥-click to release). Pinned nodes shed velocity in `force.ts#tick` so the
  sim still settles. Pin state lives only in the in-page sim — it does not
  survive a page reload. That's a known acceptable gap.
- **Sound** (`src/map/audio.ts`): Web Audio square-wave "coin" blips climbing
  a pentatonic scale; combo resets after 2s of quiet. `soundArmed` guards
  against a blip barrage when a session first renders. Mute persists in the
  map page's `localStorage` (`rhm-muted`).

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

## Testing philosophy

Every user-facing behavior added so far got an e2e assertion in
`e2e/test-e2e.mjs` (rendered graph, cross-tab edge, titles, double-click
reopen, drag-pin drift < 10px, tooltip visibility). If you add a feature,
extend that file — it's cheap and it has caught two real bugs already.

## Ideas discussed but not built

- Persist pinned positions per session (store x/y in the session object).
- Achievements ("visited 50 pages after midnight"), 1-UP jingle at depth
  milestones.
- Share/export replay as animated GIF.
- Publish to Chrome Web Store (needs icons review, store listing, privacy
  policy page — the privacy story is easy: everything is local).

## Process note

The user directs this project in a manager/approval style: pitch options
first, build only what's approved. Aesthetic bar: playful, Nintendo-like,
bright candy colors — when in doubt, more fun, not less.
