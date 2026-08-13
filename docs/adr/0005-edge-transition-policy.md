# ADR-0005 — Edges only for link / form_submit / client_redirect

**Status**: accepted

## Context

Chrome reports a transition type per navigation. Crediting every
navigation as a hop would wire unrelated browsing into one tangle.

## Decision

Only `link`, `form_submit`, and `client_redirect` transitions create
edges, plus opener attribution when a page spawns a new tab. Typed URLs
and omnibox searches deliberately start new roots.

## Consequences

The graph shows how one page led to another, not everything that
happened in a window. Multiple roots per session are normal and wanted.
