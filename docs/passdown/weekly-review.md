# Passdown — Weekly Review (Sun 9:47 AM HST) and Repository Steward
Last updated: 2026-10-11 (main session, seeded). Keep ≤ 60 lines; see README.md. Gate and cadence: `docs/agents/run-gates.md`.

## Decisions waiting on Josh
- Supabase Pro ($25/mo: backups + more memory) — deferred for budget; don't push it, mention only if a risk appears.

- Lovable leftovers still in code (sign-in broker fallback, AI/push `LOVABLE_API_KEY` fallbacks, cron-secret fallback): remove once Josh confirms OPENAI_API_KEY, Firebase service account and CRON_SECRET are set in Cloudflare and Lovable is cancelled.

## Open P0/P1
- Skyline "no trip" on first rush-hour try (main session; alerts.md).
- Trip answers take ~12–30 s (planner speed; parked).

## Follow-ups for next Sunday
- First run of the new BUSINESS SNAPSHOT, cost check, feedback and funnel steps (nalu-lead.md).
- First passdown cleanup (README.md, "Cleanup").
- Verify each routine's stored prompt (list_triggers) mentions `run-gates.md`: Watchman trig_01QCwmtYU2ZHYjifd26oYFgG, SEO trig_016zR7zTvdto6qPirJjEVBKb, Premium trig_019g8aU9fGqEwsMhGkDk3nuN, Weekly trig_018WJBnLAGD9BvDv8xDM7qJw (the main session asked each routine's own session to update itself on Oct 11). Any that didn't: report it in one line.
- Check the run gates (`docs/agents/run-gates.md`, new Oct 11) were followed by each scheduled run this week: skipped when nothing was new, ran when there was work. If a routine ignored its gate (its own prompt overrides it), tell Josh which one; the main session can rebuild that routine with the gate built in.

## Last cleanup
- None yet.

## Recent runs (newest first: R+ found/fixed, R0 nothing, S skipped)
- (none yet)
