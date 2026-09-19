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
