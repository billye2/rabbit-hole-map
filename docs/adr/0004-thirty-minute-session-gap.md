# ADR-0004 — Sessions split on a 30-minute gap

**Status**: accepted

## Context

A "rabbit hole" is one continuous distraction, not a day of browsing.
Some boundary must cut the graph into stories.

## Decision

A navigation more than 30 minutes after the current session's last event
starts a new session (`SESSION_GAP_MS` in `src/model.ts`).

## Consequences

Sessions read as single sittings. The constant is the product decision;
changing it is a product change, not a tuning knob.
