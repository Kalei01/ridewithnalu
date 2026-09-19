# Roadmap

- [x] Build the mobile-first commute verdict screen
- [x] Add persisted settings and refresh interactions
- [x] Add installable app manifest and icons
- [x] Verify desktop and 390px mobile layouts
- [x] Import real GTFS schedule data and show live departures
- [x] Import all stops and all routes
- [x] Import full stop sequences for every trip active in the Jul 12 – Dec 5, 2026 calendar window (no stop/proximity filter): 1,428,712 stop_times rows, 37,779 trips, DB 312 MB
- [ ] Data API batch upserts are too slow for 1.4M rows in one scheduled run; the weekly job needs a faster load path before it can refresh the full set

- [ ] Realtime delays (paused at user's request — no realtime code in the app)

## Setup, trip chaining, timeline (done)
- [x] First-open setup: browser location -> nearest rail station (data-derived), rail station dropdown from `rail_stations()`
- [x] Work address geocoded once via TomTom through server fn `geocodeAddress` (TOMTOM_API_KEY is a backend secret); coords + nearest stop saved to localStorage
- [x] `plan_rail_chains` RPC: rail leg -> data-derived transfer station -> connecting bus to destination stop, 4 min buffer, fastest chain per departure (~0.7s)
- [x] Manual fallback: connecting route picker from `routes_serving_stop(dest)` in settings
- [x] Vertical timeline naming each vehicle (Skyline + headsign, Route X to Y)
- No hardcoded station names, transfer points, hours, or route numbers anywhere in the app

## Four-leg chain, leave-by, direction, service hours (done)
- [x] First leg computed from location: walk (<15 min at 5 km/h), drive (if enabled in settings), or feeder bus from `stop_times`; fastest reachable option wins, unreachable rail departures are skipped
- [x] Manual "minutes to station" field removed; "Work address" relabelled "Destination"
- [x] "Leave by" time shown under the verdict, derived from the earliest reachable departure
- [x] Direction toggle (to destination / to home), defaulting by Honolulu time of day; `plan_inbound` plans the return as its own trip
- [x] `service_hours(stop_id, route_type)` gives real first/last departures per day of week; used to say rail is unavailable instead of recommending it
- New DB functions: `nearby_stops`, `access_legs`, `egress_legs`, `service_hours`, `plan_outbound`, `plan_inbound` (all data-derived, ~0.5-1.2s)
