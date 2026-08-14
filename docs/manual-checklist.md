# Manual verification checklist

Run `npm run build`, load the repo folder as an unpacked extension
(`chrome://extensions` → Developer mode → Load unpacked), then browse a few
linked pages to seed a session. One checkbox per user-visible behavior —
sweep this before every store upload.

## Tracking & sessions

- [ ] Click through 3+ links on one site → each page becomes a node, arrows follow the click order
- [ ] Middle-click / `target=_blank` a link → the new tab's page connects back to the page that spawned it
- [ ] Reload a page several times → visit count on the node does NOT inflate, no self-loop arrow appears
- [ ] Visit a URL with `#fragments` → lands on the same node as the fragment-less URL
- [ ] Typed URL / omnibox search → starts a new root (no arrow from the previous page)
- [ ] Browse in incognito → nothing is recorded
- [ ] Add a domain to the Options blocklist (subdomains too) → visits there are never recorded; saved list normalizes `www.`
- [ ] Wait 30+ minutes idle, browse again → a fresh session starts; the old one is still in the session picker
- [ ] Options → Clear all data → every session gone, map shows PRESS START

## Map page

- [ ] Open the map with the toolbar popup's button → current session renders (nodes sized by visits, colored by domain, favicons)
- [ ] New pages visited while the map is open bounce in live with a coin blip
- [ ] Open the map in a BACKGROUND tab, visit pages, focus the tab → nodes are positioned correctly (not stacked at 0,0)
- [ ] Hover a node → speech-bubble tooltip; hover HUD controls → state-aware tooltips
- [ ] Double-click a node → that page opens in a new tab
- [ ] Drag a node → it pins where dropped (gold ring), physics settles around it; ⌥-click releases it
- [ ] ▶ Replay → trail replays hop by hop (silent — no blips); every revealed node drops a crate; scrubber drags work; "live" resumes at the end; pressing ▶ again re-drops the crates (the faucet refills)
- [ ] Untangle → tidy left-to-right lanes, auto zoom-to-fit; click again → physics returns; gold rings survive both modes
- [ ] 🎵/🙉 mute toggle silences all blips and persists across reloads
- [ ] Export PNG → downloaded image shows the constellation incl. pinned rings
- [ ] Session picker → older sessions load and render

## Rabbit

- [ ] Sprite rabbit roams the grass (front-facing frames when idle, side-walk frames while moving, flips with direction — no frame should face the wrong way mid-cycle); any visited site (new OR revisited) drops a crate from its node; rabbit alerts (❗), chases, cranks it open in three clanks
- [ ] Opening the map on a fresh session drops catch-up crates for recently visited pages
- [ ] 5th crate → 10-second overdrive (servo power-up chord, double speed — no aura/flames overlays), then it calms down bigger (+25%)
- [ ] Milestones evolve the form permanently: cannon at 10, battle armor + sword at 20, jeep at 40, tank at 60 (farmable via replay); no stray lines, dots, or fragments on any frame
- [ ] After the 5th crate, new drops are Iron crates (steel-blue) instead of Wooden (brown) — a crate already on the ground keeps its old look
- [ ] No crates for 30s → rabbit shrinks 10% at a time, never below original size; opening a crate resets the clock (the evolved form never reverts)

## Popup & housekeeping

- [ ] Toolbar popup scoreboard matches the session (pages, hops, deepest burrow, top haunt, time wasted)
- [ ] Popup with no session shows the empty state, not zeros
- [ ] Extension icon renders crisply in the toolbar and on `chrome://extensions`
- [ ] After an extension update/reload, an already-open map tab still works after a refresh
