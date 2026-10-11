# Fix plan (approved by Josh, Oct 11, 2026)

Goal: Nalu fast and right, then the one-screen direction (docs/product/direction.md). One build at a time, cheapest model that's safe. Every step: full gate under `set -e`, the matching reviewers, a live check, passdown updates.

| Phase | What | Who | Status |
|---|---|---|---|
| 0a | Stop calling the missing `plan_outbound_multi` on every trip (switch off until 0065 is fixed) | Sonnet session "NALU — Phase 0 cleanups" | Started Oct 11 |
| 0b | Remove proven-unused Lovable leftovers (evidence + second agent must agree) | same session | Started Oct 11 |
| 1 | Find the Skyline "no trip" cause from a real rush-hour recording; small fix on Sonnet, or fold into Phase 2 | Main session, Mon Oct 12 6:25 AM HST | Scheduled |
| 2 | One server request per trip (brief below) | One Opus session, Tue Oct 13 | Scheduled |
| 3 | Split `src/routes/index.tsx` (~6,000 lines) one area per session, no behaviour change | Several Sonnet sessions, after Phase 2 | Waiting |
| 4 | City packs: Oʻahu specifics out of ~70 files into `cities/oahu/`, no rider change, side-by-side proof | Opus once (design), then Sonnet | Before the Bay Area |
| 5 | Decisions only: open-source router research (Sonnet report); free weekly backup of rider data (needs one read-only token from Josh) | Later | Waiting |

Trust & authority pages moved after Phase 2 (mostly writing/design: Sonnet, with one Opus check of the About page).

## Phase 2 brief — one server request per trip
Today the phone runs 10+ Supabase calls per trip (some one after another), taking 12–30 s and causing silent gaps at rush hour. Build:
1. One server function (TanStack Start server fn on Cloudflare) that takes the trip (from, to, mode, time, access answer) and returns the same result shape `planTransitTripDetailed` returns today (options + unchecked flags). It runs the existing searches **in parallel**, server-side, with the same planner functions and rules — **no change to how Nalu decides**.
2. Reuse answers only for exactly the same trip (same start, destination, access, minute); timetable searches can be reused for minutes, live traffic only briefly (≤ 2 min, as today). Never share anything personal.
3. A deadline: a search that runs late marks its row unchecked ("Can't check Skyline right now") — never "no trip".
4. The phone makes one call. Keep the old path behind an on/off switch for instant rollback.
5. **Side-by-side proof before switching:** a fixed set of trips (Kapolei, ʻEwa Beach, airport → Waikīkī, Arrive by, late night, rush and quiet hours) through old and new; answers must match, any difference explained and fixed first.
6. Check Cloudflare Workers free-plan limits (CPU time, subrequests) before building; database waiting time should fit, confirm with measurements.
7. Report speed before/after (rows-ready time on the live Kapolei trip) and whether the Skyline "no trip" alert can close.
Accuracy rule (Josh, Oct 11): speed must come from moving and parallelising the work, never from cutting corners.
