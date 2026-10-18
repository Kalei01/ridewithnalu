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

- DONE (Oct 11; off checkbox now has a visible border and fill, box relabelled "Your note") (polish, seen live Oct 7 at 390×844) — "Tell Nalu something" form: the "Include this trip" switch reads as an empty outline when off (give the off state a visible track/thumb), and the title and the text-box label both say "Tell Nalu something" (relabel the box, e.g. "Your note"). src/components/TellNalu.tsx.

## Seasonal touches
- DONE (2026-10-14) Framework + Halloween (Oct 24–31). TODO: greeting in the Browse header (NEEDS OPUS SESSION, index.tsx); next season to prepare: Veterans Day Nov 11 (respectful, no afterglow) when inside the 4-week window.

## Reported, not for this agent
- REPORT B6 Board time vs live bus time (walk arrives 4:46, bus shown 4:45 unlabelled) — transit-accuracy.
- REPORT B7 "Too close to call · About 26 min apart" (Arrive By 6:30 PM) — verdict engine, transit-accuracy.
- APPROVED (owner, Oct 6) Database speed fixes from the Oct 6 read-only investigation:
  - Fewer parallel searches (src/lib/transit-plan.ts): DONE (2026-10-07, commit "Stagger the Skyline bridge and drop-off station searches").
  - nearby_transit_stops rewrite (migration 0063 + stop_modes): PREPARED, rehearsed 56/56 identical, NOT yet applied to production (no database access in the session). Steps: scripts/db-speed/README.md.
  - General-planner time window: NOT ADOPTED (not faster in rehearsal; changed tie picks in 5/72 cases). Reasons in scripts/db-speed/README.md.
  - rail_stations cache: not needed (25 ms). Numeric time columns: not started.

- REPORT (weekly review 2026-10-11, mobile-design): Skyline card says "You'll miss this one" and "Miss it? Next train at …" — fold into one line; "Scheduled times · TheBus / DTS" appears twice on one screen; "Kualakaʻi" shown with a plain apostrophe on the Skyline card and "O'AHU COMMUTE" on /welcome (use ʻokina); inline guide links on /oahu-commute are 17–20 px tall (touch targets). Tell Nalu form and trip results not seen by the reviewer — recheck live.

- REPORT (weekly review 2026-10-18, mobile-design/transit-accuracy): trip result repeats the same facts ("27 min faster" twice; "Via H-1 East → Nimitz Hwy" three times; "Live driving time (parking not included)" twice) — keep one strong line, detail beneath; footer "Bus & Skyline times · Updated just now" next to "from TheBus timetable" reads as live — say "Timetable" vs "Live" per source; "28min" → "28 min" in Drive details; "H-1 East" → "H-1 eastbound" in route rows and incident alerts; Skyline hint "Allow time to get to the platform." should say the walk; home map controls overlap a station marker, header tight at top; tap targets: "Include this trip" checkbox 20×20, Tell Nalu "Close" 16 px wide, home icon buttons 40×44, guide breadcrumbs 20 px tall. Not seen live: navigation HUD, Halloween touches, blocked-notification dialog.

## Not yet checked (no tool access in test runs)
Morning rush; Skyline-stopped-at-night and not-yet-running rows; a live verdict flip; map tiles and camera feel; signed-in features; real iPhone/Safari/VoiceOver.

## Log
- 2026-10-06 First audit (read-only). Findings above.
- 2026-10-07 Database speed work: search staggering shipped; 0063 prepared and rehearsed on a local copy with TheBus's real feed, waiting for someone with database access to apply it; planner time window dropped.
- 2026-10-07 Batches 2-3 shipped (see their entries). Reviewed by transit-accuracy (fixed: step stays on "board" until board time, scheduled label, roadwork schedule/link kept), mobile-design, security-keys.
- 2026-10-07 Batch 4 partly shipped; four items marked NEEDS OPUS SESSION (reasons above).
- 2026-10-11 Weekly review: mobile-design live pass (7 public pages, no layout breaks); wording/touch-target items added above.

- 2026-10-14 Seasonal framework built and Halloween added (see docs/experience/seasonal.md). Live check pending until deploy; Settings switch not clicked through in a browser.

## Batch M — motion (Josh approved Oct 13, 2026; build after the Skyline P1 is fixed, on the split files, one item per commit)
Rules: lightweight SVG and CSS or the Web Animations API only, no heavy animation libraries. No layout shift, no hit to LCP. Everything respects prefers-reduced-motion (static or opacity-only). Never delays an answer. Run the mobile-design reviewer and nalu-performance (page weight) for each.
- M1 DONE (2026-10-14, 4b24a95; live check pending) "Checking" progress: three lines (traffic, Skyline, TheBus) tick in as each real answer arrives. Driven by actual results, never a fake timer.
- M2 DONE (2026-10-14, 3a0c8ce) Welcome scene: an Oʻahu outline, a route line drawing Kapolei → town, and a car and a Skyline train moving side by side (illustrative, not a claim about speed). About 3 s, then rests. Inline SVG.
- M3 DONE (2026-10-14, c42b044) Guide diagrams: the Skyline line with its stations lighting in order (rail guide); park-and-ride lots along the line (park-and-ride guide). Server-rendered SVG, animated on scroll into view.
- M4 DONE (in-app part 2026-10-14, 65bbeee; public part earlier): (was PARTLY DONE) (2026-10-14, 84f83ca: button press feedback, cards ease in on public pages; left: in-app cards and the soft "leave now" pulse, which touch the answer screen) Polish: button press feedback, cards easing in on scroll, a soft pulse on "leave now" moments.

## Batch M2 — more motion (Josh approved all, Oct 13, 2026; after Batch M, same rules)
Extra rules for "implemented properly":
- Real data only: rain only with real weather, countdowns only from real times, celebrations from local on-device counts (no new server data).
- Budget: ≤ 20 KB of added CSS/JS for the whole batch, and no change to LCP/CLS on /, a guide or /roadwork (measure before and after).
- Reduced motion = static, or opacity only.
- Never cover or delay the answer. Personality stays light and never hides the pick (CLOUD_CODE_CONTEXT).
- One item per commit, with tests where there's logic, and the mobile-design and nalu-performance reviewers. Live check at 390×844 in light and dark.

Answer screen:
- M5 DONE (2026-10-14, e5739f7; live check pending) The pick lands: the winning row lifts slightly while the others dim.
- M6 DONE (2026-10-14, 58073d2; live check pending) Live countdown: "Next Skyline in 6 min" ticks smoothly and turns amber when it's time to go.
- M7 DONE (2026-10-14, a6550bf; live check pending) Traffic bar on the Drive row (green → amber → red from live vs typical minutes), tied to the real delay.
- M8 DONE (2026-10-14, b485e68; live check pending) Route preview: the route line draws on the map as the answer appears.

Moments:
- M9 DONE (2026-10-14, efb9de6; live check pending) Rain: soft drops on the backdrop only when showers are near the trip (existing weather data).
- M10 DONE (2026-10-14, 57ce56c; live check pending) Night: a calm night look after dark; a sleeping train when Skyline has stopped for the night.
- M11 DONE (2026-10-14, 24e1dab; live check pending) Celebrations: a small shaka after 5 mornings in a row (device-only count); a quick wave when Skyline beats the drive.

Around the app:
- M12 DONE (2026-10-14, 83701ea) Install walkthrough: a short animated "Add to Home Screen" for iPhone and for Android on /install.
- M13 DONE (2026-10-14, 4118d16; live check pending) Screen changes: a smooth slide between screens (View Transitions API where supported, instant otherwise).
- M14 DONE (2026-10-14, d0deb81; live check pending) Pull to refresh: a wave curl ("nalu" = wave) while it re-checks; works only on the app screen.

Add-ons (lead):
- M15 DONE (2026-10-14, 359eafe) Time-of-day header tint: sunrise, day, sunset or night, following Honolulu time, very subtle.
- M16 DONE (2026-10-14, bd07731; live check pending) Station names: the Hawaiian name fades in under the English one (direction.md format).
- M17 DONE (2026-10-14, 6bfb6be; live check pending) "Can't check" states: a calm icon with a gentle fade, never a shake or red flash; a retry button with a press response.
- M18 DONE (2026-10-14, 4dc9346; live check pending) Android haptic tick when the pick lands (navigator.vibrate, off when reduced motion is on; iOS has no web haptics, so skip it there).
- TODO (2026-10-14, from seasonal review) Greeting pill: reserve its space or render it server-side so the heading doesn't jump ~52 px during season dates; enlarge Settings 'Seasonal touches' switch tap target / move it somewhere easier to find.

- 2026-10-15 · Skyline parking guide preview built (Build 1 of 2): /guides/skyline-park-and-ride-preview (noindex). Lot cards with blue glow, static SVG map (SkylineMap, reusable), which-lot rows, compact times table, Try-trip card. Real page untouched. Entry: Josh approves before any switch.

- 2026-10-15 · Skyline parking guide redesign (Josh approved, zoomed map) SWITCHED LIVE at /guides/skyline-park-and-ride; preview route deleted; head unchanged.

- Skyline rail guide redesign: LIVE Oct 15 (preview removed). Pearl Harbor water tint on SkylineMap: DONE.

- 2026-10-15 · Skyline parking guide: Train times section redone as lot cards (same numbers), live.

- 2026-10-15 · Guides redesign batch 1 (kapolei, ewa, airport) live; shared GuideBlocks + glow GuideLayout for all guides.

- 2026-10-15 · Guides batch 1 fixes + batch 2 (mililani, uh-manoa, late-night, marathon) live.

- 2026-10-15 · Guides redesign batch 2 fixes + batch 3 (compare, about, hub) live; all 10 guides done.

- 2026-10-15 · Guides final polish (Kapolei takeaways list, About/compare strips trimmed, related chevrons, hub card name) live.

## Browse redesign — one live map + bottom sheet (approved by Josh Oct 18, 2026; 4 phases)
Design: map on top, one sheet with PEEK (Where to? + Nalu's one line + one live number, from data Browse already has), HALF (destination chips; Today = Morning/Evening Pulse + Beat the Rush; On the road = H-1 + incidents + roadwork + weather; Near you = Skyline station departures + nearby stops), FULL (weekly digest, walk to a picked stop, Ask Nalu, Install + LeaveAlert last). Default PEEK; opens to HALF on a pin tap, train tap or the search field. Hidden route `/browse-preview` (noindex, not linked, not in sitemap) until Josh approves the switch; real Browse untouched until then.
- Phase 1 — DONE Oct 18 (preview): sheet component (basic snap, drag from the handle only, FULL scroll contained, transform-only, instant under reduced motion), merged cards, own data hook (`src/components/commute/browse/`).
- Phase 2 — DONE Oct 18 (preview; see the log line below). Original scope: map layers (Skyline line + stations, trains on the line as scheduled, H-1 traffic colouring, incidents), map padding so pins/fit-bounds are not hidden by the sheet, pin/train tap opens HALF with the stop selected, popup actions (set start / destination) work in the sheet.
- Phase 3 — TODO (paused with the index.tsx split): move Browse's state out of `index.tsx` into one shared hook so preview and Browse stop duplicating it; bring back header Account/Settings, CommutePageNav, Tagline, pull-to-refresh and the Home/Work shortcut editing; switch "/" Browse to the sheet after Josh approves.
- Phase 4 — TODO: sheet physics (springs, velocity, rubber-band), map fly-to on selection, polish and reviewers.
- Approved motion effects (Josh Oct 18), all subtle, reduced-motion safe, none on the verdict/ETA rows: (1) trains glide along the Skyline line between scheduled stops; (2) flowing traffic dashes on H-1 only when delayed; (3) pulsing incident markers (short, not endless); (4) sheet physics + map fly-to; (5) time-of-day tint of the map/sheet (reuse `data-tod`); (6) last-train glow on the final departure; (7) number roll-ups for minutes (Skyline in N min, H-1 delay).
- Phase 1b (Oct 18, review fixes): peek line honest (incident first, failed/no-baseline states), scheduled next-train line with station and direction, sheet fixes (click flag, scroll reset, 44 px handle, map cover offset via `coverBottom` on NearbyTransitMap), station not repeated in stop chips. LEFT FOR THE SWITCH PHASE: Sign in / Account, Settings, and the Browse switch (preview has no way back to those yet).
- Phase 2 (Oct 18): `BrowseMap.tsx` (CARTO dark, no popups): layers Stops / Skyline (line in station order + English/Hawaiian labels from zoom 13) / Places (Home, Work); chips along the top edge (`LAYER_CHIPS`, the slot for Traffic / Incidents / Roadwork in Phase 3), choices kept in localStorage `nalu-browse-layers-v1`. Pin → HALF with the matching card (stops/stations scroll to Near you; Home/Work get a place card with Plan trip). "Start from here" on a stop or the station card writes the same saved trip the app writes (`start-trip.ts`) then opens "/". Map pans for the sheet (`coverBottom`), simple eased pan, instant under reduced motion. KNOWN: signed-in riders land on Browse after "Start from here" (landingView rule) and tap Commute; Phase 3 should let index.tsx open the commute view for a pending trip.
- Phase 2b (Oct 18, review fixes): "Start from here" DISABLED in the preview (button, banner and `start-trip.ts` removed): the app has no safe one-off trip origin outside `index.tsx` (the trip setup's start is also what legacy migration can turn into a saved Home). FOR THE SWITCH PHASE: add a real one-off origin to index.tsx (From <stop>, no "To home"), a pending-trip hand-off for signed-in riders, and share `findTripStops`/`saveSetup` (address = destination.address, <150 m "already there", setOverride(null)) as a pure move with a pinning test. Also: bus-stop pins scroll to Nearby stops, crowded pins fan out, Skyline labels sit beside pins, waits over 59 min read "2 hr 1 min", station ids checked against `SKYLINE_STOP_IDS` (warn + test).
- 2026-10-18 Weekly review: mobile-design and transit-accuracy items added above (wording, duplicates, tap targets).
