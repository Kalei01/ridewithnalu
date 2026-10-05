import type { Leg, Option } from "@/lib/commute-model";

/**
 * Bus → Skyline → bus. The general planner allows one transfer, so a trip
 * whose start and end are both far from a station (downtown → ʻEwa Beach,
 * say) never saw the train. This plans the two halves separately, origin →
 * the station nearest the origin, then station → destination (rail + bus),
 * and joins them with a short platform transfer.
 */

type Point = { lat: number; lon: number };
export type BridgeStation = { stop_id: string; stop_name?: string | null; stop_lat: unknown; stop_lon: unknown };

/** A station within this walk is reachable on foot; the rail planners already cover that. */
export const NEAR_STATION_M = 1600;
/** Farther than this, a bus ride to the station isn't a sensible first step. */
export const MAX_HUB_DISTANCE_M = 12_000;
/** Time to get from the bus stop onto the platform before the train counts. */
export const PLATFORM_BUFFER_S = 3 * 60;

export function metersBetween(a: Point, b: Point): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h));
}

function points(stations: BridgeStation[]) {
  return stations
    .map((s) => ({ stopId: s.stop_id, name: s.stop_name ?? "Skyline station", lat: Number(s.stop_lat), lon: Number(s.stop_lon) }))
    .filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lon));
}

/**
 * The station to bus to, or null when the bridge isn't needed: a station is
 * walkable at either end (other planners handle it), the nearest one is too
 * far, or going there would mean doubling back.
 */
export function bridgeStation(origin: Point, destination: Point, stations: BridgeStation[]) {
  const list = points(stations);
  if (!list.length) return null;
  const byOrigin = list.map((s) => ({ ...s, meters: metersBetween(origin, s) })).sort((a, b) => a.meters - b.meters);
  const nearestToDestination = Math.min(...list.map((s) => metersBetween(destination, s)));
  const hub = byOrigin[0]!;
  if (hub.meters <= NEAR_STATION_M || nearestToDestination <= NEAR_STATION_M) return null;
  if (hub.meters > MAX_HUB_DISTANCE_M) return null;
  if (metersBetween(hub, destination) >= metersBetween(origin, destination)) return null;
  return hub;
}

const isRide = (leg: Leg) => leg.mode === "bus" || leg.mode === "rail";

/** Join "origin → station" and "station → destination" into one trip, or null if they don't connect. */
export function joinAtStation(first: Option, second: Option, station: { stopId: string; name: string }): Option | null {
  if (!second.legs.some((leg) => leg.mode === "rail")) return null;
  if (second.depart_seconds < first.arrive_seconds + PLATFORM_BUFFER_S) return null;
  const lastRide = [...first.legs].reverse().find(isRide);
  if (!lastRide) return null;
  const egress = first.legs[first.legs.length - 1];
  const head = egress && egress.mode === "walk" && egress.kind === "egress" ? first.legs.slice(0, -1) : first.legs;
  const tail = second.legs[0]?.mode === "walk" && second.legs[0]?.kind === "access" ? second.legs.slice(1) : second.legs;
  const transfer: Leg = {
    kind: "connect",
    mode: "walk",
    route_short: null,
    route_long: null,
    headsign: null,
    from: lastRide.to,
    to: station.name,
    from_stop_id: lastRide.to_stop_id ?? null,
    to_stop_id: station.stopId,
    depart_seconds: lastRide.arrive_seconds,
    arrive_seconds: first.arrive_seconds,
    minutes: egress && egress !== lastRide && egress.mode === "walk" ? egress.minutes : 0,
  };
  return {
    leave_by_seconds: first.leave_by_seconds,
    depart_seconds: first.depart_seconds,
    arrive_seconds: second.arrive_seconds,
    total_minutes: Math.round((second.arrive_seconds - first.leave_by_seconds) / 60),
    legs: [...head, transfer, ...tail],
  };
}

export type GeneralSearch = (input: {
  from: Point;
  to: Point;
  afterSeconds: number;
  fromRadiusM: number;
  toRadiusM: number;
  limit: number;
}) => Promise<Option[]>;

/** Plan the bridge trip. Never throws: any failure just means no extra option. */
export async function planViaSkyline(input: {
  origin: Point;
  destination: Point;
  stations: BridgeStation[];
  afterSeconds: number;
  walkRadiusM: number;
  search: GeneralSearch;
}): Promise<Option[]> {
  try {
    const hub = bridgeStation(input.origin, input.destination, input.stations);
    if (!hub) return [];
    const toStation = await input.search({
      from: input.origin,
      to: hub,
      afterSeconds: input.afterSeconds,
      fromRadiusM: input.walkRadiusM,
      toRadiusM: 400,
      limit: 3,
    });
    // The two earliest ways to reach the station are enough to find the next trains.
    const firsts = [...toStation].sort((a, b) => a.arrive_seconds - b.arrive_seconds).slice(0, 2);
    const joined = await Promise.all(
      firsts.map(async (first) => {
        const onward = await input.search({
          from: hub,
          to: input.destination,
          afterSeconds: first.arrive_seconds + PLATFORM_BUFFER_S,
          fromRadiusM: 300,
          toRadiusM: input.walkRadiusM,
          limit: 3,
        });
        return onward.map((second) => joinAtStation(first, second, hub)).filter((o): o is Option => o !== null);
      }),
    );
    return joined.flat();
  } catch {
    return [];
  }
}
