# Chrome Web Store — submission package

Everything to paste into the Developer Dashboard for Rabbit Hole Map.

## Upload package

- **File:** `release/rabbit-hole-map-<version>.zip` (`manifest.json` at the zip root).
- (Re)package with **`npm run release`**. The Web Store rejects re-uploads of an
  existing version, so run `npm run bump` first when resubmitting.

## Listing fields

**Name:** Rabbit Hole Map — Browsing History Visualizer
_(45/45 chars, SEO pass approved 2026-08-09: brand prefix + the
highest-volume search terms. Comes from the manifest `name` — renaming means
a new zip + review round, so keep it stable. The repo/dev name stays plain
"rabbit-hole-map".)_

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
> each one bouncing back in — like a level intro for your own curiosity. Scrub
> the timeline to any moment, then double-click any star to jump back into
> that page. Every replayed page also drops a supply crate for the rabbit, so
> reliving the descent feeds the little guy all over again.
>
> **Feed the mech rabbit**
>
> A pixel-art mech rabbit patrols the grass at the bottom of the map. Every
> page you visit drops a supply crate from its star; the rabbit chases it
> down and cranks it open. Keep the crates coming and it grows — and at 5,
> 10, 20, 40, and 60 crates it evolves, permanently: gold mech → cannon-armed
> → grey battle armor with a sword → armored jeep → and at peak, a gold tank.
> Each milestone kicks off a ten-second double-speed rampage. Stop browsing
> and it shrinks back down (the tank stays, though — it earned that).
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

| File                          | Where it goes                                                      |
| ----------------------------- | ------------------------------------------------------------------ |
| `store-icon-128.png`          | Store listing icon                                                 |
| `screenshot-1.png` … `-6.png` | Screenshots, 1280×800 — the store caps a listing at 5, pick 5 of 6 |
| `promo-tile-440x280.png`      | Small promo tile                                                   |
| `marquee-1400x560.png`        | Marquee promo tile                                                 |

Screenshot order is the pitch: **the constellation → untangled, one click
later → the replay → arrange & pin → the scoreboard → the growth ladder**.

Promo video: `marketing/store/promo-video.webm` (~40s, regenerate with
`npm run assets:video`). Upload it to YouTube and paste the URL here:
**YouTube URL: _(pending upload)_**

## Privacy tab

- Privacy policy URL:
  https://github.com/billye2/rabbit-hole-map/blob/main/rabbit-hole-map-PRIVACY.md
  (this repo is public, so the policy hosts itself — no sibling copy to keep
  in sync.)
- Copy the answers verbatim from `docs/privacy-practices-copy.md`.

## Pre-submit checklist

- [ ] `npm run release -- --dry-run` green (tsc, lint, unit tests)
- [ ] `npm run e2e` green, including the a11y tier
- [ ] `npx playwright test visual` green locally (darwin baselines)
- [ ] `docs/manual-checklist.md` swept against the built extension
- [ ] Zip version is NEW to the store (never re-upload a seen version)
- [ ] Screenshots/tiles/video in `marketing/store/` regenerated if the UI changed
- [ ] YouTube URL above is current
- [ ] HANDOFF versions table updated after submitting (date + review outcome)
