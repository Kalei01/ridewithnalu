import { metresBetween } from "@/lib/rail/park-and-ride";

type Point = { lat: number | null; lon: number | null };
type Station = {
  stop_id: string;
  stop_lat: number | string | null;
  stop_lon: number | string | null;
};

/** Within this straight-line distance a rider just walks to the station. */
const WALKABLE_M = 1600;
/** Each candidate costs a trip search and a live drive time, so keep the list short. */
const MAX_CANDIDATES = 3;

/**
 * Stations worth trying as a drop-off point. Nothing is assumed about where
 * the rider will be dropped: this only picks a few real stations that make
 * progress toward the destination (closest to the destination first, then nearest to
 * the rider, and one in between), and the trip search then times each one.
 * Whether any of them beats being driven all the way is decided by comparing
 * the actual itineraries.
 */
export function dropOffCandidates<T extends Station>(
  origin: Point,
  destination: Point,
  stations: T[],
  max = MAX_CANDIDATES,
): T[] {
  if (
    origin.lat == null ||
    origin.lon == null ||
    destination.lat == null ||
    destination.lon == null
  )
    return [];
  const from = { lat: origin.lat, lon: origin.lon };
  const to = { lat: destination.lat, lon: destination.lon };
  const direct = metresBetween(from, to);
  const options = stations
    .filter((station) => station.stop_lat != null && station.stop_lon != null)
    .map((station) => {
      const point = { lat: Number(station.stop_lat), lon: Number(station.stop_lon) };
      return {
        station,
        fromOrigin: metresBetween(from, point),
        toDestination: metresBetween(point, to),
      };
    })
    // Past walking range, and genuinely closer to the destination than the start.
    .filter((item) => item.fromOrigin > WALKABLE_M && item.toDestination < direct)
    .sort((a, b) => a.fromOrigin - b.fromOrigin);
  if (options.length <= max) return options.map((item) => item.station);

  const nearest = options[0]!;
  const closestToDestination = options.reduce((a, b) =>
    b.toDestination < a.toDestination ? b : a,
  );
  const middle = options[Math.floor(options.length / 2)]!;
  const picked = [closestToDestination, nearest, middle].filter(
    (item, index, list) => list.indexOf(item) === index,
  );
  return picked.slice(0, max).map((item) => item.station);
}
