# Nalu Roadmap

## Completed
- GTFS import + weekly refresh, realtime cache, TomTom geocode/traffic, NWS/AirNow weather, HEA bus arrivals
- Browse/commute modes, maps, approach alerts, saved places, arrive-by, verdict engine
- HOLO fare notice + landmark anchors (fares.ts, landmarks.ts, TransitNotices.tsx) — wired into browse cards and RailTripBreakdown
- Landmarks normalization fixed: okina/apostrophe stripped, diacritics removed (Kualakaʻi ≡ kualakai); covered by landmarks.test.ts
- Fare flow verified end-to-end: Home saved place → "Start here" origin, Merchant St typeahead destination, GO, rail verdict, itinerary landmark "Aloha Stadium / Pearl Harbor", fare notice present
- Signed-in Google experience: personalized greeting (profileFirstName fallback chain), silent cloud sync (merge by updatedAt, debounced), one-tap routine shortcut ("Head to Work"/"Head Home", Honolulu hour windows), feedback form name+email prefill
- 77 Vitest tests, tsgo typecheck, production build all passing

## Open (blocked on external input)
- Signed-in browser verification of greeting/sync/feedback: blocked — the backend has zero auth users, so no session can be minted; the signed-in paths reuse the already-verified sync primitives. Re-check once a real user signs in.

## Current update
- [x] Add one-tap Home and Work actions beneath WHERE TO? using live GPS, with gentle setup fallback
- [x] Replace the compact HOLO notice with a high-contrast accessible fares dialog
- [x] Remove destination-stop helper text from the setup dialog

## Nearby arrivals and comparison clarity
- [x] Show data-derived route and destination labels on nearby-stop choices
- [x] Add an expandable GPS-to-stop walking map with distance and time
- [x] Make every relative time label name the mode or departure it compares against
