# Bay Area transit data: size check for a Supabase database

Measured 2026-10-08 from the 511 SF Bay API (static GTFS, `status=active`) and read-only against Nalu's Oʻahu database. No secrets or GTFS files are stored in the repo.

## Recommendation (plain English)

Micro (1 GB RAM, about $10/mo) can *hold* the main Bay Area agencies, but it would be tight. Plan on Small (2 GB) for the full commute set.

- The 8 main agencies need about **~390 MB** of tables and indexes in Nalu's current schema, roughly **2x** Oʻahu's ~202 MB. The regional combined feed alone would be about **~460 MB**.
- The part the trip planner hits constantly is `stop_times` and its indexes. That grows about 1.85x, to ~2.66M rows versus ~1.44M on Oʻahu. On a 1 GB Micro box the database gets only a few hundred MB of memory cache, so most of that hot data would not stay in memory, and trip planning would slow down.
- On Small, the whole data set fits in memory with room to spare.
- Best cost trade: start on Small, or start Micro with only a few agencies (Muni, BART, Caltrain) and upgrade when adding AC Transit, SamTrans and VTA. Muni alone is ~1.3M stop_times rows, about as big as all of Oʻahu.

## Static GTFS per agency (511 feeds)

| Agency (operator ID) | Zip MB | Unzipped MB | Stops | Routes | Trips | stop_times | Shape points | Service dates |
|---|---|---|---|---|---|---|---|---|
| Muni (SFMTA) (SF) | 7.8 | 77.7 | 3,240 | 68 | 34,668 | 1,302,039 | 45,014 | 20260829–20270115 |
| BART (BA) | 0.8 | 5.1 | 287 | 14 | 4,417 | 57,188 | 27,893 | 20260810–20270110 |
| Caltrain (CT) | 0.1 | 0.7 | 106 | 5 | 260 | 5,468 | 5,942 | 20260131–20270131 |
| AC Transit (AC) | 8.3 | 54.4 | 4,692 | 123 | 13,695 | 639,131 | 325,049 | 20260809–20270403 |
| SamTrans (SM) | 3.7 | 32.3 | 1,852 | 75 | 6,082 | 224,801 | 302,282 | 20260823–20261114 |
| VTA (SC) | 4.8 | 29.2 | 3,332 | 71 | 9,123 | 397,189 | 144,137 | 20260810–20261025 |
| Golden Gate Transit (GG) | 0.8 | 4.5 | 364 | 10 | 1,190 | 30,072 | 69,698 | 20260614–20261212 |
| SF Bay Ferry (SB) | 0.0 | 0.2 | 23 | 7 | 383 | 806 | 1,749 | 20260309–20261101 |
| **Total, 8 agencies** | 26.4 | 204.1 | 13,896 | 373 | 69,818 | 2,656,694 | 921,764 | |
| Regional combined feed (all ~40 agencies) (RG) | 59.2 | 291.3 | 21,628 | 671 | 90,164 | 3,101,031 | 1,380,457 | 20210622–20991231 |

Notes:
- Row counts are the raw feed. Nalu's importer keeps only trips whose service is active from today onward, so real loaded counts would be somewhat lower.
- Nalu does not store shapes, so the shape rows above do not count toward database size. They are most of the unzipped bytes in AC Transit, SamTrans and VTA.
- The regional feed (RG) is the same agencies combined (it also has the other ~30 small operators). Its calendar range starts in 2021 and ends in 2099, so it would need trimming to active service. Download size was 59 MB zipped, 291 MB unzipped.
- Samtrans and VTA calendars end in Oct–Nov 2026, so feeds need regular refresh.

## Size estimate versus Oʻahu

Oʻahu today (measured via read-only query; Supabase Micro):

| Table | Rows | Total MB (heap + indexes) | Bytes per row |
|---|---|---|---|
| stop_times | 1,436,661 | 204.6 (97.0 heap + 107.6 index) | ~142 |
| trips | 37,880 | 4.9 | ~129 |
| stops | 3,832 | 1.0 | ~256 |

Nalu keeps 6 tables (stops, routes, trips, stop_times, calendar, calendar_dates), no shapes. Estimating the Bay Area as rows × those bytes-per-row:

| Scenario | stop_times | trips | stops | Estimated DB size |
|---|---|---|---|---|
| Oʻahu (measured) | 1.44M | 37.9k | 3.8k | ~205 MB (stop_times alone), 215 MB total database |
| 8 main agencies | 2.66M | 69.8k | 13.9k | **~390 MB** |
| Regional combined feed | 3.10M | 90.2k | 21.6k | **~460 MB** |

Add roughly 10–15 MB for the other app tables (users, push, feedback) and any extra tables or indexes the Bay Area version needs. This is an estimate, not a load test: the bytes-per-row numbers come from Oʻahu's text-heavy ID columns, which could differ slightly for 511 IDs. It also does not include per-city planner tables like `stop_modes`.

### Fit versus memory

| Plan | RAM | Fit |
|---|---|---|
| Micro | 1 GB (shared, 2 cores) | Disk is fine. Memory cache is tight: ~390 MB of data plus ~240 MB of that as indexes the planner reads constantly, with Postgres, connections and the OS sharing the same 1 GB. Expect slower trip planning on a cold cache, especially with Muni plus AC Transit. |
| Small | 2 GB | Comfortable. The hot data fits in memory. |

## Rate limits seen

- `RateLimit-Limit: 60` per period (the API returned RateLimit-Limit/Remaining headers; limit was 60 and remaining counted down by one per request).
- 13 requests reached 511 in this run (operator list, 9 feeds, 3 realtime), spaced ≥ 5 s. No 429s.
- 60 calls per period is plenty for static downloads but would not be enough for live realtime polling by itself. Realtime for many users must be cached server-side (poll once, serve many), as Nalu does today.

## GTFS-realtime (agency=RG), one call each

| Feed | HTTP | Payload |
|---|---|---|
| TripUpdates | 200 | 2.5 MB |
| VehiclePositions | 200 | 190 KB |
| ServiceAlerts | 200 | 78 KB |

All three work with the same key. TripUpdates is large (2.5 MB per poll), so polling should be cached and ideally filtered per agency.

## Method

- Operator list: `https://api.511.org/transit/gtfsoperators` (43 operators).
- Static GTFS: `https://api.511.org/transit/datafeeds?operator_id=<ID>&status=active` for SF, BA, CT, AC, SM, SC, GG, SB and RG.
- Oʻahu sizes: read-only query on the production database via the Supabase Management API.
- Import behavior reference: `scripts/gtfs-refresh.mts` and `src/routes/api/public/import-gtfs.ts` (active-service trips only; shapes not stored).
