# Nalu 3.0 — Intelligence Core Foundation

## Purpose

Nalu 3.0 treats the consumer app as the first product built on top of reusable Nalu mobility intelligence.

The first implementation step is deliberately additive: define a provider-neutral decision contract before moving existing production logic. Existing UI, routing, transit, weather, and AI flows remain unchanged until each capability is migrated and regression-tested.

## Core boundary

```
TripRequest
    ↓
MobilitySnapshot
    ↓
NaluDecision
    ↓
Consumer UI / Ask Nalu / Navigation / future partner integrations
```

### TripRequest

The normalized question Nalu is being asked:

- origin
- destination
- departure or arrive-by constraint
- available modes
- optional user constraints/preferences
- request timestamp

### MobilitySnapshot

The evidence available to Nalu at decision time:

- drive route/ETA and traffic state
- transit/rail itineraries and schedule/live observations
- incidents
- weather/environment conditions
- provider timestamps/freshness
- provider/source metadata

Providers are evidence sources. They are not the Nalu decision layer.

### NaluDecision

The normalized decision produced from that evidence:

- selected mode
- alternatives
- departure/arrival timing
- reasons
- warnings
- freshness
- confidence/uncertainty where supported by evidence

A provider ETA must never be represented as Nalu certainty. If a source cannot provide uncertainty, Nalu must not manufacture a range.

## Migration rules

1. Do not rewrite the consumer app.
2. Do not move production logic until its behavior is covered by tests.
3. Prefer pure, provider-neutral reasoning over UI-coupled decisions.
4. Keep provider adapters at the boundary.
5. Keep Oahu-specific feeds/data in adapters or data modules; do not bake Oahu into the core contracts.
6. Preserve source freshness and provenance so the UI can explain why Nalu reached a conclusion.
7. One capability at a time: migrate, test, review, integrate, then move to the next capability.
8. Every migration requires regression coverage for existing consumer behavior.

## Initial migration order

1. Drive-vs-transit decision reasoning.
2. Arrive-by / leave-now timing.
3. ETA reconciliation and freshness.
4. Incident and weather impact reasoning.
5. Ask Nalu consumption of the same decision layer.
6. Navigation/live-trip consumption.
7. Only after the consumer engine is stable: evaluate a partner-facing/API boundary.

## What is intentionally not being built yet

- A public Nalu API
- Microservices
- A nationwide transit backend
- A second routing provider solely for abstraction's sake
- A full rewrite of existing route/planner code
- Enterprise-specific features

The objective is to create a clean seam for reuse without slowing down the consumer product.

## Ownership

- CTO / Engineering: architecture and implementation
- Chief Data/AI: evidence quality and reasoning semantics
- CPO / Customer: decision usefulness and commuter clarity
- Legal & Privacy: data provenance, location/privacy implications
- CFO: provider/API cost measurement
- CEO: long-term product/platform alignment

The board should review major architectural pivots. Routine migration and QA should proceed through the normal departmental pipeline without requiring a board meeting.
