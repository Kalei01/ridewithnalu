# Lead memory — everything the main session knew (handover Oct 11, 2026)

The full working memory of NALU MAIN COMMAND (1), written before it was archived. The next main session reads this with `lead.md` and `main.md`. Keep it current; fold stale facts away (≤ 150 lines).

## Josh
- Local to Oʻahu; built Nalu mostly for his wife (her Kapolei → downtown commute). Not a developer. Was in San Francisco Oct 2026 (Union Square Hilton); Benicia trip story drives the product direction.
- Wants: perfection with minimum credit cost; self-sustaining team; plain English; real evidence; few questions ("unless I ask"). "One at a time." "Professional and full, not half-assed." Brand stays "Nalu".
- Budget: no spending now (Supabase Free; Pro deferred). Claude plan has a weekly limit (Oct 11: 65% used; resets Tue 1:00 PM HST / 4:00 PM PT) and a 5-hour window. He can send a screenshot of Settings → Usage; agents can only see "allowed / warning" via get_session.rate_limit_info.
- Doesn't want: gas calculators, household features, turn-by-turn, competing with Google/Apple Maps, posting on Reddit.
- Authorizations: standing DB authorization (low/medium risk, additive, reviewed, rollback, off-peak, logged) in `.claude/agents/nalu-lead.md`. On Oct 8 he also said in chat that low/medium-risk data deletes/edits and dropping tables/columns are OK; writing that into nalu-lead.md was blocked by the safety classifier, so agents must NOT rely on it unless Josh adds it to that file himself.

## Sessions and routines (ids)
| What | Session | Routine |
|---|---|---|
| Daily Watchman + Triage (weekdays 6:13 AM HST) | session_01TJ7WDquPEP65LxzQjWqgik | trig_01QCwmtYU2ZHYjifd26oYFgG |
| SEO Discovery (Mon/Thu 5:58 AM) — DISABLED for Mon Oct 12 by Josh; re-enable Tue | session_01BG5hLoo9ouvcMu3fp3NuNN | trig_016zR7zTvdto6qPirJjEVBKb |
| Premium UX Review (Wed 10:47 AM) | session_019KNNRgXASyVD5M3m2Mej5p | trig_019g8aU9fGqEwsMhGkDk3nuN |
| Weekly Review (Sun 9:47 AM) | session_01TwJBnK8b32BJpuhkQjC2CA | trig_018WJBnLAGD9BvDv8xDM7qJw |
| Monthly AI-visibility reminder (1st, 9:51 AM) | fresh session each time | trig_01DpgFyMbUyJx3ZaZcgQbn1j |
| Old SEO routine, paused — never delete (deleting a routine deletes sessions it started, incl. the SEO session) | — | trig_01G52vVGE2zPsacpy4hddJzs |
| Ask Nalu (Haiku, Josh's Q&A, read-only) | session_01AF2Z9Cn94gfyTG3Me8jHYN | — |
| Phase 0 cleanups + Tell Nalu form polish (Sonnet, running Oct 11) | session_01ULFH1z7nveUdq7axXkUNbS | — |
- Routine prompts can only be edited from their own session, and those sessions refuse relayed requests. On Oct 11 the main session asked all four to adopt run-gates.md; Watchman refused (needs Josh in that session); Josh was asked to say "yes, apply the update the main session sent" in each.
- **Main session:** NALU — MAIN COMMAND (2) = session_01Pht53rQRrui3wEyD3k2m3K (since Oct 11; MAIN COMMAND (1) session_01VkT4J3Kp6U6g2PxgYtYUw1 archived). Its wakes: trig_01E4pmLyqxrt9fqWKRf4qBHf (Mon Oct 12 6:25 AM Phase 1 hand-off), trig_01RTtwEGPEoDq4tt5VA1BxAR (Tue Oct 13 1:10 PM Phase 2 start + SEO re-enable), trig_01ESFSu9fHPPHNRNgi2dxQvy (Sun 11:31 AM lead review), trig_01L9SMEkAF5beKCfitPYLDVi (Wed 1:59 PM lead check). Inbox (agents report here, no schedule): trig_018dVqisHDihRPYq9mBE1qtP.
- The main session's own reminders (lead checks, Phase 1/2 triggers) move with the main session at each handover.

## Environment and tools
- Repo Kalei01/ridewithnalu; branch `cloudflare` deploys to ridenalu.com in ~1 min; check `https://ridenalu.com/api/public/version`. `main` = retired Lovable version.
- Supabase project `nsoameosqsnumjivkmyv` (Free; Postgres 17; us-west-2). `SUPABASE_ACCESS_TOKEN` in the environment. Read: `node scripts/ops/db-read.mjs "<sql>"`. Write (authorized changes only): `node scripts/ops/db-write.mjs file.sql`. Safe write test trick: DO block that RAISEs at the end (rolls back). pg_stat_statements lives in schema `extensions`.
- Playwright: /opt/node22/lib/node_modules/playwright/index.mjs, Chromium /opt/pw-browsers/chromium, proxy process.env.HTTPS_PROXY, arg `--ignore-certificate-errors-spki-list=PS48cX347wDVcRynzq+DFqswl2PLNE1sG6uQvxMCOS0=`; localStorage `nalu-welcome-seen-v1=1`; click /Include driving/i on the trip question. Live check: `node scripts/ops/live-trip-check.mjs`; rush-hour recorder: `node scripts/diag/rush-hour-trip-recorder.mjs`.
- Automated browsers are excluded from the funnel; debug_logs aren't uploaded for them (no server-side trace of Watchman runs).
- Env secrets added mid-session only reach NEW sessions. `BAY511_API_KEY` exists (Claude env + Cloudflare).
- Reddit API is gated (Responsible Builder Policy) → research via Google `site:reddit.com` only.
- Model prices (per MTok in/out): Opus 5.5 $4/$20, Sonnet 5.5 $2/$10, Haiku 5.5 $0.10/$0.50; cache reads $0.20 (Opus/Sonnet). Opus "low effort" is NOT cheaper than Sonnet per task.
- Safety classifier blocks: agents widening their own permissions ([Self-Modification]), CI bypasses, some chained commands — split commands, don't retry blocked self-permission edits.

## Product and code facts
- Nalu: Drive (TomTom live) vs Skyline vs TheBus with a pick; park-and-ride (4 lots: Keoneʻae, Honouliuli, Hālawa, Kahauiki) and drop-off; trip access question; Arrive by/Leave now; HDOT closures; weather/air; live bus arrivals; leave-by push alerts; feedback box (P-4, table rider_feedback, migration 0066 applied); funnel (0064); business snapshot/cost check (P-3/P-5).
- Planner = SQL functions (plan_transit_general, plan_outbound, plan_bus_direct, …) called from the browser via supabase.rpc, 10+ calls per trip, 12–30 s. Migration 0065 (plan_outbound_multi) parked: 54/60 identical. `src/routes/index.tsx` ≈ 6,000 lines. Oʻahu hard-coded in ~70 files; `src/lib/region.ts` has a dev-only SF region.
- Skyline "no trip" (OPEN): first rush-hour try only; Oct 8 fix 2673c7b (later trains in traffic; "can't check" when live traffic missing) kept but not the cause; off-peak recording: Skyline searches take ~12 s yet Oct 9 rows were "done" at 11.2 s; slow-station-list theory disproved; candidate guard parked on branch `wip/skyline-row-checking`.
- Station names live (English, Hawaiian smaller underneath): src/lib/rail/station-names.ts; withStation() avoids "(…) Station".
- Bay Area: 511 data ≈ 390 MB (8 agencies) → Supabase Small (~$15/mo) when budget allows; plan in docs/cities/.
- Supabase Free: shared CPU, 500 MB RAM, 500 MB DB, 5 GB egress, no backups.

## Open owner items (remind only in the Sunday report)
Cloudflare WAF rate limit on /_serverFn/; AirNow key likely wrong; optional CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID; one-line "yes" in each routine session for the gate update; Pro plan when budget allows.
- Josh, Oct 13: (1) organic traffic only. He won't pitch, do outreach, submit listings or post on Reddit; never ask. (2) Fix forward: every change is an update, and we revert only if absolutely necessary (riders broken, no quick forward fix).
