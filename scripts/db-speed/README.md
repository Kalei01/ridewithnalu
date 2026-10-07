# Database speed fix 0063: how to apply it

Approved by the owner on Oct 6 2026. Prepared and rehearsed on a local copy of
the database loaded with TheBus's real timetable (1.44M stop times, same size
as production). **Not yet applied to production.**

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
