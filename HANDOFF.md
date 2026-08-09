# HANDOFF — Rabbit Hole Map

State of the project as of 2026-08-08, for whoever picks it up next
(human or agent).

## Status

**v1.2.4, store-ready.** All tests green: 14 unit tests (`npm test`) and a
12-assertion puppeteer e2e (`npm run e2e`). The complete Web Store submission
package exists: `release/rabbit-hole-map-1.2.4.zip` (upload this one; older
zips carry the old spiral icon / lack Untangle), listing copy in
`docs/STORE_LISTING.md`, assets in `marketing/store/`, privacy docs in place.
Not yet uploaded to the store. Git tags `v1.2.3`, `v1.2.4` mark releases.

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
- **Untangle mode** (`model.ts#tidyLayout` + map.ts): parent = source of each
  node's earliest incoming edge (cycle-guarded), depth → column, leaves get
  distinct rows, parents center over children; the map freezes all sim nodes
  onto that grid and zoom-fits. `userPinned` (gold rings) is tracked
  separately from sim-level `pinned` precisely because untangle pins
  everything — don't collapse the two.
- **Icon**: a code-drawn white rabbit peeking from its hole
  (`gen-icons.mjs`, hand-rolled PNG encoder, no image deps). The store icon
  and promo tiles derive from it — regenerate assets after icon changes.

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

1. `npm run bump` (or `npm run bump -- X.Y.Z`) — odometer versioning, keeps
   package.json and manifest.json in sync.
2. Move the CHANGELOG entry under the new version.
3. `npm test` then `npm run release` → `release/rabbit-hole-map-<v>.zip`
   (runtime files only, manifest at zip root).
4. `npm run assets` regenerates `marketing/store/` from the real extension
   in Chrome for Testing (seeded carbonara→trebuchet session). Screenshot
   pitch: constellation → untangle → replay → pin → scoreboard.
5. Commit, `git tag v<version>`, `git push --follow-tags`.

Never upload a zip whose version the store has already seen; bump first.

## Testing philosophy

Every user-facing behavior gets an e2e test. The suite is `@playwright/test`
(10block's pattern): `e2e/fixtures.mjs` provides a persistent context with
the extension loaded, the extension id, and a local test site; specs are
split by area (tracking / map / untangle / rabbit / session / popup — 15
tests, ~40s). Playwright's own Chromium still supports `--load-extension`,
so no Chrome for Testing is needed for tests (only `npm run assets` still
uses CfT + puppeteer for marketing captures). CI runs unit + e2e on every
push (`.github/workflows/ci.yml`) and uploads traces on failure. The e2e
harness has caught five real bugs so far — extend it with every feature.

## Ideas discussed but not built

- Upload v1.2.4 to the Web Store (package is ready; needs a hosted URL for
  the privacy policy and a developer account).
- Promo video (31s screen recording of a replay run → YouTube → listing).
- Persist pinned positions and untangle state per session (both currently
  reset on page reload / session switch).
- Achievements ("visited 50 pages after midnight"), 1-UP jingle at depth
  milestones.
- Share/export replay as animated GIF.

## Process note

The user directs this project in a manager/approval style: pitch options
first, build only what's approved. Aesthetic bar: playful, Nintendo-like,
bright candy colors — when in doubt, more fun, not less.
