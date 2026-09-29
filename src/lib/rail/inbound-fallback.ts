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
  const alternates = input.stations
    .filter((station) =>
      station.stop_id !== input.primaryStationId &&
      station.stop_lat !== null && station.stop_lon !== null &&
      Number.isFinite(Number(station.stop_lat)) && Number.isFinite(Number(station.stop_lon)),
    )
    .sort((a, b) =>
      distanceSquared(input.destination, { lat: Number(a.stop_lat), lon: Number(a.stop_lon) }) -
      distanceSquared(input.destination, { lat: Number(b.stop_lat), lon: Number(b.stop_lon) }),
    )
    .slice(0, Math.max(0, Math.min(4, input.maxAlternates ?? 3)));
  const candidates = [input.primaryStationId, ...alternates.map((station) => station.stop_id)]
    .filter((stationId): stationId is string => Boolean(stationId));
  for (const stationId of new Set(candidates)) {
    const options = await input.fetchAtStation(stationId);
    if (options.length > 0) return { options, stationId };
  }
  return { options: [], stationId: input.primaryStationId };
}
