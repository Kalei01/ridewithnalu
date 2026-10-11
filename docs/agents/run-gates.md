# Run gates — does this agent need to run today? (Josh, Oct 11, 2026)

Josh's instruction: scheduled agents run only when the data says there's work. Each run starts with its gate: a few cheap checks (git log, passdowns, alerts, one script) — **no browsers, no reviewers, no subagents until the gate says RUN**. Decide from evidence, not habit.

If the gate says **SKIP**:
- Change nothing except one line in your passdown ("Last run: <date> skipped — <reason>"), committed and pushed.
- No phone notification (a skip isn't news). Final message: `SKIPPED: <reason>`.
- Never skip twice in a row past the limit below, so nothing goes stale.

If the gate says **RUN**: do the normal run, but only the parts the gate found work for.

## Daily Watchman + Triage (weekdays)
Safety check — the cheap parts always run.
- **Always:** the health endpoint and the page check (Part A steps 1–2; no browser).
- **Live trips (Part A step 3, browser):** run if any of: an OPEN alert in `docs/maintenance/alerts.md`; any commit to `cloudflare` since the last run; health shows a failure or the planner over 6000 ms; it's Monday; or the last browser run was 3+ weekdays ago. Otherwise skip the trips and say so.
- **Triage:** only when something was flagged (as today).

## SEO Discovery (Mon/Thu)
RUN if any of:
- Search Console has meaningfully new data since the last log entry (`bun scripts/gsc-report.mts`): impressions or clicks up by 25%+ or by 20+, a new query, or a page's index status changed.
- An actionable TODO in `docs/seo/backlog.md` or `docs/passdown/seo.md` is unblocked (e.g. app station names live → guides to update; the build queue cleared → answer-first format).
- A standing date check is due (backlog "Standing date checks").
- Josh logged something in `docs/seo/ai-visibility.md`.
Otherwise SKIP. Limit: at least one full run every 14 days.

## Premium UX Review (Wed)
RUN if any of:
- Commits touching what riders see (`src/routes`, `src/components`, CSS, rider wording in `src/lib`) since the last review's log entry.
- An APPROVED or TODO item in `docs/experience/backlog.md` / `docs/passdown/premium.md` that it may build and that isn't owned by another session.
- A season in `docs/experience/seasonal.md` starts within 4 weeks and isn't prepared.
Otherwise SKIP. Limit: at least one full run every 14 days.

## Weekly Review (Sun)
Always runs (it owns the passdown cleanup and the weekly report), but specialists only when needed:
- `transit-accuracy`: if commute logic/wording changed this week, or monthly.
- `security-keys`: if any code or dependency changed this week, or monthly.
- `nalu-performance`: if planner/data code changed or the Watchman flagged slowness this week.
- `nalu-code-health` (steward): first Sunday of the month, or 20+ commits this week.
- `mobile-design`: if rider-facing UI changed this week.
- Product proposals: first Sunday of the month only (as today).
A quiet week = short report, cleanup, no specialists. Say which specialists were skipped and why.

## On-demand sessions (build, Ask Nalu)
Not scheduled — they run when Josh or the main session starts them. Build sessions use the cheapest model that's safe (fix plan: `docs/architecture/fix-plan.md`).
