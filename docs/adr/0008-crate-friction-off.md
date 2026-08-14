# ADR-0008 — Crate friction off: every visit feeds the rabbit, replay included

**Status**: accepted 2026-08-13 (amends the consequences of ADR-0007)

## Context

Crates only dropped when a navigation survived a chain of gates: the URL
had to be new to the session, the map tab had to be open at the moment of
the write, the displayed session had to be the live one, replay never
dropped anything, and both the per-burst and on-ground caps sat at 12.
Ordinary browsing (revisits, browsing with the map closed) starved the
rabbit. Verdict from the field: "this is no longer fun for the rabbit."

## Decision

Friction is reduced as far as it can go without corrupting the data model:

1. **Re-visits count.** The Session Store's change stream names nodes
   whose visit count grew, not just newly-added ids. Content-only writes
   (title patches) still name nothing.
2. **Catch-up drops.** Opening a session that is still fresh (inside the
   30-minute live gap) drops crates for its most recently visited pages —
   browsing done while the map was closed is honored. Once per session
   per page load.
3. **Replay is a supply line.** Every node a replay pass reveals drops a
   crate, tracked per pass (`replayFedIds`) and reset when the view
   returns to live — so re-running the replay drops everything again.
   This is an intentional infinite faucet, requested explicitly: the
   replay button is the "feed the rabbit" button. Replay stays silent
   (no coin blips) and its bounce-in behavior is unchanged.
4. **Caps raised.** `MAX_CRATES` (ground cap and per-burst cap) 12 → 20,
   now exported from `gameplay.ts` so the map and tests share it.

Unchanged: reloads still don't record visits (they would inflate the
tracking data, not just the game), the blocklist still applies, and a
write for a session other than the displayed one still drops nothing.

## Consequences

ADR-0007's mechanism stands — live drops still key off the store-named
signal, never render-state diffing — but its "replay paths simply never
receive it" consequence no longer implies "replay drops no crates":
replay now feeds the rabbit through its own explicit path in `map.ts`
(`feedFromReplay`), separate from the live signal. The e2e pin flipped:
"replay is a supply line: replayed history drops crates, every run."
Milestones (5/10/20/40/60) are reachable at will via replay; growth is
now a player choice, not a grind.
