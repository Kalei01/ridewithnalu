# Roadmap

- [x] Build the mobile-first commute verdict screen
- [x] Add persisted settings and refresh interactions
- [x] Add installable app manifest and icons
- [x] Verify desktop and 390px mobile layouts
- [x] Import real GTFS schedule data and show live departures
- [x] Import all stops and all routes
- [x] Import full stop sequences for every trip active in the Jul 12 – Dec 5, 2026 calendar window (no stop/proximity filter): 1,428,712 stop_times rows, 37,779 trips, DB 312 MB
- [ ] Data API batch upserts are too slow for 1.4M rows in one scheduled run; the weekly job needs a faster load path before it can refresh the full set

- [x] Live TheBus HEA arrivals for active feeder and connecting stops, with 30-second server cache and timetable fallback

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

## US customary units (done)
- [x] Distances shown as feet under 0.1 mile, else miles to one decimal
- [x] Walking speed 3 mph (80.47 m/min), 15-min walk limit = 0.75 mile; driving estimate 25 mph
- [x] Quarter-mile (402 m) stop-to-station proximity, half-mile (805 m) bus boarding radius
- [x] No temperatures in the app; database values remain metric, conversion happens at display/calculation time

## Direction + real return trip (done)
- [x] Outbound before noon, return after noon; manual toggle at the top of the screen persists 2 hours (`nalu-direction-v1`) then auto resumes
- [x] Return planned independently by `plan_inbound` (bus/walk to boarding stop, rail to home station, last leg home)
- [x] Outbound drive to the station is remembered (`nalu-parked-v1`, per date + station) so the evening last leg drives home; otherwise driving is not offered on the return
- [x] "Home rail station" relabelled "Home station" with helper text
- [x] Setup can be dismissed without breaking the app; browse mode shows location-based rail departures in both directions, a persistent setup button, and a station picker when location is unavailable
- [x] Planned-trip timeline explicitly names access/rail stations and mode-aware final legs; return stop banner follows the selected first leg
- [x] Return trips default drive-to-station cars to the home station and pass that availability into return planning
- [x] Outbound and return timelines separate vehicle headsigns from alight stops, show explicit board/get-off instructions, and emphasize critical stops and times for bright-light readability

## Directional destination stops + clearer distances (done)
- [x] `directional_dest_stop(lat, lon, toward_rail)` picks the nearest stop whose active bus trips also touch a rail-near stop, in the right sequence/direction; outbound and return resolve to different stop_ids
- [x] Setup saves both stops; older saved trips backfill the pair on load
- [x] Screen shows the stop for the active direction ("Bus stop near X when you arrive" / "Bus stop you board near X")
- [x] Every distance names both ends (station near you, walk from destination, walk/drive leg from A to B)

## Real verdict: live drive time, car availability, ranges (done)
- [x] `driveTime` server function (`src/lib/drive.functions.ts`): TomTom routing with traffic + no-traffic times, traffic incidents in a padded bounding box, 3-minute cache, key stays server-side
- [x] Drive is queried for the current direction (outbound: home → destination, return: destination → home) and refetched every 3 minutes
- [x] Car tracking (`nalu-parked-v1`): home / station / destination; driving offered only when the car is where the trip starts, otherwise a plain reason is shown ("Your car is at …")
- [x] Verdict: rail total + 3 min buffer vs TomTom drive time only; under 5 min gap = "About the same"; long wait (>25 min) + car available = drive
- [x] Ranges instead of single numbers, worst case emphasised (drive: no-traffic → traffic; rail: transfer slip)
- [x] Reasoning line names the bottleneck (incident, long wait, worst connection wait, traffic delay)
- [x] Transfer radius raised to 0.75 mile (1207 m); a transfer walk over a quarter mile adds its walking time (3 mph) to the chain and appears as its own leg

## Trip progress awareness (done)
- [x] Active trip saved in `nalu-active-trip-v1` (start time, legs, direction, stops); started with "I'm on my way"
- [x] Location watched only while a trip is active; phase from distance (250 m) to boarding station, transfer station, destination, with the schedule as fallback
- [x] At the transfer station the rail leg is dropped and `connecting_departures(lat, lon, dest_stop, after_seconds)` recomputes the bus from the real position and time, with walk stop, distance, walk minutes and the next departures
- [x] Verdict, drive comparison, leave-by and later options hidden while a leg is underway
- [x] Manual "End trip"; auto-clear 10 min after arrival or 3 hours after start
- [x] Active feeder and transfer buses refresh from TheBus HEA every 30 seconds; delayed arrivals show scheduled versus live times, while missing GPS falls back to "Scheduled"

## Multi-stop destinations + honest drive range (done)
- plan_outbound evaluates every stop within 0.25 mi of the destination and adds the
  final walk into the chain total (migrations 0016, 0017). Return direction and the
  feeder/first leg already evaluated all stops within 0.5 mi with walk included.
- Drive range is traffic-centred: TomTom historic (typical) time is the low end,
  never free-flow. Delay shown plainly; verdict compares the displayed worst cases.

## Earliest arrival + door-to-door audit (done)
- Audit: every rail total already ran door to door (leave_by -> final arrival):
  planner total_minutes, the verdict range, the leave-by line and the timeline all
  include the first leg and the final walk. Browse mode lists station departures
  only, so it has no trip total to correct. Nothing measured station-to-destination.
- plan_outbound / plan_inbound now order options by earliest door arrival, latest
  possible leave-by breaking ties (0018). A later-departure option that arrives
  within 10 min is offered as a chip the rider can pick; never auto-selected.
- Peak-hour planning hit the 3s read timeout (the earlier intermittent failures).
  Transfer search is narrowed to stops actually served by routes reaching the
  destination, sampling 12 trips per route/direction to keep variant patterns
  (0019, 0020); read timeout raised to 10s (0021). 6:45 AM now answers in ~1s.

## Browse commute conditions (done)
- [x] Live H-1 eastbound and westbound delay conditions with a three-minute traffic cache and unavailable-data fallback
- [x] Single inline setup action between traffic conditions and nearest-station departures
- [x] Location-derived station with a data-derived West Oahu estimate and selector when location is unavailable
- [x] Three rail-only departures per physical direction, Honolulu time, compact countdown formatting, and no scheduled labels
- [x] Beginner-friendly train headings, data-derived line endpoints and ride times, plus H-1-aware Skyline context

## Weather awareness on outdoor legs (done)
- [x] `outdoorConditions` server fn: National Weather Service hourly forecast per coordinate
  (20-min cache, required User-Agent) plus AirNow current observation (1-hour cache,
  AIRNOW_API_KEY server-side). Every failure returns empty data; never blocks the plan.
- [x] Moments checked: feeder-bus wait, drive to station, rail platform wait, transfer walk,
  connecting-bus wait, final walk, full drive corridor. Rain >40% (>50% for driving),
  heat index >88°F, humidity >75% combined into one heat-and-humid line.
- [x] One air-quality line on the longest outdoor stretch over 5 min, Moderate or worse,
  never the raw number. Inline muted lines only (amber rain/humidity, orange heat,
  red/amber air) under the relevant leg; no cards, widgets or icons.

## Location permission recovery (done)
- [x] `src/lib/location-permission.ts`: `isPermissionDeniedError` (geolocation code 1),
  `queryLocationPermission` via the Permissions API, `detectLocationPlatform`
  (iOS / Android / desktop; iPadOS-as-Macintosh with touch). Covered by 9 Vitest tests.
- [x] Global denial tracking in `Index`: persisted under `nalu-location-denied-v1`,
  synced from `navigator.permissions` `onchange`, set when any geolocation call is denied.
- [x] `LocationBlockedCard` in setup (inline under "Use my location") and settings
  (LOCATION section): platform-specific recovery steps — iOS Safari aA → Website Settings,
  Chrome/Android tune/lock → Permissions, desktop lock → Site settings — with dismiss.
- [x] Browse mode shows "Location is blocked in your browser · how to allow it" linking to
  settings when the permission is denied.

## Local traffic incident wording (done)
- [x] Translate TomTom state-route codes into familiar Oahu road names.
- [x] Show contextual incident badges only in the Drive column; use incidents in verdict
  reasoning only when they support a rail recommendation.

## Walking station access (done)
- [x] Rename the setup action to GO.
- [x] Show a 3 mph walk estimate and distance to the selected station in setup and browse mode.
- [x] Show walking duration, distance, and platform arrival on commute access legs.

## Browse map and nearby transit
- [x] Replace browse setup CTAs with “WHERE TO”
- [x] Add a lightweight location map with current-position, rail, and bus markers
- [x] Show nearby stop distance, walk/drive ETA, and next scheduled arrivals
- [x] Verify mobile browse interactions, tests, and production build

## Commute route map
- [x] Show the selected door-to-door itinerary with start, end, transit stops, route line, and live GPS
- [x] Fit the map to the full trip and verify the configured commute view on mobile
- [x] Add recenter, fit-all, and standard/satellite controls to commute and nearby maps

## Decluttered commute screen
- [x] Replace the side-by-side comparison with a stacked verdict, map, and Rail/Drive switcher
- [x] Default details to the recommended mode while preserving itinerary, traffic, incidents, weather, alerts, settings, and trip controls
- [x] Condense two-way H-1 conditions into an expandable mobile summary

## Decluttered browse screen
- [x] Lead with a prominent WHERE TO search action and focused nearby map
- [x] Consolidate station access and two-way departures into one glanceable card
- [x] Move nearby arrivals, H-1 details, and weather/AQI into compact expandable sections
- [x] Keep all dialogs and popup controls above Browse and commute maps

## Map and departure polish
- [x] Use key-free OpenStreetMap standard tiles while retaining Esri satellite imagery
- [x] Default newly saved trips to outbound and clarify the WHERE TO? action
- [x] Keep labeled Start/End map pins above intermediate stops
- [x] Make alternative departures selectable with leave, arrival, duration, and delay details

## Complete audit and upgrade
- [x] Separate persistent places from optional transit access metadata, with safe legacy migration
- [x] Keep end-trip cleanup from deleting Home, Work, custom places, or preferences
- [x] Validate configured trips by exact origin/destination coordinates; transit can fail independently
- [x] Add portable places, drive, rail, and centralized decision modules
- [x] Use five-minute TomTom route caching and time-aware future routing for Arrive By
- [x] Keep Drive maps and copy strictly door-to-door and scope alternatives to Rail
- [x] Consolidate the rail station dataset and limit high-accuracy GPS to an active transit leg
- [x] Prevent automatic direction changes and repeated map bounds fitting

## Audit fixes and visual polish
- [x] Correlate TomTom incident geometry to the calculated road corridor
- [x] Explain passed Arrive By targets and show earliest feasible leave/arrival times
- [x] Add verdict-aware ocean radiance, glass metrics, winning-mode badges, and refined map chrome

## Dark maps and Browse radiance
- [x] Use CARTO Dark Matter tiles with proper attribution on both maps
- [x] Draw commute routes with a dark casing and glowing emerald core
- [x] Improve map marker contrast across standard and satellite layers
- [x] Extend ocean radiance, glass panels, ETA chips, and CTA depth to Browse mode

## Walking maps, routines, and optional accounts
- [x] Add collapsible walking micro-maps to access and egress steps
- [x] Add Honolulu-time Hawaiian greetings and one-tap routine starts in Browse
- [x] Add optional Google/email accounts with guest-preserving saved-place and preference sync
