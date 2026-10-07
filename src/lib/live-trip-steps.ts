import { clockFromSeconds, stationLabel, titleCase, transitStopName } from "@/lib/commute-formatting";
import { vehicleName, type Leg } from "@/lib/commute-model";

const isTransit = (leg: Leg | undefined) => leg?.mode === "bus" || leg?.mode === "rail";

/**
 * One plain sentence per leg of the planned itinerary, built from the real legs
 * (names, board times), e.g. "Walk to Lelepaua Station · board W Line 5:00 PM".
 */
export function liveTripSteps(legs: Leg[], arrivingHome = false): string[] {
  return legs.map((leg, index) => {
    const next = legs[index + 1];
    if (isTransit(leg)) {
      const arrive = leg.arrive_seconds !== null ? ` · arrive ${clockFromSeconds(leg.arrive_seconds)}` : "";
      return `Ride ${vehicleName(leg)} to ${transitStopName(leg, "to")}${arrive}`;
    }
    const verb = leg.mode === "drive" ? "Drive" : "Walk";
    const intoStop = isTransit(next);
    const place = intoStop
      ? next?.mode === "rail"
        ? `${stationLabel(leg.to) || "the"} Station`
        : titleCase(leg.to) || "the stop"
      : titleCase(leg.to) || (arrivingHome ? "home" : "your destination");
    const board =
      intoStop && next && next.depart_seconds !== null
        ? ` · board ${vehicleName(next).replace(/\s*\(toward .*\)$/, "")} ${clockFromSeconds(next.depart_seconds)}`
        : "";
    return `${verb} to ${place}${board}`;
  });
}

/** Index of the leg the rider is on right now: the first one that has not finished yet. */
export function currentLegIndex(legs: Leg[], nowSeconds: number): number {
  const index = legs.findIndex(
    (leg) => leg.arrive_seconds !== null && nowSeconds <= leg.arrive_seconds,
  );
  return index === -1 ? Math.max(0, legs.length - 1) : index;
}
