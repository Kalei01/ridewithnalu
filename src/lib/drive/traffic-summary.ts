/** The departAt route time is time-dependent; a live-speed field is for a trip now. */
export function routeTravelSeconds(
  summary: {
    travelTimeInSeconds: number;
    liveTrafficIncidentsTravelTimeInSeconds?: number | undefined;
  },
  futureDeparture: boolean,
): number {
  return futureDeparture
    ? summary.travelTimeInSeconds
    : (summary.liveTrafficIncidentsTravelTimeInSeconds ?? summary.travelTimeInSeconds);
}
