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
