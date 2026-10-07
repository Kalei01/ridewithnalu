# Nalu experience backlog

Shared to-do list for the `nalu-premium-experience` agent: the one-off build
batches and the twice-weekly experience review both read and update it, so
nothing is redone or contradicted. Newest log entries go at the bottom.

Status words: TODO, IN PROGRESS, DONE (date, commit), DECISION (needs the owner),
REPORT (goes to transit-accuracy / the owner, not built by this agent).

Source: the agent's first audit, Oct 6 2026 (~4:35 PM HST, live site, 390x844).

## Batch 1 — honest loading (IN PROGRESS, session "Nalu premium agent — honest loading fixes")
- B1 Planner failure shown as "No Skyline trip that makes sense"; Skyline row can vanish on failure.
- B2 Loading verdict looks final (green check, "Nalu says", Bus row pre-selected).
- B9 "Weather unavailable" / "Update time unknown" while still loading.
- Polish 1 Drive arrives in ~1 s; fill rows as answers arrive with a short status line.

## Batch 2 — bugs riders hit (IN PROGRESS, session "Nalu premium agent — batches 2-4")
- B4 Live transit screen loses the plan: show the next step ("Walk to Lelepaua station · board W Line 5:00 PM"); Route details with real step text (src/routes/index.tsx ~5459-5470, LiveNavMap.tsx ~416-435). "TRANSI…" truncation in TripControls.tsx ~98; Mapbox logo under the bottom bar.
- B3 `.nalu-brand::after` band strikes through "HEADING OUT / HEADING HOME" (src/liquid-titanium.css ~737).
- B8 Wording: "Countryexpress!", "W LINE" vs "W Line" (headsign/route formatting, src/lib/commute-formatting.ts); "15 min walkLong walk" (TransitItinerary); "Moanalua Freeway(H-201)" on /roadwork; station spellings via a display-name map, never by changing GTFS IDs ("Kualaka'i", "Kualakai", "Keone'ae U.H. West Oahu" → Kualakaʻi, Keoneʻae (UH West Oʻahu)); raw HDOT capitals in the in-app roadwork card (reuse the /roadwork formatter). ("Accurate to about 0 ft" was a test artifact — withdrawn.)
- B5 Shared trip link loses its destination when location is blocked: pre-fill "To", ask only for the start.

## Batch 3 — motion (TODO) — prompt sections 6, 7, 9, 11
- Recommendation change (DRIVE ↔ SKYLINE/BUS): calm cross-fade of the verdict text with the anchor fixed (300-450 ms), never whole-page, reduced-motion = opacity only.
- ETA/number changes: subtle in-place update (no flash, no layout jump), ~180-280 ms, none under reduced motion.
- Map: tapping a step should not scroll the page when the map is already visible; map moves ~400 ms; `behavior:"auto"` / `animate:false` under reduced motion (CommuteRouteMap.tsx, NearbyTransitMap.tsx, LiveNavMap.tsx, index.tsx ~3635).
- Trip question: lucide Car/Bus icons instead of 🚗/🚌; no "drop-/off" break; ~120 ms press feedback.

## Batch 4 — layout and clarity (TODO)
- Rows above the fold: direction + Leave/Arrive toggles take ~300 px; Skyline/Bus start ~y=900 (index.tsx, ArriveByControls.tsx).
- "Selected" vs "Nalu's pick": ice-blue selection ring (liquid-titanium.css ~837), green only for the pick; ROUTE line follows the selected row or reads "Drive route".
- Duplicate facts on the drive screen ("35 min" ×4, route ×3, "(parking not included)" ×3, "Moving steady" vs "Light"); roadwork card should say when a closure isn't during this trip (HdotRoadworkNotice.tsx, src/lib/roadwork.ts).
- Shared link start: open on the trip question, not Browse; one quiet toast or none.
- Arrive By opens with an empty time ("--:-- --"); "Where to?" field not focused on open; Browse map switch covers a marker; nearest-stop list order (39-min walk above a 1-min stop); "To home" with no Home saved.
- Public pages: one "Plan my trip" button after the intro on /oahu-commute and guides; hard dark rectangle behind hero text. Check `git log` and docs/seo/search-review-log.md first (the search agent also edits these pages).

## Reported, not for this agent
- REPORT B6 Board time vs live bus time (walk arrives 4:46, bus shown 4:45 unlabelled) — transit-accuracy.
- REPORT B7 "Too close to call · About 26 min apart" (Arrive By 6:30 PM) — verdict engine, transit-accuracy.
- DECISION Database speed fixes from the Oct 6 read-only investigation (nearby_transit_stops rewrite, general-planner time window, fewer parallel searches, rail_stations cache, numeric time columns) — owner approval required for migrations.

## Not yet checked (no tool access in test runs)
Morning rush; Skyline-stopped-at-night and not-yet-running rows; a live verdict flip; map tiles and camera feel; signed-in features; real iPhone/Safari/VoiceOver.

## Log
- 2026-10-06 First audit (read-only). Findings above.
