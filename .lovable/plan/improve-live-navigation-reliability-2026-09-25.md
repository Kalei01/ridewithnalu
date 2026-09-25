# Improve live navigation reliability

## What will change
- Add sustained off-route detection using route distance and heading divergence, with a short debounce before an immediate reroute from the latest GPS fix and travel bearing.
- Show a rerouting status in place of stale turn guidance until the replacement route is ready.
- Draw only the untraveled portion of the active drive or transit route, starting at the matched vehicle position.
- Tune the heading-up camera to a 40° pitch, closer street zoom, lower-third puck placement, and one coordinated transition per GPS update.
- Hide the floating Lovable badge through the global stylesheet.
- Clear transient trip selection and active-commute state on a new sign-in while preserving synced saved places and settings.

## Validation
- Add focused tests for route distance, heading divergence, consecutive-fix off-route state, and forward polyline trimming.
- Replay a mock work-to-home drive with on-route and deviated GPS points and verify reroute behavior and route pruning.
- Verify sign-in returns to the clean home screen, then run the full test suite and inspect the current preview build status.

## Technical details
- Keep route matching in pure navigation helpers so thresholds and progress behavior are deterministic and testable.
- Pass off-route state from the map to the active commute coordinator; the coordinator owns network refreshes, race protection, and debounce timing.
- Add the current travel bearing to the TomTom routing request only during active reroutes, without exposing credentials in the browser.
