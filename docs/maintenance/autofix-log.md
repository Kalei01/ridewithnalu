# Autonomous fix log

Every fix an agent makes without Josh's approval, under the Autonomous Fix Safety Gate in `.claude/agents/nalu-lead.md`. Newest first. Escalated (🔴) issues are not logged here; they go in the weekly report in `docs/reviews/`.

Entry format:

```
### <YYYY-MM-DD HH:MM HST> — <short title>
- Class: 🟢 / 🟡
- Issue: what was detected (and by which agent/check)
- Root cause: file:line and why it failed
- Fix: what changed (files)
- Validation: what ran and the result (typecheck / tests / build / lint / regression / live)
- Confidence: high / medium
- Rollback: git revert <sha>
```

---

### 2026-10-14 HST — Phase 0c: Lovable leftovers removed (one cleanup)
- Class: 🟡 — Josh's Oct 11 instruction; keys confirmed set in Cloudflare
- Issue: Lovable fallbacks left after the move to Cloudflare (Phase 0b KEPT list).
- Fix: removed the sign-in broker (`src/integrations/lovable`, `@lovable.dev/cloud-auth-js`; Google/Apple now call Supabase directly), `LOVABLE_API_KEY` fallbacks (AI needs `OPENAI_API_KEY`, push needs the Firebase service account), `LOVABLE_CRON_SECRET` fallback, `previewAuthStorage.ts`, `.lovable/`, "Lovable Cloud" error wording, 3 `bunfig.toml` excludes; README one line. KEPT: `@lovable.dev/vite-tanstack-config`, `VITE_LOVABLE_CONNECTOR_*` env names (read by Firebase web, Mapbox, PostHog code), AGENTS.md. Left for later: stale names in `.claude/agents/security-keys.md`, unused `VITE_AUTH_PROVIDER` in `.env`.
- Validation: 641 tests, typecheck, build; security-keys: no critical/high (cron still fails closed). Live checks: see below.
- Confidence: high
- Rollback: git revert de1058b 101109d and the third cleanup commit

---

### 2026-10-13 ~2:30 PM HST — Phase 2: one server request per trip (switch ON)
- Class: 🟡 — approved build (fix-plan Phase 2), no change to decision rules
- Issue: the phone ran 10+ planner calls per trip (12–30 s at rush hour, silent gaps; Skyline "no trip" alert).
- Fix: `planTripServer` (src/lib/transit-plan.functions.ts, transit-plan.server.ts) runs `planTransitTripDetailed` on Cloudflare with parallel searches, deadlines, limits and caches; `lookupTrafficMinutes` (drive.functions.ts); switch + fallback in src/lib/trip-plan-client.ts; planner dependencies injectable (transit-plan.ts). Arrive By with a car stays on the phone.
- Validation: 641 tests, typecheck, build, eslint on touched files; replay side-by-side 30/30 identical, live phone vs server identical on 3 trips (scripts/phase2/); transit-accuracy (HIGH grace + subrequests found and fixed; re-check: safe), security-keys (no critical/high; Mediums fixed: Hawaiʻi-only input, 30 stations, redacted server logs), nalu-performance (fixed: abort past deadline, 4+2 open calls; Arrive By with a car held on the phone), mobile-design (no difference). Live e9daeec: default path uses the server, rows identical to the phone path.
- Confidence: high for Leave Now; rush hour still to be confirmed by the Watchman.
- Rollback: set `SERVER_TRIP_PLAN = false` in src/lib/trip-plan-client.ts (or git revert e9daeec).

### 2026-10-11 ~11:20 PM HST — Phase 0a: stop calling the unapplied combined station search
- Class: 🟢
- Issue: every trip sent `plan_outbound_multi` (migration 0065, parked, not in production), got a 404, then fell back to `plan_outbound`; the 10-minute "missing" memory is per browser.
- Root cause: `src/lib/transit-plan.ts` `fetchOutbound` always tried `fetchOutboundTogether` first.
- Fix: switch `USE_OUTBOUND_MULTI = false` (comment points to the parked migration); per-station search runs directly; combined code kept. Tests: new "never asks while off" test; multi-path tests run with the switch on.
- Validation: typecheck, 618 tests, build, eslint on touched files; transit-accuracy and security-keys: no issues. Live (f6f9204): rows load, no page errors, 0 `plan_outbound_multi` requests, `plan_outbound` used.
- Confidence: high
- Rollback: git revert f6f9204

### 2026-10-11 ~11:40 PM HST — Phase 0b: Lovable editor leftovers
- Class: 🟢
- Issue: Lovable leftovers after the move to Cloudflare.
- Fix: removed `src/lib/lovable-error-reporting.ts` (+ its call in `__root.tsx`) and the Lovable badge CSS in `styles.css`; both only touched things that exist in the Lovable editor/host. KEPT (still used or doubtful): Lovable sign-in broker fallback (`integrations/lovable`, `@lovable.dev/cloud-auth-js`; prod uses `VITE_AUTH_PROVIDER=supabase` from `.env`), `previewAuthStorage.ts`, `LOVABLE_API_KEY` fallbacks for AI lines and push (depend on Cloudflare secrets not visible from the repo), `LOVABLE_CRON_SECRET` fallback, `@lovable.dev/vite-tanstack-config` (build-critical), 3 unused `bunfig.toml` excludes (file says ask Josh first), `.lovable/`, README Lovable text, "Lovable Cloud" wording in 3 Supabase error strings.
- Validation: two independent checks (evidence list + fresh agent trying to prove use) agreed; typecheck, 618 tests, build; security-keys no issues. Live (2b0ecfd): rows load, no page errors. Note: `__root.tsx` already had prettier errors on lines I did not touch; left alone.
- Confidence: high
- Rollback: git revert 2b0ecfd

---

### 2026-10-07 ~10:27 PM HST — Applied migration 0066 (rider feedback)
- Class: 🟡 — standing database authorization (owner, Oct 8)
- Issue: P-4 "Tell Nalu something" notes were quietly dropped until the table existed.
- Fix: applied `drizzle/migrations/0066_rider_feedback.sql` (new `rider_feedback` table and `submit_rider_feedback`; additive, RLS on, service-role only; notes older than 180 days are removed on the next submit; at most 200 notes a day).
- Validation: database reviewer OK; security-keys Low only (per-instance rate limit is a backstop, the daily cap is the real bound; old notes are purged only when someone submits). Verified the table and function exist, RLS on, anon/authenticated denied, service role can execute; a test note saved inside a transaction that was rolled back, and the table still has 0 rows. Live at 390×844: "Something look off? Tell Nalu" on the trip screen opens the form, no sideways scroll, no page errors.
- Confidence: high
- Rollback: see the Rollback line at the end of the migration file.

### 2026-10-08 ~5:35 PM HST — Applied migration 0064 (visitor funnel)
- Class: 🟡 — standing database authorization (owner, Oct 8)
- Issue: P-1 funnel counts were discarded until the table existed.
- Fix: applied `drizzle/migrations/0064_visitor_funnel.sql` (new `funnel_counts` table, `record_funnel_step`, `funnel_stats`; additive, RLS on, service-role only).
- Validation: database reviewer OK; security-keys no critical/high (Medium: endpoint has no rate limit and accepts any link tag — counts approximate); verified the table and both functions exist with RLS on and anon access denied; live site 200. Automated browsers are excluded by design, so the first real counts will come from riders.
- Confidence: high
- Rollback: see the Rollback line at the end of the migration file.
