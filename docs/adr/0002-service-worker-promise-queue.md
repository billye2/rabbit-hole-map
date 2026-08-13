# ADR-0002 — All service-worker handlers funnel through a promise queue

**Status**: accepted

## Context

MV3 service-worker event handlers interleave, and each of ours does a
read-modify-write on shared storage keys (session record, index, tab
state). Interleaved handlers silently lose writes.

## Decision

Every listener in `src/background.ts` wraps its work in `enqueue`, a
single promise chain that serializes all mutations.

## Consequences

No write races within the service worker. The queue is fire-and-forget;
the storage-visible write sequence the Session Store bumps on every
`saveSession` is the observable drain signal for tests.
