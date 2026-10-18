import { SKYLINE_STOP_IDS } from "@/lib/rail/station-names";

/**
 * Splits fetched rail stations into the Skyline stations Nalu knows by name
 * (in line order, west to east) and anything else. The map draws only the
 * known ones; the rest are reported so a new station shows up as a warning,
 * not as a wrong name or a kinked line.
 */
export function splitSkylineStations<T extends { stopId: string }>(stations: T[]) {
  const known = stations
    .filter((station) => SKYLINE_STOP_IDS.includes(station.stopId))
    .sort((a, b) => SKYLINE_STOP_IDS.indexOf(a.stopId) - SKYLINE_STOP_IDS.indexOf(b.stopId));
  const unknown = stations.filter((station) => !SKYLINE_STOP_IDS.includes(station.stopId));
  return { known, unknown };
}
