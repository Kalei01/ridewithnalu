/**
 * Parking allowances: the time between the car stopping and the commuter
 * standing at the door (garage queue, circling for a stall, elevator, walk
 * from the structure), only in the areas where that genuinely takes time.
 * Road time never includes this. Transit trips already count their walk from
 * the stop, so a drive downtown counts its walk from the garage.
 *
 * Zones are coarse Oʻahu geography, not route or station data.
 */

import { regionTimeZone } from "@/lib/region";
export type AccessZone =
  "downtown" | "kakaako-ala-moana" | "waikiki" | "campus" | "urban" | "suburban" | "residential";

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
  // Everywhere else the car parks at or near the door (a driveway, the
  // street, a store's own lot), so nothing is added: the drive time is the
  // live driving time, the same thing map apps show. Adding a few minutes
  // "just in case" here inflated drives to homes across Honolulu.
  urban: { label: "Park at your destination", lowMin: 0, typicalMin: 0, highMin: 0 },
  suburban: { label: "Park at your destination", lowMin: 0, typicalMin: 0, highMin: 0 },
  residential: { label: "Park at the door", lowMin: 0, typicalMin: 0, highMin: 0 },
};

// Nights (before 6 AM, from 6 PM) and Sundays: downtown, campus and Kakaʻako
// garages and meters are far emptier, so the walk-in is shorter. Waikīkī stays
// busy at night and keeps its daytime buffer.
const QUIET_BUFFERS: Partial<Record<AccessZone, Omit<DestinationAccess, "zone">>> = {
  downtown: { label: "Downtown parking & walk", lowMin: 2, typicalMin: 4, highMin: 7 },
  campus: { label: "Campus parking & walk", lowMin: 2, typicalMin: 4, highMin: 6 },
  "kakaako-ala-moana": { label: "Parking & walk", lowMin: 2, typicalMin: 4, highMin: 6 },
};

/** Honolulu clock: Sunday all day, or before 6 AM / from 6 PM any day. */
export function isQuietParkingTime(at: Date): boolean {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: regionTimeZone(),
    weekday: "short",
    hour: "numeric",
    hourCycle: "h23",
  }).formatToParts(at);
  const weekday = parts.find((part) => part.type === "weekday")?.value;
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 12);
  return weekday === "Sun" || hour < 6 || hour >= 18;
}

export function accessZoneFor(lat: number, lon: number): AccessZone {
  for (const box of ZONES) {
    if (lat >= box.minLat && lat <= box.maxLat && lon >= box.minLon && lon <= box.maxLon)
      return box.zone;
  }
  return "suburban";
}

/**
 * A saved "home" is always residential: the car parks at the door. Pass the
 * arrival time to use the shorter night/Sunday buffer where it applies.
 */
export function destinationAccess(
  point: { lat: number | null; lon: number | null },
  placeKind?: string | null,
  at?: Date,
): DestinationAccess {
  if (placeKind === "home") return { zone: "residential", ...BUFFERS.residential };
  if (point.lat === null || point.lon === null) return { zone: "suburban", ...BUFFERS.suburban };
  const zone = accessZoneFor(point.lat, point.lon);
  const quiet = at && isQuietParkingTime(at) ? QUIET_BUFFERS[zone] : undefined;
  return { zone, ...(quiet ?? BUFFERS[zone]) };
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
