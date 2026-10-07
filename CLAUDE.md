# Claude Code context

Read @CLOUD_CODE_CONTEXT.md before making substantial changes — it holds Nalu's product intent, reasoning model, and engineering rules.

Also follow @AGENTS.md (Lovable sync: never rewrite pushed history; keep `main` working).

Quality gate before every push: `bun run test` → `bun run typecheck` → `bun run build`.

Nalu has moved off Lovable to Cloudflare. `cloudflare` is the working (and default) branch; push there. `main` holds the retired Lovable version.

## Nalu agent team (`.claude/agents/`)

The main session is **NALU MAIN**: it follows `nalu-lead.md` — decides which specialists to run, ranks findings (P0–P3), fixes only low-risk, validated things automatically, and brings Josh anything that changes the product, the commute logic or the database. Specialists report to it; only a top-level session can start other agents.

### Reviewers (read-only; report findings by severity, never fix)

| Agent | Run it when |
|---|---|
| `transit-accuracy` | Any change under `src/lib`, `src/components/commute`, or the commute screens in `src/routes/index.tsx`. Weekly audit mode: sample trips and verdict sanity |
| `mobile-design` | Any UI change: components, routes, CSS, or text riders see |
| `security-keys` | Before every push. Weekly audit mode: dependencies, access rules, auth, rate limits, headers |
| `database` | Any new or edited file in `drizzle/migrations` or `drizzle/schema.ts` |
| `nalu-performance` | Weekly review, or when Nalu feels slow (planner timings, fan-out, page weight) |
| `nalu-code-health` | Weekly review, or before a refactor (hot spots, duplication, tests, CI hygiene) |

Fix critical and high findings before pushing.

### Builders (implement, then validate with the reviewers above)

| Agent | Use it when |
|---|---|
| `nalu-premium-experience` | "Use the Nalu premium agent", or any UI, interaction, motion, onboarding or public-page experience task. Backlog: `docs/experience/backlog.md` |
| `nalu-seo` | Search and discoverability work on public pages. Backlog: `docs/seo/backlog.md`; log: `docs/seo/search-review-log.md` |

### Scheduled (claude.ai routines; names start with "NALU —")

- **Daily Watchman** — weekdays 6:13 AM HST, read-only health, pages and live trips; alerts only when something is wrong.
- **SEO Discovery** — Mon/Thu 5:58 AM HST, runs `nalu-seo`.
- **Premium UX Review** — Wed 10:47 AM HST, runs `nalu-premium-experience` on recent changes and its backlog.
- **Weekly Review** — Sun 9:47 AM HST, runs `nalu-lead`'s weekly review; report in `docs/reviews/<date>.md`.

Archived: `docs/agents/archived/` (not loaded).
