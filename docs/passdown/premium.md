# Passdown — Premium UX Review (Wed 10:47 AM HST)
Last updated: 2026-10-11 (main session, seeded). Keep ≤ 60 lines; see README.md. Gate and cadence: `docs/agents/run-gates.md`.

## Current focus
- Backlog: `docs/experience/backlog.md`; seasons: `docs/experience/seasonal.md`; direction: `docs/product/direction.md`.
- Station names: being built by "NALU — Skyline station names in app (Sonnet)" (English name, Hawaiian name smaller and muted underneath). Review it live on your next run if shipped.
- "Tell Nalu something" form polish: done Oct 11 (visible off checkbox, "Your note" label).

## Don't touch
- Planner/verdict logic, timeouts, database (main session). Guide pages' focus (SEO agent).

## Recent runs (newest first: R+ found/fixed, R0 nothing, S skipped)
- (none yet)

## Last run
- Motion batches (Oct 14): ALL items M1–M18 built (M1, M5–M8, M18 live c2df075; M9–M11, M13, M14, M16, M17 and in-app M4 pushed after; live check pending). Left for a later session: verify rain/night/streak/pull-to-refresh on a real phone and a rush-hour trip (traffic bar, pick lift). Earlier note: M2, M3, M12, M15 and public-page M4 done and live (37d60f5; live check 390×844 light/dark/reduced motion OK; +5.4 KB gzip; CLS 0). Next item = M1, then M5–M11, M13, M14, M16–M18, rest of M4 (in-app cards, leave-now pulse); notes: all touch the answer screen, so start only after the Skyline P1 is marked fixed in main.md/alerts.md (don't touch src/routes/index.tsx or commute/sections before). Hook `use-reveal` and `data-tod` on <html> exist for reuse (M10).
- Oct 7 run skipped by Josh. Next run Wed Oct 14.
