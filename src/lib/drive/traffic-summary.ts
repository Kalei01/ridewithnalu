/**
 * Select the drive ETA using TomTom's primary traffic-aware estimate, but only
 * widen it when the separate live-speed estimate is materially worse and the
 * route's reported traffic delay corroborates that slowdown.
 */
export function routeTravelSeconds(
  summary: {
    travelTimeInSeconds: number;
    liveTrafficIncidentsTravelTimeInSeconds?: number | undefined;
    trafficDelayInSeconds?: number | undefined;
  },
  _futureDeparture: boolean,
): number {
  const primary = summary.travelTimeInSeconds;
  const live = summary.liveTrafficIncidentsTravelTimeInSeconds;
  const delay = summary.trafficDelayInSeconds ?? 0;

  if (!Number.isFinite(primary) || primary <= 0) return primary;
  if (!Number.isFinite(live) || live <= primary) return primary;

  const liveGap = live - primary;
  const corroborated = delay >= 5 * 60 && liveGap >= 5 * 60 && delay >= liveGap * 0.5;

  return corroborated ? live : primary;
}
