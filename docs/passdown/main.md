# Nalu — main passdown (everyone)

Read first, every session. Rules for keeping it current and small: `docs/passdown/README.md`. Each scheduled agent also has its own file in this folder. Last updated: 2026-10-14 (Lovable cleanup).

## Owner and ground rules
- Josh, not a developer: plain English, real evidence only, never invent numbers.
- Never ask for, print or commit keys/passwords. Never rewrite pushed history.
- Quality gate before every push, under `set -e`: `bun run typecheck` (exit 0) → `bun run test` → `bun run build` → lint touched files → reviewers (CLAUDE.md) → live check.
- One build at a time; "professional and full, not half-assed". Usage is limited: Sonnet for routine/builds, Haiku for Q&A, Opus only for hard one-offs.
- Database changes: the standing authorization in `.claude/agents/nalu-lead.md` (additive, reviewed, rollback written, off-peak, logged).

## Direction
- `docs/product/direction.md`: one screen, door to door, options with cost, a pick with one reason, plain how-to in rider names. **Hawaiʻi first.** Order: (1) fast and right, (2) cost line, (3) plain how-to, (4) first/last stretch. Out of scope: gas calculators, household features, turn-by-turn.
- Skyline station names (confirmed): English first, Hawaiian second, full names — table in direction.md.

## In progress (who owns it)
| Item | Owner / where | State |
|---|---|---|
| Drive ETA looks ~10 min long (Josh, Mon Oct 12: Nalu 43 vs Google/Apple 31–33) | Closed (finding only) | NO bug. Live 7:23 AM HST Home→Merchant St: 41 min live / 43 typical, 34.2 km, normal Fort Weaver→H-1 East→Nimitz route, no padding, no heading sent; TomTom's own estimate is just higher than Google's. Josh trimmed scope: no alert, no options, no Tuesday repeats. No code changed. Re-check script: `scripts/diag/drive-eta-check.mjs`. |
| Skyline row says "No Skyline trip" on the first rush-hour try (Kapolei → downtown) | Watchman confirms; alert in `docs/maintenance/alerts.md` | OPEN since Oct 7, good mornings Oct 12–13. Phase 2 live Oct 13 (a stuck search now always says "Can't check"). Close after the server path passes a weekday rush-hour first try. Parked guard branch `wip/skyline-row-checking` no longer needed. |
| Station names in the app (English + Hawaiian smaller/muted underneath) | Session "NALU — Skyline station names in app (Sonnet)"; branch `wip/station-names` | Shipped to `cloudflare` (see git log "Merge station names"); live since e3a3638; Skyline was closed at check time, so the two-line names still need a look on a daytime Skyline trip. Follow-up: guide/SEO pages use the same names (`docs/seo/backlog.md`). |
| Fix plan (Phases 0–5) | `docs/architecture/fix-plan.md` | Approved Oct 11. Phase 0 DONE Oct 11 (f6f9204: combined search off; 2b0ecfd: Lovable no-ops removed; left for Josh: Lovable fallbacks in `docs/maintenance/autofix-log.md`); Phase 1 DONE Oct 12 (recording, no repro; fold into Phase 2); Phase 2 LIVE Oct 13 (e9daeec, switch ON; result + follow-ups in fix-plan.md). Lovable cleanup DONE Oct 14. Next: Phase 3 (split index.tsx). |
| Trust & authority pages (About, How Nalu decides, footer, listings) | After Phase 2 | Moved by Josh's plan approval; Sonnet build + one Opus check of the About page. Brief in `docs/seo/backlog.md`. |

## Parked / waiting
- Planner speed: Phase 2 cut rows-ready (Kapolei midday 5–10 s → 3.6–4.6 s); the database itself is still the limit at rush hour. Migration 0065 parked (54/60 identical) — `scripts/db-speed/README.md`. Arrive By with a car still on the phone until its Workers CPU time is read (`fix-plan.md`).
- P-2 items 1 and 3 (live "Right now" card, map on guides): need an Opus session; live card waits for planner speed.
- Bay Area ("Nalu · Bay Area"): plan and data size in `docs/cities/`; `BAY511_API_KEY` exists. Waits for budget and Oʻahu being fast and right.
- Answer-first guide format: SEO agent, after the build queue.

## Money and infrastructure
- Supabase **Free** plan (shared CPU, 500 MB RAM, 500 MB DB, 5 GB egress, **no backups**). Pro ($25/mo) deferred by Josh — no spending until he says so.
- Owner items: Cloudflare WAF rate limit on `/_serverFn/`; AirNow key likely wrong; optional `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` for the cost check.

## Agents and sessions
- Routines (CLAUDE.md): Daily Watchman + Triage (weekdays 6:13 AM HST), SEO Discovery (Mon/Thu), Premium UX Review (Wed), Weekly Review (Sun), monthly AI-visibility reminder for Josh.
- "NALU — Ask Nalu (Haiku, questions only)": Josh's cheap Q&A session; read-only. It answers from this file and the docs below.
- Main session: **NALU — MAIN COMMAND (2)** (Opus; since Oct 11, replacing (1), archived). Decisions, leading the agents, hand-offs; memory in `lead.md` + `lead-memory.md`.

## Where things are recorded
Alerts `docs/maintenance/alerts.md` · autonomous fixes `docs/maintenance/autofix-log.md` · weekly reports `docs/reviews/` · UX backlog `docs/experience/backlog.md` · SEO backlog/log `docs/seo/` · proposals `docs/product/proposals.md` · service limits `docs/maintenance/service-limits.md` · cities `docs/cities/`.
- Oct 13 ~2:30 PM HST: Phase 2 FINISHED and live (e9daeec; rollback `SERVER_TRIP_PLAN = false` in src/lib/trip-plan-client.ts). SEO routine re-enabled (next Thu 5:58 AM).
- Oct 14: Lovable leftovers removed in one cleanup (sign-in broker, LOVABLE_* fallbacks, previewAuthStorage, `.lovable/`, bunfig excludes). Kept: build wrapper, `VITE_LOVABLE_CONNECTOR_*` env names, AGENTS.md. Business stats grant: Josh is granting EXECUTE on usage_stats()/funnel_stats().
- Oct 13 (lead) build queue after Phase 2, one at a time: (1) Lovable cleanup DONE Oct 14; (2) dependency upgrade pass (Sonnet, security-keys); (3) Phase 3 split of src/routes/index.tsx, one area per session; (4) Arrive By with car: Workers CPU read. SEO pass items 7–11 run in the SEO routine from Thu (1–2 per run). Stats access granted by Josh, verified Oct 13.
