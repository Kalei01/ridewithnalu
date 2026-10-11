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
