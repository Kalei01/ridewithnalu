# Passdown — Weekly Review (Sun 9:47 AM HST) and Repository Steward
Last updated: 2026-10-11 (weekly review). Keep ≤ 60 lines; see README.md. Gate and cadence: `docs/agents/run-gates.md`.

## Decisions waiting on Josh
- Supabase Pro ($25/mo: backups + more memory) — deferred for budget; don't push it, mention only if a risk appears.

- Lovable leftovers still in code (sign-in broker fallback, AI/push `LOVABLE_API_KEY` fallbacks, cron-secret fallback): remove once Josh confirms OPENAI_API_KEY, Firebase service account and CRON_SECRET are set in Cloudflare and Lovable is cancelled.

## Open P0/P1
- Skyline "no trip" on first rush-hour try (main session; alerts.md).
- Trip answers take ~12–30 s (planner speed; parked).

## Follow-ups for next Sunday
- BUSINESS SNAPSHOT: `usage_stats()`/`funnel_stats()` returned permission denied for the read-only token and `weekly_by_ref()` doesn't exist (Oct 11) — ask Josh once; re-check next Sunday. Cost check ran fine.
- Routine prompts verified Oct 11: Watchman, Premium, Weekly, SEO all mention run-gates.md.
- Check the run gates (`docs/agents/run-gates.md`, new Oct 11) were followed by each scheduled run this week: skipped when nothing was new, ran when there was work. If a routine ignored its gate (its own prompt overrides it), tell Josh which one; the main session can rebuild that routine with the gate built in.

## Last cleanup
- 2026-10-11: nothing to trim (logs under 55 lines and under 90 days; no older reports).

## Recent runs (newest first: R+ found/fixed, R0 nothing, S skipped)
- 2026-10-11 R+ (5 specialists ran; no fixes; 4 escalated; report docs/reviews/2026-10-11.md)
- Also watch: health `drive times (TomTom)` showed `ok:false` Oct 11 (cached); check it cleared. `bun audit` 19 advisories (build-time mostly): one reviewed upgrade pass after Phase 2.
