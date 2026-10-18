/**
 * The two things the Browse sheet shows while it is closed (its "peek"): one
 * plain line about the road and one live number. Both come only from data the
 * Browse screen already has (the H-1 check and the nearest Skyline station's
 * schedule); nothing here is estimated or invented.
 */

type RoadCheck = { delayMinutes: number; incidents: unknown[] } | undefined;

export type PeekRoad = {
  /** Rounded delay over typical, 0 or more. */
  delay: number;
  /** An incident is reported on the route. */
  incident: boolean;
};

function read(check: RoadCheck): PeekRoad | null {
  if (!check) return null;
  return {
    delay: Math.max(0, Math.round(check.delayMinutes)),
    incident: check.incidents.length > 0,
  };
}

/** One line about H-1, from the live east and west checks. Null until at least one answered. */
export function h1PeekLine(east: RoadCheck, west: RoadCheck): string | null {
  const roads = [
    { name: "eastbound", road: read(east) },
    { name: "westbound", road: read(west) },
  ].filter((item): item is { name: string; road: PeekRoad } => item.road !== null);
  if (!roads.length) return null;
  const worst = roads.reduce((a, b) => (b.road.delay > a.road.delay ? b : a));
  if (worst.road.incident) return `H-1 ${worst.name}: incident reported`;
  if (worst.road.delay === 0)
    return roads.length === 2 ? "H-1 is clear both ways" : `H-1 ${worst.name} is clear`;
  return `H-1 ${worst.name}: +${worst.road.delay} min over typical`;
}

/** The next train at the rider's nearest station, as whole minutes away; null when none is scheduled. */
export function nextTrainMinutes(
  directions: { departure_seconds: number }[][],
  nowSeconds: number,
): number | null {
  const seconds = directions
    .map((direction) => direction[0]?.departure_seconds)
    .filter((value): value is number => typeof value === "number" && value >= nowSeconds - 30);
  if (!seconds.length) return null;
  return Math.max(0, Math.ceil((Math.min(...seconds) - nowSeconds) / 60));
}
