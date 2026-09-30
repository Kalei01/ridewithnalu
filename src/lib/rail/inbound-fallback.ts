export type InboundStation = {
  stop_id: string;
  stop_lat: number | null;
  stop_lon: number | null;
};

type Point = { lat: number; lon: number };

function distanceSquared(a: Point, b: Point) {
  // Longitudes are shorter at Oʻahu's latitude. Ranking needs no square root.
  const lat = a.lat - b.lat;
  const lon = (a.lon - b.lon) * Math.cos((a.lat * Math.PI) / 180);
  return lat * lat + lon * lon;
}

/** Try a few nearby arrival stations only when the selected station has no trip.
 * A nonempty planner result proves both rail service and an egress leg to the door. */
export async function findInboundOptions<T>(input: {
  primaryStationId: string | null;
  stations: InboundStation[];
  destination: Point;
  fetchAtStation: (stationId: string) => Promise<T[]>;
  maxAlternates?: number;
}): Promise<{ options: T[]; stationId: string | null }> {
  const ranked = input.stations
    .filter((station) =>
      station.stop_id !== input.primaryStationId &&
      station.stop_lat !== null && station.stop_lon !== null &&
      Number.isFinite(Number(station.stop_lat)) && Number.isFinite(Number(station.stop_lon)),
    )
    .sort((a, b) =>
      distanceSquared(input.destination, { lat: Number(a.stop_lat), lon: Number(a.stop_lon) }) -
      distanceSquared(input.destination, { lat: Number(b.stop_lat), lon: Number(b.stop_lon) }),
    );
  const nearCount = Math.max(0, Math.min(4, input.maxAlternates ?? 3));
  const candidates = [input.primaryStationId, ...ranked.slice(0, nearCount).map((s) => s.stop_id)]
    .filter((stationId): stationId is string => Boolean(stationId));
  const tried = new Set<string>();
  for (const stationId of candidates) {
    if (tried.has(stationId)) continue;
    tried.add(stationId);
    const options = await input.fetchAtStation(stationId);
    if (options.length > 0) return { options, stationId };
  }
  // Last resort: the nearest stations may have no direct egress (0 access legs).
  // Walk further out along the active line — e.g. a Hālawa-area station with a
  // bus connection — in distance order, capped to keep request count bounded.
  for (const station of ranked.slice(nearCount, nearCount + 6)) {
    if (tried.has(station.stop_id)) continue;
    tried.add(station.stop_id);
    const options = await input.fetchAtStation(station.stop_id);
    if (options.length > 0) return { options, stationId: station.stop_id };
  }
  return { options: [], stationId: input.primaryStationId };
}
