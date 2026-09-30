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

  // Current trips should use TomTom's real-time speed estimate when available.
  // Future departures must use the time-dependent primary estimate because
  // today's live-speed signal does not describe a future departure.
  if (futureDeparture) return primary;
  if (Number.isFinite(live) && (live as number) > 0) return live as number;
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
