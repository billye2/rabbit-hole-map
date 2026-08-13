# ADR-0007 — Live arrival is signalled by the Session Store, never inferred

**Status**: accepted 2026-08-13

## Context

"A site was visited live" used to be inferred inside the map's
`rebuild()` by diffing rendered node ids against a `seenNodeIds` set,
gated by a double-duty `soundArmed` flag. Replay scrubbing clears that
set, so replaying history dropped carrots and played coin blips — the
replay-feeds-the-rabbit bug.

## Decision

The Session Store's change stream names the nodes each write added (a
stateless `oldValue`/`newValue` diff inside the storage change event) and
delivers them as `liveNodeIds`. Gameplay and audio react only to that
signal. Replay paths simply never receive it.

## Consequences

`soundArmed` is gone; `seenNodeIds` remains only for the pop-in bounce
animation, which replay keeps on purpose. An e2e test pins "replaying an
old session drops no carrots". Any future "is this new?" question in the
map should be answered by the store's stream, not by render-state diffing.
