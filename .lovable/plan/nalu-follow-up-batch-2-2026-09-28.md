# Nalu Follow-up Batch 2

## Goal
Rebuild Nalu around a calmer, faster commuter-decider experience while preserving the current routing, GTFS, saved-place, active-navigation, and privacy behavior.

## Phase 1 — Safety, compliance, and release foundations
- Add authenticated, server-side account deletion with an explicit destructive confirmation in Account settings.
- Add a pre-permission location rationale, offline/airplane banner, and visible Terms and Privacy pages/links.
- Audit every database table and public endpoint; tighten grants, row policies, input validation, privacy filtering, and abuse controls where appropriate.
- Keep active navigation fail-open against app throttling; use bounded endpoint limits only for public import/dispatch and expensive anonymous lookups.
- Verify no privileged key reaches browser code. Document provider-side Mapbox domain restrictions as a release requirement because those controls cannot be enforced in source code.

## Phase 2 — Pacific Calm visual system and commuter verdict
- Refresh semantic Oklch tokens to deep obsidian, seafoam, cyan, restrained amber/coral, and consistent frosted surfaces.
- Remove nested panels and all-caps labels; standardize 16px radii, sentence-case hierarchy, whitespace, and tabular times.
- Replace the duplicate verdict pill and hero with one decisive block: recommendation or tie, shared-scale Drive/Transit time bars, leave-by and arrival targets.
- Keep destination controls and Start Drive / View transit details in the lower thumb zone with safe-area spacing.

## Phase 3 — Unified Mapbox experience
- Replace browse and comparison Leaflet maps with shared, lazy-loaded Mapbox primitives; preserve route geometry, traffic highlighting, stop sequence segments, fit/recenter, and satellite/standard controls.
- Render stops at 20px and 26px selected. On selection, offset the camera upward and show a compact arrival preview with Set as origin / Set as destination.
- Keep loading skeleton dimensions stable and preserve cached route/station data while refreshing in the background.
- Remove Leaflet and its stylesheet only after every map surface has migrated and regression checks pass.

## Phase 4 — Modular architecture
- Extract the current home screen into focused domain modules: CommuteHome, ActiveNavHUD, ExploreMap, SavedPlacesSheet, plus shared verdict/timeline pieces.
- Keep orchestration and shared query state close to the route initially, then move only stable domain state into focused hooks.
- Preserve current server functions, GTFS-derived naming, route directionality, active-trip recovery, and saved-place sync throughout extraction.

## Phase 5 — Active commute and voice resilience
- Strengthen the active HUD around next maneuver, distance, and ETA with higher contrast and landscape-safe placement.
- Extend Hawaiian pronunciation normalization and keep route-versioned far/near/passed locks.
- Add stage-aware transit guidance for walk, bus, rail, transfers, and final walk.
- Add conservative short-gap dead reckoning from the last accepted fix, heading, and speed; snap back immediately when trusted GPS returns and never fabricate progress during prolonged signal loss.

## Phase 6 — Discoverability and crawler files
- Add `llms.txt`, `llms-full.txt`, `sitemap.xml`, and updated crawler rules.
- Add dedicated FAQ content and JSON-LD for SoftwareApplication and applicable HowTo content.
- Use TransitStation schema only for data-derived station content actually rendered by Nalu; do not publish a fabricated static station directory.
- Ensure each content page has unique title, description, Open Graph, and Twitter metadata.

## Verification
- Run focused navigation, geocoding, privacy, auth, and data tests, then the full test suite.
- Check build diagnostics and database security lint.
- Exercise first visit, permission rationale, destination planning, stop selection, Drive/Transit comparison, account deletion confirmation, offline recovery, and active navigation in portrait and landscape.
- Verify mobile widths and tablet layouts with screenshots before removing legacy map code.

## Technical notes and boundaries
- Account deletion will use an authenticated server function and privileged deletion only after caller verification; no service credential is exposed client-side.
- Source code can enforce privacy and authorization, but Mapbox referrer restrictions must also be configured in the Mapbox account for the preview, published, and future custom domains.
- True tunnel positioning is unavailable from browser GPS alone. Nalu will provide bounded visual continuity for short outages, not claim precise tunnel navigation.
- The overhaul will land in phases so the 6,700-line home route can be decomposed without breaking existing commute logic.
