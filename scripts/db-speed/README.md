# Database speed fix 0063: how to apply it

Approved by the owner on Oct 6 2026. Prepared and rehearsed on a local copy of
the database loaded with TheBus's real timetable (1.44M stop times, same size
as production). **Applied to production Oct 7 2026, ~9:25 AM HST** (owner approved): production side-by-side 56/56 identical; old avg 1,752 ms (max 8,695) → new avg 83 ms (max 214); `nearby_transit_stops_v2` dropped. Still to check: the first Sunday timetable refresh after this (Oct 11, 2 AM) — `import_log.row_counts` should include `stop_modes`.

`drizzle/migrations/0063_faster_nearby_transit_stops.sql` speeds up "stops near
me" (`nearby_transit_stops`). Local rehearsal: 56/56 cases identical (14 places
across Oʻahu × 7 AM, 4:30 PM, 11 PM, 1 AM); average 470–1,190 ms → 30–67 ms.

## Not adopted: general-planner time window (fix 2)

An upper time bound on `plan_transit_general`'s `dest_arrivals` cannot lose a
trip (TheBus's longest trip is 3 h 6 min), but on the rehearsal it was not
faster (as first written 640 ms vs 578 ms old; rewritten 550 ms), and 5 of 72
planner cases picked a different option among equal ties (same leave and arrive
times). Those ties sit at the planner's existing "keep the first 200 / 80"
cut-offs, where the old function also changes its pick with the memory setting.
Per the owner's rule (any difference: don't switch) it was dropped. A tie-break
on walking time and stop ids in `transfer_first` / `transfers` would make the
planner stable first; that is a separate change.

## Steps (outside 6–9 AM and 3–6:30 PM Hawaiʻi time, and not Sunday 1–4 AM)

Run SQL in Supabase → SQL Editor for project `nsoameosqsnumjivkmyv`.

1. **Side by side.** Run `side-by-side.sql`. It creates the `stop_modes` table
   and the new function as `nearby_transit_stops_v2`. Riders still use the old one.
2. **Compare.** From a computer with this repo and a Supabase personal access
   token: `SUPABASE_ACCESS_TOKEN=... bun scripts/db-speed/compare.mts --api --report report.json`.
   56 cases, one query at a time, 2 s apart (about 4 minutes). Every line must
   say "same"; otherwise stop and investigate.
3. **Switch.** Run `drizzle/migrations/0063_faster_nearby_transit_stops.sql`.
4. **Clean up.** Run `cleanup.sql` (drops `nearby_transit_stops_v2`).
5. **Check.** https://ridenalu.com/api/public/health is OK, and the Browse
   screen lists nearby stops with times.

## Weekly timetable refresh

`stop_modes` is rebuilt inside `swap_gtfs_staging()` in the same transaction as
the timetable swap (0063 replaces that function and keeps its 900 s time limit
and service-role-only access). Rehearsed locally: after deleting rows from
`stop_modes` and swapping in a different feed, it matched the timetable exactly
(0 missing, 0 extra); the full swap took 11 s. Not rehearsed: the GitHub Action
end to end against production (it runs Sundays 2 AM; check its log the first
Sunday: `import_log.row_counts` now includes `stop_modes`).

Between steps 1 and 3 the old swap does not refresh `stop_modes`; only the `_v2`
test function reads it, and step 3 rebuilds it.

## Rollback

Re-run `0030_nearby_transit_stops.sql`, then `0026` + `0027` + the first two
lines of `0048` (old swap), then `DROP TABLE public.stop_modes;`.

---

# Database speed fix 0065: one search for every boarding station

Approved by the owner on Oct 8 2026 ("speed first"). **Not yet applied to production.**

A trip with a car searched Skyline from 4–5 stations, one `plan_outbound` call
each (home station first, then the rest). `drizzle/migrations/0065_plan_outbound_multi.sql`
adds `plan_outbound_multi`, which searches all of them in one call: the
per-station part (getting to the station, which trains) runs exactly as
`plan_outbound` does, and the expensive destination-side part (which buses
leave the Skyline stops toward the destination) runs once instead of per
station. Additive: `plan_outbound` and everything else are unchanged.

The app (shipped first) calls `plan_outbound_multi` when there are 2+ stations
and falls back to the old per-station calls when it is missing or fails, so
nothing changes for riders until the function exists.

**Local rehearsal** (Postgres 16, TheBus feed of Sep 25 2026, 1.44M stop
times, `random_page_cost = 1.1`):

- `bun scripts/db-speed/compare-outbound.mts --psql "dbname=nalu" --fn plan_outbound_multi` → **60/60 identical**
  (Kapolei, ʻEwa Beach, Mililani, Pearl City, Waipahu, Aiea → downtown with a
  car: Leave now 7 AM / 4:30 PM / 11 PM, Arrive by cursors 4 AM / 6:30 AM /
  1:30 PM; without a car: Leave now ×3; → Ala Moana 7 AM). `--extended` adds
  Kalihi, UH and Waikīkī at 5:30 AM, 9 AM, noon, 3 PM, 6 PM: **96/96 identical**.
- Database time for the multi-station trips (36 cases): separate searches
  (summed) avg **3,645 ms** → one call avg **2,259 ms** (−38%). Kapolei →
  downtown 7 AM: 3,750 → 2,282 ms. One trip now makes 1 search instead of 4–5.
- Honest caveat: on an idle database the old way overlapped 3–4 of its searches,
  so the wait could be a little shorter than one combined call (≈ the home
  search + the slowest other). The gain is less work per trip (−38%) and one
  search instead of 4–5 competing for the database's CPU, which is what made
  real trips slow (`plan_outbound` avg 2.9 s in real use vs 0.07–0.27 s alone).
- Ties: when the same bus leaves two neighbouring stops at the same second,
  `plan_outbound` keeps whichever row its plan meets first. `plan_outbound_multi`
  hands rows on in the order of `plan_outbound`'s plan under SSD cost settings
  (`random_page_cost = 1.1`, a merge join on the bus stop id). With
  Postgres's default `random_page_cost = 4` the old plan orders them
  differently and 2 of 60 cases differ (same times, a neighbouring bus stop).
  The compare prints the server's setting; the production run is the proof.

## Production steps for the main session

Outside 6–9 AM and 3–6:30 PM HST, and not Sunday 1–4 AM. SQL runs in Supabase →
SQL Editor for project `nsoameosqsnumjivkmyv` (or the Management API).

1. **Side by side.** Run `scripts/db-speed/outbound-multi-side-by-side.sql`. It
   creates the same function as `plan_outbound_multi_preview`, callable only by
   the database owner. Riders and the app never use it.
2. **Compare.** `SUPABASE_ACCESS_TOKEN=... bun scripts/db-speed/compare-outbound.mts --api --report outbound-report.json`
   (60 cases × 2 queries, 2 s apart, about 8–10 minutes; the first line prints the
   server version and `random_page_cost`). Every line must say "same", ending
   `60/60 identical`. Any DIFFERENT: stop, keep the report, don't apply step 3.
3. **Apply.** Run `drizzle/migrations/0065_plan_outbound_multi.sql`.
4. **Clean up.** Run `scripts/db-speed/outbound-multi-cleanup.sql` (drops the preview).
5. **Check.** `SELECT count(*) FROM public.plan_outbound_multi(21.335, -158.079, ARRAY['10047','10046'], ARRAY[true,true], ARRAY[4,4], '737', 25200, NULL, 240, 1207, 21.3069, -157.8583);`
   returns rows (8 locally; Kapolei → downtown, 7 AM); https://ridenalu.com/api/public/health is OK; on ridenalu.com
   a Kapolei → downtown trip shows Skyline and Bus rows, and the browser's
   network tab shows one `plan_outbound_multi` request instead of several
   `plan_outbound` ones. Log it in `docs/maintenance/autofix-log.md` with the rollback.

If 0065 is ever edited, regenerate the side-by-side file the same way
(function renamed to `plan_outbound_multi_preview`, grants replaced by the
`REVOKE` at its end) before comparing.

## Rollback

`DROP FUNCTION IF EXISTS public.plan_outbound_multi(numeric, numeric, text[], boolean[], integer[], text, integer, text, integer, integer, numeric, numeric, integer);`
The app notices the function is gone and goes back to the per-station searches
(it re-checks every 10 minutes per open tab); no app change needed.
