# Passdown — Weekly Review (Sun 9:47 AM HST) and Repository Steward
Last updated: 2026-10-18 (weekly review). Keep ≤ 60 lines; see README.md. Gate and cadence: `docs/agents/run-gates.md`.

## Decisions waiting on Josh
- Supabase Pro ($25/mo: backups + more memory) — deferred for budget; don't push it, mention only if a risk appears.

## Open P0/P1
- Dependency upgrade pass overdue: 19 `bun audit` advisories (2 critical, seroval via @tanstack/router-core likely runtime). Queued as build step (2) in main.md; 🔴 for the lead.
- Planner database time is still the speed limit (0065 parked, 54/60 identical); Arrive By with a car still on the phone path.

## Follow-ups for next Sunday
- Tidy `.claude/agents/security-keys.md:16,31` (names LOVABLE_* secrets) after checking the real names in code. Remove `/welcome-classic` + `/home-preview` Oct 21 (Premium owns).
- BUSINESS SNAPSHOT works now (stats granted). Oct 18: 27 weekly users vs 114 — check that the new Home (live Oct 14) still records visits (landed_intro 24 vs landed_app 5). Re-read next Sunday.
- Check the run gates (`docs/agents/run-gates.md`, new Oct 11) were followed by each scheduled run this week: skipped when nothing was new, ran when there was work. If a routine ignored its gate (its own prompt overrides it), tell Josh which one; the main session can rebuild that routine with the gate built in.

## Last cleanup
- 2026-10-18: nothing to trim (all passdowns within limits, logs under 90 days, 2 reports). docs/experience is 22 MB of screenshots — Premium to prune finished review PNGs.

## Recent runs (newest first: R+ found/fixed, R0 nothing, S skipped)
- 2026-10-18 R+ (5 specialists ran; 0 fixes; 2 escalated; report docs/reviews/2026-10-18.md)
- 2026-10-11 R+ (5 specialists ran; no fixes; 4 escalated; report docs/reviews/2026-10-11.md)
