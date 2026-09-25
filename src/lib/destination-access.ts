/**
 * Door-to-door access buffers: the time between the car stopping moving and
 * the commuter actually standing at the door (garage queue, circling for a
 * stall, elevator, walk from the structure). Road time never includes this.
 *
 * Zones are coarse Oʻahu geography, not route or station data.
 */
export type AccessZone =
  | "downtown"
  | "kakaako-ala-moana"
  | "waikiki"
  | "campus"
  | "urban"
  | "suburban"
  | "residential";

export type DestinationAccess = {
  zone: AccessZone;
  label: string;
  lowMin: number;
  typicalMin: number;
  highMin: number;
};

type Box = { zone: AccessZone; minLat: number; maxLat: number; minLon: number; maxLon: number };

// Checked in order: the denser, more specific areas win over broad urban Honolulu.
const ZONES: Box[] = [
  { zone: "downtown", minLat: 21.3, maxLat: 21.318, minLon: -157.87, maxLon: -157.853 },
  { zone: "campus", minLat: 21.29, maxLat: 21.305, minLon: -157.825, maxLon: -157.81 },
  { zone: "kakaako-ala-moana", minLat: 21.286, maxLat: 21.302, minLon: -157.862, maxLon: -157.836 },
  { zone: "waikiki", minLat: 21.265, maxLat: 21.29, minLon: -157.84, maxLon: -157.812 },
  { zone: "urban", minLat: 21.26, maxLat: 21.36, minLon: -157.95, maxLon: -157.75 },
];

const BUFFERS: Record<AccessZone, Omit<DestinationAccess, "zone">> = {
  downtown: { label: "Downtown garage & walk", lowMin: 7, typicalMin: 10, highMin: 14 },
  campus: { label: "Campus parking & walk", lowMin: 7, typicalMin: 10, highMin: 13 },
  "kakaako-ala-moana": { label: "Parking structure & walk", lowMin: 5, typicalMin: 7, highMin: 10 },
  waikiki: { label: "Waikīkī parking & walk", lowMin: 7, typicalMin: 10, highMin: 14 },
  urban: { label: "Parking & walk", lowMin: 2, typicalMin: 4, highMin: 6 },
  suburban: { label: "Surface lot & walk", lowMin: 1, typicalMin: 2, highMin: 4 },
  residential: { label: "Park at the door", lowMin: 0, typicalMin: 1, highMin: 1 },
};

export function accessZoneFor(lat: number, lon: number): AccessZone {
  for (const box of ZONES) {
    if (lat >= box.minLat && lat <= box.maxLat && lon >= box.minLon && lon <= box.maxLon)
      return box.zone;
  }
  return "suburban";
}

/** A saved "home" is always residential: the car parks at the door. */
export function destinationAccess(
  point: { lat: number | null; lon: number | null },
  placeKind?: string | null,
): DestinationAccess {
  if (placeKind === "home") return { zone: "residential", ...BUFFERS.residential };
  if (point.lat === null || point.lon === null) return { zone: "suburban", ...BUFFERS.suburban };
  const zone = accessZoneFor(point.lat, point.lon);
  return { zone, ...BUFFERS[zone] };
}

export type ArrivalRange = {
  earliestSeconds: number;
  expectedSeconds: number;
  latestSeconds: number;
  roadMinutes: number;
  accessMinutes: number;
};

/** Door-to-door arrival window from a road-time range plus the access buffer. */
export function arrivalRange(
  startSeconds: number,
  road: { low: number; expected: number; high: number },
  access: DestinationAccess,
): ArrivalRange {
  const low = Math.min(road.low, road.expected);
  const high = Math.max(road.high, road.expected);
  return {
    earliestSeconds: startSeconds + (low + access.lowMin) * 60,
    expectedSeconds: startSeconds + (road.expected + access.typicalMin) * 60,
    latestSeconds: startSeconds + (high + access.highMin) * 60,
    roadMinutes: road.expected,
    accessMinutes: access.typicalMin,
  };
}
