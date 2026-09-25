# Stabilize live commute navigation

## What will change
- Snap the on-screen vehicle position to the closest plausible point on the active route while keeping raw GPS for rerouting and ETA calculations.
- Reject implausible GPS jumps and headings that conflict with the forward route, preventing sudden reversals or turn-around guidance.
- Keep progress anchored to the last matched route segment so nearby parallel ramps and opposite carriageways do not steal the marker.
- Reduce route churn by refreshing only after meaningful forward movement or on the traffic timer, while preserving the latest-response guard.
- Make the active route substantially brighter and thicker, mute competing map colors, and keep the puck in the lower third with the road ahead visible.
- Apply the same readable line treatment and route matching to active drive and transit navigation.

## Validation
- Add focused tests for route snapping, forward progress, heading selection, off-route handling, and GPS-jump rejection.
- Replay a synthetic Waikele-to-Honolulu GPS sequence, including noisy points near parallel lanes and ramps.
- Verify the active map at iPhone, Android, and tablet widths, then run tests and inspect current app errors.

## Technical details
- Introduce pure navigation-matching helpers rather than embedding geometry decisions in the map component.
- Use hysteresis: prefer nearby forward segments around the previous match and only accept backward movement or reroutes when evidence persists.
- Use snapped points only for presentation and camera orientation; routing requests continue to use validated GPS positions.
