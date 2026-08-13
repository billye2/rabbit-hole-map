# ADR-0006 — The unit-test seam is the esbuild ESM emit

**Status**: accepted 2026-08-13

## Context

Pure modules (ADR-0001) need to reach `node --test`. Two candidates: keep
the existing second esbuild pass that emits `dist/*.mjs`, or drop it and
run TypeScript directly via Node's type stripping (Node ≥ 22 in CI could).

## Decision

Tests import built `dist/*.mjs`. The entry-point list in `build.mjs` is
the explicit, reviewable statement of which modules sit on the unit-test
seam — adding a module to the seam is a visible one-line diff.

## Consequences

`npm test` builds first (it already did). A future review should not
re-propose direct-TS test execution as a cleanup; switching is a
deliberate CI/test-story decision, not a refactor side effect.
