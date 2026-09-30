/** Select TomTom's traffic estimate for the trip being evaluated. */
export function routeTravelSeconds(
  summary: {
    travelTimeInSeconds: number;
    liveTrafficIncidentsTravelTimeInSeconds?: number | undefined;
  },
  futureDeparture: boolean,
): number {
  const primary = summary.travelTimeInSeconds;
  const live = summary.liveTrafficIncidentsTravelTimeInSeconds;

  // TomTom's primary travelTimeInSeconds already includes available traffic
  // delay. The live-speed field is a diagnostic real-time-speed signal, not a
  // replacement for the full traffic-aware route estimate. Using it alone can
  // understate congestion on a route, so the canonical ETA is the primary
  // traffic-aware estimate for current trips too.
  // Future departures also use the primary time-dependent estimate.
  if (futureDeparture) return primary;
  return primary;
}

/** Human-friendly commute duration: 65 -> "1 hr 5 min", 60 -> "1 hr". */
export function formatDriveMinutes(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  if (total < 60) return `${total} min`;
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  if (mins === 0) return `${hours} hr${hours === 1 ? "" : "s"}`;
  return `${hours} hr${hours === 1 ? "" : "s"} ${mins} min`;
}
