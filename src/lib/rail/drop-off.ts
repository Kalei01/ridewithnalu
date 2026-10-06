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

/**
 * Stations worth trying as the pickup point on the way home. The car only
 * covers the last stretch, so the stations nearest home come first whichever
 * side of home they are on (the line's end can lie past it, e.g. East Kapolei
 * or UH West Oʻahu for ʻEwa Beach), then the ones that make the most progress
 * from where the rider starts. Each is timed with real trips and live traffic
 * and the comparison decides; nothing is assumed.
 */
export function pickupCandidates<T extends Station>(
  home: Point,
  origin: Point,
  stations: T[],
  max = 4,
): T[] {
  if (home.lat == null || home.lon == null) return [];
  const here = { lat: home.lat, lon: home.lon };
  const nearHome = stations
    .filter((station) => station.stop_lat != null && station.stop_lon != null)
    .map((station) => ({
      station,
      metres: metresBetween(here, {
        lat: Number(station.stop_lat),
        lon: Number(station.stop_lon),
      }),
    }))
    // Past walking range: closer than that, the rider just walks home.
    .filter((item) => item.metres > WALKABLE_M)
    .sort((a, b) => a.metres - b.metres)
    .slice(0, 2)
    .map((item) => item.station);
  const progress = dropOffCandidates(home, origin, stations, 2);
  return [...nearHome, ...progress]
    .filter(
      (station, index, list) => list.findIndex((s) => s.stop_id === station.stop_id) === index,
    )
    .slice(0, max);
}
