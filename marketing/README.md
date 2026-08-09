# Store assets

Everything the Chrome Web Store listing needs, generated into `store/`.

```sh
npm run assets          # rebuild every asset (needs Chrome for Testing, see below)
```

## What's in `store/`

| File | Size | Where it goes |
| --- | --- | --- |
| `store-icon-128.png` | 128×128 | Store listing icon (copy of the shipped icon) |
| `screenshot-1.png` … `-5.png` | 1280×800 | Screenshots — order below |
| `promo-tile-440x280.png` | 440×280 | Small promo tile |
| `marquee-1400x560.png` | 1400×560 | Marquee promo tile |

Screenshot order is the pitch:

1. **The constellation** — a full carbonara→trebuchet session, live.
2. **Untangle** — the same session one click later: every path in its own
   lane, auto-zoomed to fit.
3. **Replay** — mid-descent, scrubber at ~55%.
4. **Arrange & pin** — two gold-pinned nodes plus a tooltip bubble.
5. **The scoreboard** — popup with pages/hops/deepest burrow/time wasted.

## How it's built

`capture.mjs` loads the **real built extension** into Chrome for Testing,
seeds a hand-written but realistic session (13 pages, google → serious eats →
wikipedia spiral → trebuchet memes), and screenshots the actual live pages —
map, popup, empty state. Nothing is mocked, so assets can't drift from the
shipped UI. Stills render at 2× and are downscaled with `sips` for crisp text.

The promo tiles come from `stage/promo.html` (`?variant=tile|marquee`) — the
sky, wordmark, shipped icon, and a hand-drawn constellation SVG in the same
palette. The store icon is a straight copy of `icons/icon128.png`.

Chrome for Testing is required because branded Chrome ≥ 137 removed
`--load-extension`. Default path: `.cache/cft/...` (see HANDOFF.md); override
with `CHROME_PATH`.

No promo video yet. If one gets made: 1280×800 screen recording of a replay
run, upload to YouTube, paste the URL in the store listing.
