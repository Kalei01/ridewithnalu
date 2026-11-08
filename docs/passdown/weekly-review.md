# Passdown — Weekly Review (Sun 9:47 AM HST) and Repository Steward
Last updated: 2026-11-08 (weekly review). Keep ≤ 60 lines; see README.md. Gate and cadence: `docs/agents/run-gates.md`.

## Decisions waiting on Josh
- Supabase Pro ($25/mo: backups + more memory) — deferred for budget; don't push it, mention only if a risk appears.

## Open P0/P1
- Timetable ends Dec 5 (27 days); TheBus feed still last-modified Jul 24. Check the file's Last-Modified each Sunday (Nov 15, 22, 29); tell Josh if still Jul 24 at Nov 29. Refresh workflow itself works (import_log).
- Mapbox drive time shown as "Confident call"/"Moving steady"/"Easy drive" with no baseline or incident data (drive.functions.ts:571, index.tsx ~3590). 🔴 queued with MAIN, unfixed since Oct 25. Matters only while TomTom is refused (flapped Oct 21–Nov 4).
- Planner database time still the speed limit (0065 parked); Arrive By with a car on the phone path.

## Follow-ups for next Sunday
- Scheduled runs arrive late or not at all (Nov 1 weekly trigger reached the session a week late; Watchman Nov 2 two days late; no SEO run logged Nov 2). Ask MAIN whether routines need rebuilding. The Nov 1 first-Sunday slice (specialist audits, product ideas) never ran; do the monthly items next first Sunday (Dec 6) or sooner if code moves.
- Overdue removals: `/welcome-classic` + `/home-preview` (Premium routine paused); prune `docs/experience` (23 MB); dependency pass (audit 18 on Nov 8).
- Verify Mapbox `depart_at` handling and the HDOT "Full closure" match (2026-10-25 report) once code moves again.
- BUSINESS SNAPSHOT: weekly users 17 vs 23 (Nov 8); no trips tried in the funnel this week.

## Last cleanup
- 2026-11-08: nothing to trim (all passdowns and logs within limits and dated within 90 days; 4 reports). docs/experience 23 MB (Josh to say if finished screenshots can go).

## Recent runs (newest first: R+ found/fixed, R0 nothing, S skipped)
- 2026-11-08 R0 (quiet week: 0 code commits since Oct 25; no specialists; own checks only; report docs/reviews/2026-11-08.md)
- 2026-10-25 R+ (5 specialists ran; 1 🟢 docs fix; 3 escalated; report docs/reviews/2026-10-25.md)
- 2026-10-18 R+ (5 specialists ran; 0 fixes; 2 escalated; report docs/reviews/2026-10-18.md)
- 2026-10-11 R+ (5 specialists ran; no fixes; 4 escalated; report docs/reviews/2026-10-11.md)
