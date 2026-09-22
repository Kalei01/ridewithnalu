# Nalu Roadmap

## Completed (previous turns)
- GTFS import + weekly refresh, realtime cache, TomTom geocode/traffic, NWS/AirNow weather, HEA bus arrivals
- Browse/commute modes, maps, approach alerts, saved places, arrive-by, verdict engine
- HOLO fare notice + landmark anchors (fares.ts, landmarks.ts, TransitNotices.tsx) — wired into browse cards and RailTripBreakdown

## In progress
- [ ] Verify fare notice + landmarks end-to-end in browser (GO gating: draft.homeLat requires exact home place, not just station pick); check screenshots /tmp/browser/fares/commute.png
- [ ] Fix landmarks.ts normalization for combining-diacritic forms (Kualakaʻi vs kualakai)

## New: capitalize on signed-in Google experience
- [ ] Personalized greeting: pull first name from Google profile/user metadata, fall back gracefully ("Aloha kakahiaka, Josh")
- [ ] Silent cloud sync & migration: on sign-in, silently persist local saved places (home, destination, station/drive preference) to Supabase; no wizards or modals
- [ ] One-tap routine shortcut on Browse beneath greeting: morning (5:00 AM–11:59 AM) "Head to Work"; afternoon/evening "Head Home" — single tap launches live commute; keep WHERE TO? accessible
- [ ] Feedback form pre-fill: name + email auto-filled when signed in
- [ ] Tests/typecheck/build + browser verification
