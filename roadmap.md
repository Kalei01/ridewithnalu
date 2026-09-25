- [x] Redesign Alternative Departures for clarity and visual polish
- [x] Audit frontend, backend, data logic, security, accessibility, and release readiness
- [x] Fix confirmed defects without changing working product scope
- [x] Run targeted tests, full tests, typecheck, and production-build verification
- [x] Keep Alternative Departures contained after refresh on phone and tablet widths
- [x] Highlight every End Trip action in red
- [x] Verify the active-trip screen on mobile and tablet viewports
- [x] Setup: From (current location) / To only; auto-derive station; remove drive toggle
- [x] Saved places management in Settings with pills; customizable home shortcuts
- [x] Live ETA recalculation from GPS during active commute
- [x] Stabilize live navigation: route-snapped puck, forward heading, calmer reroutes, high-contrast route line

## Queued batch (Sep 2026)
- [x] Firebase push: opt-in categories, quiet hours, token refresh/removal, dedupe
- [ ] (partial: consent + app_opened/trip_started wired; PostHog not linked) PostHog privacy-first analytics + consent + legal copy
- [x] Door-to-door ETA: destination access buffers by zone, arrival ranges, stale-response guards
- [x] WHERE TO one-tap pills (Home/Work/Gym/Add)
- [x] Turn-by-turn voice (0.5 mi / 300 ft), dedupe, speech priming, wake lock
- [x] Mapbox heading-up commute map + top HUD + mute toggle + recenter

## Destination audit & commute HUD
- [x] TomTom search/geocode: bounding box, multi-result, venue consensus (Ala Moana)
- [x] Full-screen active commute HUD (top maneuver bar, bottom card, drawer, scroll lock)
- [x] Auto-enable voice + alerts on Start Drive/Transit, prime audio
- [x] Inline quick-edit for shortcut places

## Sign-in, station card & Nalu AI (Sep 25)
- [x] Google + Apple sign-in for any rider (email/password kept)
- [x] Usage-stats "Allow" hides instantly and stays hidden
- [x] Station card: TheBus feeders for long walks, Park & Ride tag, compact pill when far, HOLO transfer note
- [ ] Skyline system-status pill — blocked: no reliable live status source
- [x] Morning Pulse, Ask Nalu, Beat the Rush, mid-commute rescue, weekly digest

## Live navigation reliability (Sep 25)
- [ ] Detect sustained off-route distance or divergent heading and reroute immediately from the latest fix
- [ ] Replace stale maneuver guidance with rerouting status while recalculation is active
- [ ] Trim completed route geometry behind the vehicle
- [ ] Tune heading-up camera to 40° pitch, closer zoom, and non-competing transitions
- [ ] Hide the Lovable badge globally
- [ ] Keep the homepage clean after sign-in without disrupting saved-place sync
- [ ] Add navigation matching/reroute tests and verify the work-to-home flow
