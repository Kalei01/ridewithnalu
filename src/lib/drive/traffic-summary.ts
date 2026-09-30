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

  // For a future departure, use TomTom's time-dependent primary estimate.
  if (futureDeparture) return primary;

  // For a live trip, TomTom also exposes a second route-time calculation that
  // incorporates currently reported live traffic incidents. In practice the
  // primary ETA can lag that incident-aware value on a congested corridor.
  // Use the higher of the two so Nalu does not present an artificially short
  // ETA when TomTom itself is reporting a longer incident-aware travel time.
  // Never replace the primary estimate outright: the incident-aware value is
  // an additional signal, not a universally better route model.
  if (typeof live === "number" && Number.isFinite(live) && live > 0) {
    return Math.max(primary, live);
  }
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
