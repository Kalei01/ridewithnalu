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

  // For a live trip, TomTom explicitly exposes a second estimate based on
  // real-time speed data. Prefer that live model when it is present. This
  // avoids silently preferring the primary estimate when the live traffic
  // model has already detected a materially slower corridor.
  if (typeof live === "number" && Number.isFinite(live) && live > 0) {
    return live;
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
