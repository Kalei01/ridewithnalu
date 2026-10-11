# Run gates and autonomy (Josh, Oct 11, 2026)

Josh's instructions: scheduled agents run only when the data says there's work; the system adapts on its own; Josh is asked as little as possible ("unless I ask something"). These rules are built into each routine's prompt and apply on top of the agent files.

## 1. The gate (every scheduled run, first)
Cheap checks only: `git log`, the passdowns, `docs/maintenance/alerts.md`, one script. **No browser, reviewers or subagents until the gate says RUN.** Decide from the evidence below, then do only the parts that have work.

Definitions used below:
- **Code change** = a commit on `cloudflare` touching `src/`, `public/`, `drizzle/`, `scripts/` (except `scripts/diag/`), `package.json`, `bun.lock` or `wrangler*`. Docs-only commits (passdowns, logs, backlogs, skip lines) never count — otherwise every skip would trigger the next run.
- **Rider-facing change** = a code change touching `src/routes`, `src/components`, CSS, or text riders see in `src/lib`.
- **Since last run** = since the commit/date in your passdown's "Last run" line.

**On SKIP:** edit (don't add) your passdown's "Last run" line: `<date> skipped — <reason>`; commit and push only that file; final message `SKIPPED: <reason>`; **no phone notification**.

## 2. Each agent's gate
**Daily Watchman (weekdays)**
- Always (cheap, no browser): health endpoint and page check.
- Live browser trips: when any of — an OPEN alert in alerts.md; a code change since last run; a health failure or planner > 6000 ms; Monday; or the last browser run is 3+ weekdays old. Record in "Last run" whether trips ran (`trips: yes/no`).
- Triage only when something was flagged.

**SEO Discovery (Mon/Thu)**
- Run `bun scripts/gsc-report.mts` (cheap). RUN when any of — impressions or clicks changed by 25%+ and by 20+ since the last logged run; a new query or a page's index status changed; an unblocked actionable item in `docs/seo/backlog.md` or `docs/passdown/seo.md`; a standing date check due; `docs/seo/ai-visibility.md` changed since last run. Otherwise SKIP.

**Premium UX Review (Wed)**
- RUN when any of — a rider-facing change since last review; an APPROVED/TODO item it may build that no other session owns (check `docs/passdown/main.md`); a season in `docs/experience/seasonal.md` starting within 4 weeks and not prepared. Otherwise SKIP.

**Weekly Review (Sun)** — always runs (cleanup + report), specialists only when needed:
- transit-accuracy: commute logic/wording changed this week, or first Sunday of the month.
- security-keys: any code change this week, or first Sunday.
- nalu-performance: planner/data code changed, or the Watchman flagged slowness this week.
- nalu-code-health (steward): first Sunday, or 20+ code-change commits this week.
- mobile-design: a rider-facing change this week.
- Product proposals: first Sunday only.
Quiet week = short report and cleanup only; say which specialists were skipped and why.

## 3. Adaptive cadence (learns from results)
Each agent keeps a **"Recent runs"** line in its passdown: the last 8 runs as `R+` (ran and found/fixed something), `R0` (ran, nothing found) or `S` (skipped), newest first.
- **3 × R0 in a row** → the gate gets stricter: also skip the next scheduled day unless a gate condition is clearly met (note "cooling down" in the passdown).
- **Any R+** → back to normal.
- **Safety floors (never exceeded):** SEO and Premium do a full run at least every 14 days; the Watchman's cheap checks run every weekday and browser trips at least every 3 weekdays; the Weekly Review runs every Sunday.
- The Weekly Review reads all "Recent runs" lines and reports in one line whether each agent is pulling its weight. If an agent is mostly `R0` for 4+ weeks, it recommends a lower schedule in the report (for Josh to say yes/no in the Sunday thread — no separate ping).

## 4. Asking Josh less
Decide and act yourself within the Autonomous Fix Safety Gate (`.claude/agents/nalu-lead.md`) and the standing database authorization. **Only these need Josh:** spending money or new paid services; new credentials; adding or removing a product feature (monthly proposals); anything the Safety Gate marks 🔴; deleting data beyond the standing authorization; anything irreversible.
- Batch everything else that's informational into the Sunday report — no separate questions.
- **Phone notifications only for:** something broke for riders and isn't fixed (or needs Josh); a decision only Josh can make; the Sunday summary. Not for skips, all-clears or routine successes. (Fixes shipped live are listed in the Sunday summary.)
- Never ask Josh to confirm something the data already answers.
