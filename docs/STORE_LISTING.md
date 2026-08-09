# Chrome Web Store — submission package

Everything to paste into the Developer Dashboard for Rabbit Hole Map.

## Upload package

- **File:** `release/rabbit-hole-map-<version>.zip` (`manifest.json` at the zip root).
- (Re)package with **`npm run release`**. The Web Store rejects re-uploads of an
  existing version, so run `npm run bump` first when resubmitting.

## Listing fields

**Name:** Rabbit Hole Map
_(comes from the manifest `name`. If we want a keyword-rich store title later —
e.g. "Rabbit Hole Map: See Where the Time Went", 41/45 chars — change the
manifest name and ship a new zip; the listing follows the manifest.)_

**Summary (short description, ≤132 chars):**

> Your browsing as a playful constellation. Watch the rabbit hole bloom, replay the descent, pin the map — 100% local & private.

**Category:** Fun

**Language:** English

**Detailed description:**

> **Rabbit Hole Map — watch where the time went**
>
> You looked up a carbonara recipe. Three hours later you're reading about
> trebuchets. Rabbit Hole Map turns that journey into a living constellation:
> every page is a candy-colored star, every link you click draws an arrow, and
> the whole thing blooms across a bright cartoon sky while you browse.
>
> **A map that draws itself**
>
> No setup, no lists, no accounts. Browse like you always do — the map builds
> live. Pages you revisit grow bigger. Opening a link in a new tab connects it
> back to the page that spawned it, so even your messiest multi-tab spirals stay
> one connected trail. A 30-minute break starts a fresh map, so tonight's rabbit
> hole doesn't blur into this morning's.
>
> **Replay the descent**
>
> Hit ▶ Replay and watch your session rebuild itself in order, node by node,
> each one bouncing in with its own rising coin-blip — like a level intro for
> your own curiosity. Scrub the timeline to any moment. Then double-click any
> star to jump back into that page.
>
> **Arrange your burrow**
>
> Drag nodes to lay the map out your way — dragged nodes get a gold ring and
> stay exactly where you put them. Export the constellation as a PNG and show
> everyone how "one quick search" became 43 pages.
>
> **A scoreboard, not a guilt trip**
>
> The toolbar popup keeps score like a game: pages visited, hops taken, your
> deepest chain, your most-haunted site, and the time gloriously wasted. You
> already went down the rabbit hole — you might as well get the high score.
>
> **Private by design**
>
> Everything stays in your browser's local storage. Nothing is sent anywhere,
> ever. Incognito is never recorded. Block any domains you'd rather not map,
> and clear all data with one click.

## Media

Upload from `marketing/store/` (regenerate with `npm run assets`):

| File | Where it goes |
| --- | --- |
| `store-icon-128.png` | Store listing icon |
| `screenshot-1.png` … `-5.png` | Screenshots, in order (1280×800) |
| `promo-tile-440x280.png` | Small promo tile |
| `marquee-1400x560.png` | Marquee promo tile |

Screenshot order is the pitch: **the constellation → the replay → arrange &
pin → the scoreboard → PRESS START**.

No promo video yet — if we make one, upload to YouTube and paste the URL here.

## Privacy tab

- Privacy policy URL: host `rabbit-hole-map-PRIVACY.md` (GitHub Pages or a gist)
  and paste its public URL.
- Copy the answers verbatim from `docs/privacy-practices-copy.md`.
