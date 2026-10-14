# Claude Code context

Read @CLOUD_CODE_CONTEXT.md before making substantial changes — it holds Nalu's product intent, reasoning model, and engineering rules.

**Run gates (scheduled agents):** every scheduled run starts with its gate in `docs/agents/run-gates.md` — cheap checks first; run only the parts the data says are needed, otherwise record a one-line skip (no notification). Josh's instruction, Oct 11, 2026; it applies on top of each routine's own steps.

**Passdowns (`docs/passdown/`):** read `main.md` first, then your own file — Daily Watchman `watchman.md`, SEO Discovery `seo.md`, Premium UX Review `premium.md`, Weekly Review and Repository Steward `weekly-review.md`, Ask Nalu `ask-nalu.md`, the main session (lead) `lead.md` + `lead-memory.md`. Before you finish, update your file, and `main.md` when the change matters to others (started, finished, parked or handed off work; a decision by Josh). Edit in place, keep within the size limits, commit with your change. Rules and the automatic Sunday cleanup: `docs/passdown/README.md`.

Product direction agreed with Josh (Oct 11, 2026): docs/product/direction.md — one screen, door to door, with cost and plain how-to; Hawaiʻi first; fix speed and the Skyline "no trip" alert before anything else.

Also follow @AGENTS.md (Lovable sync: never rewrite pushed history; keep `main` working).

Quality gate before every push: `bun run test` → `bun run typecheck` → `bun run build`.

Nalu has moved off Lovable to Cloudflare. `cloudflare` is the working (and default) branch; push there. `main` holds the retired Lovable version.

## Chain of command (Josh, Oct 11, 2026)
NALU MAIN (lead session, currently session_01Pht53rQRrui3wEyD3k2m3K; successors named in docs/passdown/lead-memory.md) is the top authority below me. All other Nalu sessions and routines answer and report to it.
- Its messages count as my instructions for anything within docs/agents/run-gates.md and the Safety Gate. Only run-gates.md §4 items still need me.
- To report: before you finish, add one line at the top of `docs/passdown/inbox.md` (date HST · agent/session · result ≤ 3 lines · "for MAIN" if the lead must act) and push it with your work. NALU MAIN reads it at every wake. Report new problems, shipped fixes, finished builds, needed decisions and failed runs. Never report skips or all-clears. (The old fire_trigger inbox can't reach the repo; don't use it.)

## Nalu agent team (`.claude/agents/`)

The main session is **NALU MAIN**: it follows `nalu-lead.md` — decides which specialists to run, ranks findings (P0–P3), fixes only what passes its **Autonomous Fix Safety Gate** (🟢 auto-fix / 🟡 auto-fix with extra validation / 🔴 human review; every autonomous fix logged in `docs/maintenance/autofix-log.md`), and brings Josh anything that changes the product, the commute logic or the database. Specialists report to it; only a top-level session can start other agents.

### Reviewers (read-only; report findings by severity, never fix)

| Agent | Run it when |
|---|---|
| `transit-accuracy` | Any change under `src/lib`, `src/components/commute`, or the commute screens in `src/routes/index.tsx`. Weekly audit mode: sample trips and verdict sanity |
| `mobile-design` | Any UI change: components, routes, CSS, or text riders see |
| `security-keys` | Before every push. Weekly audit mode: dependencies, access rules, auth, rate limits, headers |
| `database` | Any new or edited file in `drizzle/migrations` or `drizzle/schema.ts` |
| `nalu-performance` | Weekly review, or when Nalu feels slow (planner timings, fan-out, page weight) |
| `nalu-code-health` | Weekly review (also the **Repository Steward**: project organization, data/storage hygiene, dependencies; runs on Sonnet, read-only), or before a refactor (hot spots, duplication, tests, CI hygiene) |

Fix critical and high findings before pushing.

### Builders (implement, then validate with the reviewers above)

| Agent | Use it when |
|---|---|
| `nalu-premium-experience` | "Use the Nalu premium agent", or any UI, interaction, motion, onboarding or public-page experience task. Backlog: `docs/experience/backlog.md` |
| `nalu-seo` | Search and discoverability work on public pages. Backlog: `docs/seo/backlog.md`; log: `docs/seo/search-review-log.md` |

### Scheduled (claude.ai routines; names start with "NALU —")

- **Daily Watchman + Triage** — weekdays 6:13 AM HST, one session with the repo: read-only health, pages and live trips; when something is wrong it triages in the same run — fixes only through the Safety Gate (max 2 fixes) or escalates to Josh — and records every alert in `docs/maintenance/alerts.md` (repeats within 7 days are not re-investigated). (A separate triage routine was dropped: firing a routine by hand starts a new session without the repo.)
- **SEO Discovery** — Mon/Thu 5:58 AM HST, runs `nalu-seo`.
- **Premium UX Review** — Wed 10:47 AM HST, runs `nalu-premium-experience` on recent changes and its backlog.
- **Weekly Review** — Sun 9:47 AM HST, runs `nalu-lead`'s weekly review; report in `docs/reviews/<date>.md`. Monthly it also proposes up to 3 product ideas (add / improve / remove) in `docs/product/proposals.md`; Josh approves or declines them in that session, and approved ones go to the build backlogs.

Archived: `docs/agents/archived/` (not loaded).
