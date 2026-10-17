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
- **Main session:** NALU — MAIN COMMAND (4) = session_01RaHbdcHV5NWx2c4yog64Z9 (since Oct 15 HST; wakes on it: trig_01SJgjnkiLDSVA98wSmmkhvh Sun 11:31 AM lead review, trig_01WomGiSHPk4McDZEFr4gAEp Wed 1:59 PM lead check). (3) session_01JUpKU1VHoS7rkFjoAghuEG handed over Oct 15 at Josh's request; (2) session_01Pht53rQRrui3wEyD3k2m3K; (1) archived. The fire_trigger inbox (trig_018dVqisHDihRPYq9mBE1qtP) is DISABLED: agents write their own line at the top of docs/passdown/inbox.md (CLAUDE.md).
- The main session's own reminders (lead checks, Phase 1/2 triggers) move with the main session at each handover.

- Oct 15 (MAIN 4): Josh-requested guide redesign DONE — all 11 guides + hub live in the glow-card look (Skyline map component, strips, option cards), each batch reviewed by transit-accuracy/mobile-design/security-keys; head/FAQ unchanged. Promo video v1 (Leave-now, Drive only) in scratchpad; v2 needs a daytime re-record (Arrive by can't plan tomorrow). Startup credits: run 3 done, queue waits on Josh.

- Oct 16–17 (MAIN 4): wife's Oct 16 commute (H-1 E accident) → nav fixes LIVE 75717bb (reroute stale bearing, maneuver passing, start grace/poor-GPS escape; local wording I-H1→H-1, HUD direction label, Salt Lake/18B landmark labels; accident alerts what+where once per id, opposite-carriageway filter fails open). All reviewers OK. UNVERIFIED: TomTom incidents `id` field with a live incident (if incidents vanish, check fields first); check her Monday drive log in debug_logs.

## Josh's tools — verdicts (Oct 15, MAIN (4))
No claude.ai plugins enabled (ListPlugins empty; ~/.claude/plugins empty). Nothing installed or enabled; no paid generations run.
- Useful now: GitHub (PRs, CI, checks); Gmail (startup-credits drafts and notices — drafts only, Josh sends); built-in code-review / security-review / simplify (extra pass before risky pushes; our reviewers stay primary); run (launch the app to check a change); deep-research (credits eligibility questions only, it fans out subagents — rare).
- Useful later: Chrome / built-in browser / computer-use (Josh's signed-in Search Console, Cloudflare, Supabase dashboards and credit forms — needs his desktop app); Claude Docs + pdf/pptx (one-pager or deck if a credits program asks); Google Calendar (deadline reminders, e.g. Oct 22 Google follow-up); ElevenLabs creative (voiceover for a demo video — paid); skill-creator (package the live trip check / quality gate); dataviz + artifacts (business snapshot page); session-start-hook (bun install hook for cloud sessions — none yet); Google Drive (not connected; only if paperwork moves there).
- Not useful: Floot (other hosting platform; Nalu is on Cloudflare); ElevenLabs Agents (phone/voice bots, out of scope); Expedia; Hugging Face (not connected); google-workspace, docx, xlsx; import-memory, morning, learn; loop (we use scheduled tasks).

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
- State at the Oct 15 hand-over (carried over from Oct 14; plus: Gmail says Supabase project ridewithnalu-42d6da was paused Oct 11 — likely the old Lovable project, live is nsoameosqsnumjivkmyv; confirm at next check):
  - LIVE: Phase 2 (one server request per trip); the Skyline 8-option-cap fix (916b4e2, ae30373; alert CLOSED Oct 14 after the rush-hour Watchman); the Lovable cleanup; motion M1–M18; the new home page (8e78842; /welcome-classic is removable on/after Oct 21); Browse and the commute page in the new look; the commute-page fixes after Josh's feedback (rain removed, top band fixed, traffic bar kept).
  - OPEN / for MAIN: (a) Airport→Waikīkī showed Drive and Skyline "Can't check … right now" on Oct 14 (inbox line); check whether it repeats. (b) CRON_SECRET match after the Lovable cleanup is unverified (leave-alert cron). (c) Phase 3 split paused at 4,492 lines; resume when the budget allows. (d) Dependency upgrade pass. (e) Arrive By with a car: Workers CPU read. (f) A Halloween seasonal motif was added by the Premium routine (e0e7333): check that Josh is OK with it, since visual changes need a preview first.
  - Budget: the 7-day limit has been in the warning zone since Oct 14 and resets Tue Oct 20 ~1 PM HST. Use Sonnet, one build at a time.
  - Josh's standing rules this week: organic SEO only (no pitching, listings or Reddit); fix forward; no walking or parking estimates; no auto-open of a saved commute; leave-by alerts undecided; preview link + Josh's approval before any main-screen visual change; animations must never cover content or lag.
- State at the Oct 15 hand-over (adds to Oct 14 above; Oct 14 items a–f still open unless noted):
  - LIVE Oct 15: live-nav top cards clear the iPhone status bar/Dynamic Island (safe-area); alerts question also shows on first open of the installed app; blocked-notifications help dialog (src/components/NotificationHelp.tsx: numbered steps, drawn iOS Settings row, Check again). Web apps cannot open iPhone Settings (Apple) — told Josh.
  - LIVE Oct 15, UNTESTED on a phone: Google sign-in via Google Identity Services on ridenalu.com (src/lib/social-sign-in.ts; falls back to the old Supabase redirect). Josh added https://ridenalu.com as JS origin. security-keys: no critical/high. NEXT: Josh tests in Safari + Home Screen app; if Google shows ridenalu.com, tell him to remove the supabase.co entry/redirect only if the fallback is no longer needed (keep it while fallback exists) and submit Google brand verification (Branding: Nalu, logo, /privacy, /terms, domain ridenalu.com).
  - Startup-credits campaign (Josh's prompt; agents on Sonnet): docs/business/startup-credits/ (tracker, FOUNDER_APPROVAL_QUEUE.md, PACKETS.md). Google for Startups: Josh emailed Oct 15, auto-ack only, follow up Oct 22. Cloudflare inquiry is a Gmail DRAFT for Josh to send; Supabase via web form supabase.com/partners. Open asks to Josh: Nalu start month/year; paid Google Workspace in last 31 days; card on Cloudflare (domain bought Oct 4, so likely on file). Anthropic program closed; AWS/Microsoft rejected (migration).
  - Email: hello@ridenalu.com forwards to Josh's Gmail (jreverio01@gmail.com). Gmail + Google Calendar connectors exist. The auto-mode classifier BLOCKS agents sending email on Josh's behalf even with his chat approval → use Gmail drafts; Josh taps Send. Sending as hello@: Gmail "Send mail as" + Resend SMTP (pending Josh).
  - Connectors (Oct 15): Gmail, Google Calendar (useful); Google Drive (not signed in; useful for reports); ElevenLabs x2 (park; paid voice); Floot (not useful — suggest removal); Expedia, Hugging Face (not useful now). Plugins were not visible to (3); (4) to audit.
  - Paused Supabase project "ridewithnalu-42d6da" (emails Oct 10–11) is NOT production; live project nsoameosqsnumjivkmyv "NEW NALU" healthy.
