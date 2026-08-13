# ADR-0003 — No runtime dependencies

**Status**: accepted

## Context

MV3's CSP forbids remote code, the extension must stay small, and every
shipped dependency is a review liability in the Web Store.

## Decision

Nothing that ships in the extension comes from npm: the force layout,
sound effects, and rabbit are hand-rolled. Dev-time dependencies
(esbuild, Playwright, eslint, prettier, resvg) are fine — nothing of
them ships.

## Consequences

An architecture review should never propose "just use d3/howler/etc."
for shipped code. Bundle stays tiny; `dist/` is fully self-contained.
