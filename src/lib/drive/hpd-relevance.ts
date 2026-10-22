/**
 * Geometry helpers for deciding whether a police report is on a rider's route
 * and which way the route runs there. Pure; shared by the server (what to list)
 * and the client (what to announce).
 */
import { bearingBetween, matchRoutePoint, metersBetween } from "../navigation-voice";
import type { GeoPoint } from "./incident-correlation";

const WINDOW_M = 120;

/** Distance from a point to the route line, and where on the route it falls. */
export function routeMatch(point: GeoPoint, path: ReadonlyArray<GeoPoint>) {
  const match = matchRoutePoint(point, path as GeoPoint[]);
  return match
    ? { distanceM: match.distanceM, snapped: match.point, segmentIndex: match.segmentIndex }
    : null;
}

/**
 * Direction of travel along the route at a segment, measured over about 120 m
 * each way so a short kink in the geometry does not decide it.
 */
export function routeBearingAtSegment(
  path: ReadonlyArray<GeoPoint>,
  segmentIndex: number,
): number | null {
  if (path.length < 2) return null;
  let a = Math.max(0, Math.min(segmentIndex, path.length - 2));
  let b = a + 1;
  while (a > 0 && metersBetween(path[a]!, path[segmentIndex]!) < WINDOW_M) a -= 1;
  while (b < path.length - 1 && metersBetween(path[segmentIndex + 1]!, path[b]!) < WINDOW_M) b += 1;
  if (metersBetween(path[a]!, path[b]!) < 5) return null;
  return bearingBetween(path[a]!, path[b]!);
}

export function routeBearingAt(point: GeoPoint, path: ReadonlyArray<GeoPoint>): number | null {
  const match = routeMatch(point, path);
  return match ? routeBearingAtSegment(path, match.segmentIndex) : null;
}
