# Nalu — main passdown (everyone)

Read first, every session. Rules for keeping it current and small: `docs/passdown/README.md`. Each scheduled agent also has its own file in this folder. Last updated: 2026-10-11 (main session).

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
| Skyline row says "No Skyline trip" on the first rush-hour try (Kapolei → downtown) | Main session; alert in `docs/maintenance/alerts.md` | OPEN since Oct 7. Oct 8 fix 2673c7b live but not the cause. Recorder `scripts/diag/rush-hour-trip-recorder.mjs` runs Mon Oct 12 6:25 AM HST. Candidate guard parked on branch `wip/skyline-row-checking` (unproven, not live). Top priority. |
| Station names in the app (English + Hawaiian smaller/muted underneath) | Session "NALU — Skyline station names in app (Sonnet)"; branch `wip/station-names` | Shipped to `cloudflare` (see git log "Merge station names"); live since e3a3638; Skyline was closed at check time, so the two-line names still need a look on a daytime Skyline trip. Follow-up: guide/SEO pages use the same names (`docs/seo/backlog.md`). |
| Fix plan (Phases 0–5) | `docs/architecture/fix-plan.md` | Approved Oct 11. Phase 0 running (Sonnet "NALU — Phase 0 cleanups"); Phase 1 Mon 6:25 AM; Phase 2 (one server request per trip, Opus) Tue Oct 13. |
| Trust & authority pages (About, How Nalu decides, footer, listings) | After Phase 2 | Moved by Josh's plan approval; Sonnet build + one Opus check of the About page. Brief in `docs/seo/backlog.md`. |

## Parked / waiting
- Planner speed: trips take ~12–30 s; migration 0065 parked (54/60 identical) — `scripts/db-speed/README.md`.
- P-2 items 1 and 3 (live "Right now" card, map on guides): need an Opus session; live card waits for planner speed.
- Bay Area ("Nalu · Bay Area"): plan and data size in `docs/cities/`; `BAY511_API_KEY` exists. Waits for budget and Oʻahu being fast and right.
- Answer-first guide format: SEO agent, after the build queue.

## Money and infrastructure
- Supabase **Free** plan (shared CPU, 500 MB RAM, 500 MB DB, 5 GB egress, **no backups**). Pro ($25/mo) deferred by Josh — no spending until he says so.
- Owner items: Cloudflare WAF rate limit on `/_serverFn/`; AirNow key likely wrong; optional `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` for the cost check.

## Agents and sessions
- Routines (CLAUDE.md): Daily Watchman + Triage (weekdays 6:13 AM HST), SEO Discovery (Mon/Thu), Premium UX Review (Wed), Weekly Review (Sun), monthly AI-visibility reminder for Josh.
- "NALU — Ask Nalu (Haiku, questions only)": Josh's cheap Q&A session; read-only. It answers from this file and the docs below.
- Main session (NALU MAIN, Opus): decisions, hard fixes, hand-offs.

## Where things are recorded
Alerts `docs/maintenance/alerts.md` · autonomous fixes `docs/maintenance/autofix-log.md` · weekly reports `docs/reviews/` · UX backlog `docs/experience/backlog.md` · SEO backlog/log `docs/seo/` · proposals `docs/product/proposals.md` · service limits `docs/maintenance/service-limits.md` · cities `docs/cities/`.
