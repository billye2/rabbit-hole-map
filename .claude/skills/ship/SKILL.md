---
name: ship
description: Rabbit Hole Map wrap-up ritual — sweep docs/HANDOFF for staleness, update memory, commit, push, verify CI, cut the two-phase release, hand over the reloadable build, report the store zip. Use when the user says "ship", "prepare release", "update docs and release", or "commit, push, release".
---

Run the Rabbit Hole Map ship ritual (adapted from editpdf's). Steps, in
order — skip a step only when there is genuinely nothing for it to do, and
say so.

## 1. Docs staleness sweep

Compare recent commits (`git log --oneline` since the last `Release v*` tag)
against the docs and fix drift:

- `HANDOFF.md` — test counts, design decisions for any new hard-won gotcha,
  the versions live/queued/skipped table, ideas list. The version pointer is
  `package.json` — never hardcode a version here.
- `README.md` — Features / Scope bullets for new or changed behavior. Watch
  for behavior lines a change made FALSE.
- `docs/STORE_LISTING.md` + `rabbit-hole-map-PRIVACY.md` — only when
  user-visible behavior, permissions, or data storage changed. The policy's
  public URL is this repo's own copy on GitHub (the repo is public).
- `marketing/` — if the UI changed visibly, regenerate `npm run assets`
  (and `npm run assets:video` if the flow shown in the video changed).

## 2. Memory

Update the auto-memory project file (rabbit-hole-map-project.md): new
capabilities, invariants, settled decisions. Update — do not duplicate.

## 3. Commit

- Split unrelated batches into separate logical commits; messages explain
  WHY, written as outcomes ("Reloads no longer inflate visit counts").
- Never commit `.cache/` (CfT binary) or test artifacts; check `git status`
  for surprises before any `git add`.
- End commit messages with:
  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>

## 4. Build + push + CI

- **`npm run build` right after committing** — `dist/` must always reflect
  the just-committed code; tell the user they can reload the extension at
  `chrome://extensions` (↻) to test NOW, without waiting for CI.
- Push, then confirm the CI run for the pushed commit succeeds
  (`gh-axi run list`, poll in the background). Keep working meanwhile, but
  do not START the release until it's green — **never tag a red build**.

## 5. Release (two-phase)

- Write the `## [X.Y.Z]` CHANGELOG section for the next version first
  (`npm run bump -- --dry` previews the number) — the release script
  refuses to run without it.
- `npm run release` — gates (tsc/lint/tests), odometer bump, build, zip,
  `Release vX.Y.Z` pathspec commit, annotated tag. The moment it succeeds,
  tell the user the released build is in `dist/` — reload and it's live.
- Review the release commit, then `npm run release:publish` — push main +
  tag, GitHub release with the zip and the changelog section as notes.
- Report: new version, zip path (`release/rabbit-hole-map-<v>.zip` — the
  Web Store upload), CI status. Update the HANDOFF versions table.

If any gate fails, stop and fix before releasing.
