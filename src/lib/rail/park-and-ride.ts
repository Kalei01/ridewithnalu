/**
 * Skyline stations with a park-and-ride lot. Source: City and County of
 * Honolulu, Skyline "Stations and Parking" page and station pages (checked
 * October 5, 2026): Keoneʻae (304 stalls), Honouliuli (344), Hālawa (590) and
 * Kahauiki (95). Every other station has no rider parking, so Nalu never plans
 * "drive to the station" to one of them. Keys are TheBus GTFS stop ids.
 */
export const PARK_AND_RIDE_STOP_IDS: ReadonlySet<string> = new Set([
  "10046", // Keoneʻae (UH West Oʻahu)
  "10045", // Honouliuli (Hoʻopili)
  "10055", // Hālawa (Aloha Stadium)
  "10030", // Kahauiki (Kalihi Transit Center)
]);

export const isParkAndRide = (stopId: string | null | undefined) => Boolean(stopId && PARK_AND_RIDE_STOP_IDS.has(stopId));

type Point = { lat: number | null; lon: number | null };
type Station = { stop_id: string; stop_lat: number | string | null; stop_lon: number | string | null };

/** Straight-line metres between two points (good enough at Oʻahu's scale). */
export function metresBetween(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const dLat = (b.lat - a.lat) * 111_200;
  const dLon = (b.lon - a.lon) * 111_200 * Math.cos((a.lat * Math.PI) / 180);
  return Math.hypot(dLat, dLon);
}

/** The park-and-ride station closest to `origin`, from the loaded rail stations. */
export function nearestParkAndRide<T extends Station>(origin: Point, stations: T[]): T | null {
  if (origin.lat == null || origin.lon == null) return null;
  const from = { lat: origin.lat, lon: origin.lon };
  let best: { station: T; metres: number } | null = null;
  for (const station of stations) {
    if (!isParkAndRide(station.stop_id) || station.stop_lat == null || station.stop_lon == null) continue;
    const metres = metresBetween(from, { lat: Number(station.stop_lat), lon: Number(station.stop_lon) });
    if (!best || metres < best.metres) best = { station, metres };
  }
  return best?.station ?? null;
}

type DriveAccessOption = { legs: Array<{ kind?: string; mode: string; to_stop_id?: string | null | undefined }> };

/** Drop trips that start by driving to a station with no park-and-ride lot. */
export function dropDriveToStationsWithoutParking<T extends DriveAccessOption>(options: T[]): T[] {
  return options.filter((option) => {
    const first = option.legs[0];
    return !first || first.mode !== "drive" || isParkAndRide(first.to_stop_id);
  });
}
