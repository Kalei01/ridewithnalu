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

## Batch 2 — bugs riders hit (DONE 2026-10-07; owned by the batches 2-4 run after the earlier Opus session retired at its usage limit)
- DONE B3 (9f6513d): brand band moved off the heading line.
- DONE B4 (5bea123, b931f57): live transit bar shows the next step with the scheduled board time; Route details lists real step text; "Details" label stops "TRANSIT LIVE" truncating; Mapbox logo lifted above the bar.
- DONE B8 (9f6513d, b931f57): CountryExpress, W Line, Kualakaʻi, Keoneʻae (UH West Oʻahu) via a display-name map (GTFS ids untouched); "walk Long walk" and "Freeway(H-201)" spacing; in-app roadwork card reuses the /roadwork tidy formatter and keeps schedule + project link.
- DONE B5 (d3a9852): blocked/unavailable location opens "Where to?" with To pre-filled.
Original notes:
- B4 Live transit screen loses the plan: show the next step ("Walk to Lelepaua station · board W Line 5:00 PM"); Route details with real step text (src/routes/index.tsx ~5459-5470, LiveNavMap.tsx ~416-435). "TRANSI…" truncation in TripControls.tsx ~98; Mapbox logo under the bottom bar.
- B3 `.nalu-brand::after` band strikes through "HEADING OUT / HEADING HOME" (src/liquid-titanium.css ~737).
- B8 Wording: "Countryexpress!", "W LINE" vs "W Line" (headsign/route formatting, src/lib/commute-formatting.ts); "15 min walkLong walk" (TransitItinerary); "Moanalua Freeway(H-201)" on /roadwork; station spellings via a display-name map, never by changing GTFS IDs ("Kualaka'i", "Kualakai", "Keone'ae U.H. West Oahu" → Kualakaʻi, Keoneʻae (UH West Oʻahu)); raw HDOT capitals in the in-app roadwork card (reuse the /roadwork formatter). ("Accurate to about 0 ft" was a test artifact — withdrawn.)
- B5 Shared trip link loses its destination when location is blocked: pre-fill "To", ask only for the start.

## Batch 3 — motion (DONE 2026-10-07: caa98e8, 60ac980, da682df)
Done: verdict cross-fade (360 ms, opacity only, only when DRIVE/transit flips); verdict-card time numbers settle in place (220 ms, off under reduced motion); map glide ~400 ms and instant under reduced motion in CommuteRouteMap/NearbyTransitMap; step taps scroll only when the map is off screen. Trip question uses Car/Bus icons, non-breaking "drop‑off", 120 ms press. Skipped: LiveNavMap (Mapbox) camera timing and per-row ETA fades in the Drive/Skyline/Bus rows (rows live deep in index.tsx; not touched). Original list: — prompt sections 6, 7, 9, 11
- Recommendation change (DRIVE ↔ SKYLINE/BUS): calm cross-fade of the verdict text with the anchor fixed (300-450 ms), never whole-page, reduced-motion = opacity only.
- ETA/number changes: subtle in-place update (no flash, no layout jump), ~180-280 ms, none under reduced motion.
- Map: tapping a step should not scroll the page when the map is already visible; map moves ~400 ms; `behavior:"auto"` / `animate:false` under reduced motion (CommuteRouteMap.tsx, NearbyTransitMap.tsx, LiveNavMap.tsx, index.tsx ~3635).
- Trip question: lucide Car/Bus icons instead of 🚗/🚌; no "drop-/off" break; ~120 ms press feedback.

## Batch 4 — layout and clarity (PARTLY DONE 2026-10-07)
Done: selected row is ice-blue and green is only Nalu's pick; the road line reads "Drive route"; Arrive By opens with a real time (an hour out); "Where to?" field is focused on open; nearest stops sorted closest first; "To home" reads "Return trip" when no Home is saved.
NEEDS OPUS SESSION — rows above the fold (reworks the top of index.tsx: direction + Leave/Arrive controls).
NEEDS OPUS SESSION — duplicate facts on the drive screen ("35 min" x4, route x3, parking note x3, "Moving steady" vs "Light"): spread across several cards in index.tsx.
NEEDS OPUS SESSION — roadwork card saying when a closure isn't during this trip: needs trip-time vs closure-window logic (src/lib/roadwork.ts), which is commute logic.
NEEDS OPUS SESSION — shared link opening on the trip question instead of Browse + one quiet toast: startup flow in index.tsx.
Verified on the live site Oct 7 2026 ~7:20 AM HST (390×844, main session): ice-blue outline on the selected row with green only on Nalu's pick, "Drive route" label, nearest stops sorted by walk (1, 2, 4, 4, 5, 39, 49 min), and Where to? focuses the search field; no page errors.
Not attempted (small, next run): Browse map switch covering a marker; "Plan my trip" button on /oahu-commute and guides and the hard dark rectangle behind hero text (public pages are shared with the SEO agent — check docs/seo/search-review-log.md first).
Original list:
- Rows above the fold: direction + Leave/Arrive toggles take ~300 px; Skyline/Bus start ~y=900 (index.tsx, ArriveByControls.tsx).
- "Selected" vs "Nalu's pick": ice-blue selection ring (liquid-titanium.css ~837), green only for the pick; ROUTE line follows the selected row or reads "Drive route".
- Duplicate facts on the drive screen ("35 min" ×4, route ×3, "(parking not included)" ×3, "Moving steady" vs "Light"); roadwork card should say when a closure isn't during this trip (HdotRoadworkNotice.tsx, src/lib/roadwork.ts).
- Shared link start: open on the trip question, not Browse; one quiet toast or none.
- Arrive By opens with an empty time ("--:-- --"); "Where to?" field not focused on open; Browse map switch covers a marker; nearest-stop list order (39-min walk above a 1-min stop); "To home" with no Home saved.
- Public pages: one "Plan my trip" button after the intro on /oahu-commute and guides; hard dark rectangle behind hero text. Check `git log` and docs/seo/search-review-log.md first (the search agent also edits these pages).

## Approved product proposals (Josh, Oct 8 2026 — see docs/product/proposals.md)
- DONE 2026-10-08 (P-1, commit 073accd; app side live) — visitor funnel: anonymous daily step counters (landed intro/guide/app → trip answer requested → answer shown + speed bucket → Open in Maps → installed), privacy page wording added, Sunday review "Funnel" step added. NEEDS OWNER: migration `drizzle/migrations/0064_visitor_funnel.sql` (database reviewer OK) is not applied; until it is, nothing is stored and the app is unaffected. Left over: the endpoint has no rate limit and accepts any link tag (numbers are approximate; security-keys Medium); "came back within 7 days" and sign-ups come from app_opens / accounts.
- DONE 2026-10-08 (P-2 items 2, 4, 5; commits f0b387c, 5625db7, d3d4e0d, 004f6b6, 07b055b) — guide pages: Try this trip panel (Leave now / Arrive by + time, opens the planner pre-filled), Nalu's take box (5 trip guides) + FAQ accordions (FAQ data unchanged), section cards with icons, H-1 vs Skyline diagram. Left: breadcrumb/inline guide links are under 44 px tall (existing).
- NEEDS OPUS SESSION — APPROVED 2026-10-08 (P-2 items 1, 3): live "Right now" card per trip guide (server-side cache, refresh ≤ every 10 min, shows when updated, never shows stale as current) and a small route/station/park-and-ride map on guide pages.

- DONE  (P-4 commit 0308e15; P-3 and P-5 next commit) APPROVED (P-3, P-4, P-5) — feedback "Tell Nalu something" (Settings > About + trip screen link), cost/limit check (scripts/usage-check.mts, docs/maintenance/service-limits.md), BUSINESS SNAPSHOT in the weekly review. Migration 0066 applied Oct 7 10:27 PM HST (see docs/maintenance/autofix-log.md); notes are now stored. Optional: add CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID secrets for Workers coverage. — cost and limit guard; in-app feedback; weekly business snapshot. See docs/product/proposals.md. Built one at a time by a dedicated Sonnet build session after the planner-speed session finishes (owner wants one session at a time).

- TODO (polish, seen live Oct 7 at 390×844) — "Tell Nalu something" form: the "Include this trip" switch reads as an empty outline when off (give the off state a visible track/thumb), and the title and the text-box label both say "Tell Nalu something" (relabel the box, e.g. "Your note"). src/components/TellNalu.tsx.

## Reported, not for this agent
- REPORT B6 Board time vs live bus time (walk arrives 4:46, bus shown 4:45 unlabelled) — transit-accuracy.
- REPORT B7 "Too close to call · About 26 min apart" (Arrive By 6:30 PM) — verdict engine, transit-accuracy.
- APPROVED (owner, Oct 6) Database speed fixes from the Oct 6 read-only investigation:
  - Fewer parallel searches (src/lib/transit-plan.ts): DONE (2026-10-07, commit "Stagger the Skyline bridge and drop-off station searches").
  - nearby_transit_stops rewrite (migration 0063 + stop_modes): PREPARED, rehearsed 56/56 identical, NOT yet applied to production (no database access in the session). Steps: scripts/db-speed/README.md.
  - General-planner time window: NOT ADOPTED (not faster in rehearsal; changed tie picks in 5/72 cases). Reasons in scripts/db-speed/README.md.
  - rail_stations cache: not needed (25 ms). Numeric time columns: not started.

## Not yet checked (no tool access in test runs)
Morning rush; Skyline-stopped-at-night and not-yet-running rows; a live verdict flip; map tiles and camera feel; signed-in features; real iPhone/Safari/VoiceOver.

## Log
- 2026-10-06 First audit (read-only). Findings above.
- 2026-10-07 Database speed work: search staggering shipped; 0063 prepared and rehearsed on a local copy with TheBus's real feed, waiting for someone with database access to apply it; planner time window dropped.
- 2026-10-07 Batches 2-3 shipped (see their entries). Reviewed by transit-accuracy (fixed: step stays on "board" until board time, scheduled label, roadwork schedule/link kept), mobile-design, security-keys.
- 2026-10-07 Batch 4 partly shipped; four items marked NEEDS OPUS SESSION (reasons above).
