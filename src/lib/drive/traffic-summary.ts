/**
 * Select TomTom's drive ETA without allowing a materially slower live-speed
 * estimate to be discarded for a current trip. Future departures keep the
 * primary time-dependent estimate because the live-speed value is not relevant
 * to that future departure.
 */
export function routeTravelSeconds(
  summary: {
    travelTimeInSeconds: number;
    liveTrafficIncidentsTravelTimeInSeconds?: number | undefined;
  },
  futureDeparture: boolean,
): number {
  const primary = summary.travelTimeInSeconds;
  const live = summary.liveTrafficIncidentsTravelTimeInSeconds;
  if (futureDeparture || !Number.isFinite(live) || live <= primary) return primary;

  // Require a meaningful disagreement before letting the live-speed signal
  // widen the current ETA. This avoids reacting to tiny provider noise.
  const liveGapSeconds = live - primary;
  return liveGapSeconds >= 5 * 60 ? live : primary;
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
