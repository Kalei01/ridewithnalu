# Passdown — Weekly Review (Sun 9:47 AM HST) and Repository Steward
Last updated: 2026-10-25 (weekly review). Keep ≤ 60 lines; see README.md. Gate and cadence: `docs/agents/run-gates.md`.

## Decisions waiting on Josh
- Supabase Pro ($25/mo: backups + more memory) — deferred for budget; don't push it, mention only if a risk appears.

## Open P0/P1
- Mapbox drive time shown with "Confident call" / "Moving steady" / "Easy drive" and no usual-time baseline or incident data (drive.functions.ts:571, index.tsx ~3590). 🔴, queued with MAIN. Live until TomTom's quota resets.
- TomTom free quota exhausted Oct 21; Mapbox fallback live. Recurrence risk until a full month proves the usage cuts.
- Planner database time still the speed limit (0065 parked); `plan_transit_general` max 63 s (check statement timeout); Arrive By with a car still on the phone path.

## Follow-ups for next Sunday
- Overdue removal: `/welcome-classic` + `/home-preview` (Premium owns; due Oct 21). Prune finished screenshots in `docs/experience` (23 MB). Another dependency pass (audit 18 on Oct 25).
- BUSINESS SNAPSHOT: weekly users 114 → 30 → 11 (Oct 25); funnel recording checked Oct 18 (no bug). Re-read next Sunday; separate the Oct 14 Home switch from the Oct 21 drive outage if it keeps falling.
- Verify Mapbox `depart_at` handling and the HDOT "Full closure" match (see 2026-10-25 report) were handled.
- Check the run gates (`docs/agents/run-gates.md`, new Oct 11) were followed by each scheduled run this week: skipped when nothing was new, ran when there was work. If a routine ignored its gate (its own prompt overrides it), tell Josh which one; the main session can rebuild that routine with the gate built in.

## Last cleanup
- 2026-10-25: alerts.md repaired (doubled by 1c391d3, 191 → 98 lines); premium.md trimmed to 59; logs under 90 days; 3 reports. docs/experience 23 MB (Josh to say if finished screenshots can go).

## Recent runs (newest first: R+ found/fixed, R0 nothing, S skipped)
- 2026-10-25 R+ (5 specialists ran; 1 🟢 docs fix; 3 escalated; report docs/reviews/2026-10-25.md)
- 2026-10-18 R+ (5 specialists ran; 0 fixes; 2 escalated; report docs/reviews/2026-10-18.md)
- 2026-10-11 R+ (5 specialists ran; no fixes; 4 escalated; report docs/reviews/2026-10-11.md)
