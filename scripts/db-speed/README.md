# Database speed fixes 0063 / 0064: how to apply them

Approved by the owner on Oct 6 2026. Prepared and rehearsed on a local copy of
the database loaded with TheBus's real timetable (1.44M stop times, same size
as production). **Not yet applied to production.**

| Migration | What it speeds up | Local rehearsal |
|---|---|---|
| `0063_faster_nearby_transit_stops.sql` | "Stops near me" (`nearby_transit_stops`) | 42/42 cases identical; avg 470 ms → 30 ms |
| `0064_bounded_general_planner_window.sql` | General bus/rail planner (`plan_transit_general`) | 71/72 identical; 1 tie (below) |

The 1 planner difference: Kalihi → Ala Moana after 1:00 AM, 6th option. Old and
new both leave at 3:30 AM, arrive at 4:41 AM, ride Route 2 then the A Line; they
change buses at neighbouring stops (the new one walks 1 min less). The **old**
function itself returns three different stops for that slot depending only on
the database's memory setting, because of ties at its existing "keep the first
200 / 80" cut-offs. So it is pre-existing randomness, not a lost trip — but
it is not "identical", and the owner decides whether 0064 goes ahead.

## Steps (outside 6–9 AM and 3–6:30 PM Hawaiʻi time, and not Sunday 1–4 AM)

Run SQL in Supabase → SQL Editor for project `nsoameosqsnumjivkmyv`.

1. **Side by side.** Run `side-by-side.sql`. It creates the `stop_modes` table
   and the new functions as `nearby_transit_stops_v2` / `plan_transit_general_v2`.
   Riders still use the old functions.
2. **Compare.** From a computer with this repo and a Supabase personal access
   token: `SUPABASE_ACCESS_TOKEN=... bun scripts/db-speed/compare.mts --api --report report.json`.
   114 cases, one at a time, 2 s apart (about 10 minutes). It prints old vs new
   time per case and "same" / "DIFFERENT".
   - Nearby stops: every case must say "same". Otherwise stop and investigate.
   - Planner: any "DIFFERENT" must be a tie like the one above (same leave and
     arrive times, same routes) — check `report.json`. Otherwise do not apply 0064.
3. **Switch.** Run `drizzle/migrations/0063_faster_nearby_transit_stops.sql`,
   then `drizzle/migrations/0064_bounded_general_planner_window.sql`.
4. **Clean up.** Run `cleanup.sql` (drops the `_v2` functions).
5. **Check.** https://ridenalu.com/api/public/health is OK, and a Kapolei →
   downtown trip shows bus/Skyline options.

## Weekly timetable refresh

`stop_modes` is rebuilt inside `swap_gtfs_staging()` in the same transaction as
the timetable swap (0063 replaces that function and keeps its 900 s time limit
and service-role-only access). Rehearsed locally: after corrupting `stop_modes`
and swapping in a different feed, it matched the timetable exactly (0 missing,
0 extra); the full swap took 11 s. Not rehearsed: the GitHub Action end to end
against production (it runs Sundays 2 AM; check its log the first Sunday).

Between steps 1 and 3 the old swap does not refresh `stop_modes`; only the `_v2`
test function reads it, and step 3 rebuilds it. Avoid Sunday 1–4 AM anyway.

## Rollback

Each migration file ends with its rollback: re-run the previous definitions
(0030 for nearby stops; 0026 + 0027 + 0048 lines 4–5 for the swap; the
`plan_transit_general` section of 0056 for the planner), then drop `stop_modes`.
