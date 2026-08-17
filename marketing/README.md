# Store assets

Everything the Chrome Web Store listing needs, generated into `store/`.

```sh
npm run assets          # rebuild every asset (needs Chrome for Testing, see below)
```

## What's in `store/`

| File                          | Size     | Where it goes                                 |
| ----------------------------- | -------- | --------------------------------------------- |
| `store-icon-128.png`          | 128×128  | Store listing icon (copy of the shipped icon) |
| `screenshot-1.png` … `-6.png` | 1280×800 | Screenshots — order below                     |
| `promo-tile-440x280.png`      | 440×280  | Small promo tile                              |
| `marquee-1400x560.png`        | 1400×560 | Marquee promo tile                            |

Screenshot order is the pitch:

1. **The constellation** — a full carbonara→trebuchet session, live.
2. **Untangle** — the same session one click later: every path in its own
   lane, auto-zoomed to fit.
3. **Replay** — mid-descent, scrubber at ~55%.
4. **Arrange & pin** — two gold-pinned nodes plus a tooltip bubble.
5. **The scoreboard** — popup with pages/hops/deepest burrow/time wasted.
6. **The growth ladder** — a designed slide: the five sprite forms with
   milestone pills ("Browse websites. Watch your rabbit GROW."). Note the
   Web Store caps a listing at 5 screenshots — pick 5 of the 6 at upload.

## How it's built

`capture.mjs` loads the **real built extension** into Chrome for Testing,
seeds a hand-written but realistic session (13 pages, google → serious eats →
wikipedia spiral → trebuchet memes), and screenshots the actual live pages —
map, popup, empty state. Nothing is mocked, so assets can't drift from the
shipped UI. Stills render at 2× and are downscaled with `sips` for crisp text.

The promo tiles and the growth slide come from `stage/promo.html`
(`?variant=tile|marquee|growth`) — the
sky, wordmark, shipped icon, and a hand-drawn constellation SVG in the same
palette. The growth slide's base-form sprite is `stage/front-face.png` —
`stage/gen-front-face.mjs` paints cannon-style eyes on the faceless
`front-0.png` frame (marketing-only; gameplay sprites untouched). The store
icon is a straight copy of `icons/icon128.png`.

Chrome for Testing is required because branded Chrome ≥ 137 removed
`--load-extension`. Default path: `.cache/cft/...` (see HANDOFF.md); override
with `CHROME_PATH`.

The promo video (`store/promo-video.webm`, ~40s, 1280×800 VP8) is recorded by
`video.mjs` (`npm run assets:video`) — a single-take Playwright recording of
the real extension with an injected cursor and caption pills, no
post-production: hero constellation → real ▶ Replay run → untangle → drag to
gold pins → rabbit title card. It uses Playwright's bundled Chromium (not
CfT) and the same seeded session as the screenshots (`session.mjs`, shared).
The store wants a YouTube URL: upload the webm and paste the link in
`docs/STORE_LISTING.md`.
