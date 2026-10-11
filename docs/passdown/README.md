# Passdowns — how they work

The goal is a self-sustaining team: any agent (or a new session) can pick up exactly where the last one left off, and the files never grow without limit.

## The files
| File | Who keeps it | What it holds |
|---|---|---|
| `main.md` | Everyone (main session, build sessions, every agent) | Ground rules, direction, what's in progress and who owns it, parked items, money/infrastructure, agents. |
| `watchman.md` | Daily Watchman + Triage | Known issues being watched, what to re-check next run, last run result. |
| `seo.md` | SEO Discovery (`nalu-seo`) | Current focus, evidence trend, waiting items, next run's plan. |
| `premium.md` | Premium UX Review (`nalu-premium-experience`) | Current focus, open UX threads, season status, next run's plan. |
| `weekly-review.md` | Weekly Review (`nalu-lead`) and the Repository Steward (`nalu-code-health`) | Decisions waiting on Josh, open P0/P1 items, follow-ups for next Sunday, last cleanup. |
| `lead.md` | The main session (NALU MAIN) | Reasoning rules learned from mistakes, delegation pattern, watch list, the weekly lead review. |
| `lead-memory.md` | The main session | Everything the main session knows: Josh, session/routine ids, tools, environment quirks, product and code facts (≤ 150 lines). |
| `ask-nalu.md` | Ask Nalu (Haiku Q&A) — read-only; others keep it | The short "where to look" map for answering Josh's questions. |

Read-only reviewers (transit-accuracy, mobile-design, security-keys, database, nalu-performance) don't keep files; the session that runs them records results.

## When to update
- **Start of a session:** read `main.md`, then your own file.
- **Before finishing:** update your own file if anything changed. Update `main.md` when the change matters to others: work started, finished, parked or handed off; a decision by Josh; a new owner item; a new risk. Commit the passdown with the change it describes.
- **Edit in place.** Replace the line, don't append a history. Done items are deleted (git keeps history; logs keep detail).

## Size limits (keep them small)
- `main.md` ≤ 120 lines; each agent file ≤ 60 lines; one line per item where possible.
- No logs, transcripts, command output or long evidence in passdowns. Link to the log instead.
- Never secrets, keys, personal data or rider feedback text.

## Cleanup (automatic)
**Every Sunday, the Weekly Review:**
1. Prunes every passdown: removes finished items, fixes stale owners/states, enforces the size limits, updates "Last updated".
2. Trims the logs to the last **90 days**, keeping anything still OPEN regardless of age; a removed stretch is replaced by one line, e.g. "Older entries: see git history before <commit>". Logs: `docs/maintenance/alerts.md`, `docs/maintenance/autofix-log.md`, `docs/seo/search-review-log.md`, the Log section of `docs/experience/backlog.md`.
3. Keeps only the last **12** weekly reports in `docs/reviews/` (older ones are deleted; git history keeps them).
4. Records "Last cleanup: <date>" in `weekly-review.md`.

**First Sunday of the month, the Repository Steward (`nalu-code-health`)** also reports the size of `docs/`, the passdowns and the logs, and flags anything over its limit or growing fast.

Cleanup only touches docs; it never deletes code, data or anything still referenced as OPEN.
