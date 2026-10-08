import { isParkAndRide, nearestParkAndRide } from "@/lib/rail/park-and-ride";

type Point = { lat: number | null; lon: number | null };
type Station = {
  stop_id: string;
  stop_lat: number | string | null;
  stop_lon: number | string | null;
};

/** One boarding station the outbound Skyline search tries, and whether a car may reach it. */
export type OutboundStation = { stopId: string; allowDrive: boolean };

/**
 * The stations an outbound trip is searched from, in search order: the home
 * station (by car too when one is available: the station nearest home is often
 * the best place to be dropped off even with no lot), the nearest station with
 * a lot (e.g. ʻEwa Beach: Kualakaʻi, or UH West Oʻahu), then the drop-off
 * stations. Each station once.
 */
export function outboundStations<T extends Station>(input: {
  homeStopId: string;
  vehicle: boolean;
  origin: Point;
  browseStations: T[];
  dropOffStations: T[];
}): OutboundStation[] {
  const { homeStopId: home, vehicle, origin, browseStations, dropOffStations } = input;
  const parkStation =
    vehicle && !isParkAndRide(home) ? nearestParkAndRide(origin, browseStations) : null;
  const list: OutboundStation[] = [{ stopId: home, allowDrive: vehicle }];
  const queried = new Set([home, parkStation?.stop_id]);
  if (parkStation && parkStation.stop_id !== home)
    list.push({ stopId: parkStation.stop_id, allowDrive: true });
  for (const station of dropOffStations) {
    if (!queried.has(station.stop_id)) list.push({ stopId: station.stop_id, allowDrive: true });
  }
  return list;
}
