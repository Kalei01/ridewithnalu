/** Use TomTom's primary traffic-aware route ETA for both live and future trips. */
export function routeTravelSeconds(
  summary: {
    travelTimeInSeconds: number;
    liveTrafficIncidentsTravelTimeInSeconds?: number | undefined;
  },
  _futureDeparture: boolean,
): number {
  return summary.travelTimeInSeconds;
}
