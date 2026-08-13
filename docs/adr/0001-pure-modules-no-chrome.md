# ADR-0001 — Pure logic lives in chrome-free modules

**Status**: accepted (original decision for `model.ts`; extended 2026-08-13
to `gameplay.ts`, `schema.ts`, `view.ts`, and the storage seam)

## Context

Extension code that touches `chrome.*` can only be exercised inside a real
browser, which makes its logic e2e-only and slow to test.

## Decision

Graph logic (`src/model.ts`), rabbit gameplay (`src/map/gameplay.ts`), the
storage schema (`src/schema.ts`), and the map's view-state
(`src/map/view.ts`) contain no `chrome.*` and no DOM. Effectful modules
(background, storage's chrome adapter, the map page, the rabbit paint
adapter) stay thin and wire pure results into the browser.

## Consequences

The behaviour that matters is unit-testable in plain Node (see ADR-0006
for how it reaches the tests). Keep it that way: new logic goes in a pure
module first, and a pure module that grows a `chrome.*` call is a bug.
