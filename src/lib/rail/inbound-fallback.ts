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

type HubLeg = {
  kind: "access" | "rail" | "connect" | "egress";
  mode: "walk" | "drive" | "bus" | "rail";
  route_short: string | null; route_long: string | null; headsign: string | null;
  from: string | null; to: string | null;
  from_stop_id?: string | null | undefined; to_stop_id?: string | null | undefined;
  depart_seconds: number | null; arrive_seconds: number | null; minutes: number | null;
};
type HubOption = {
  leave_by_seconds: number; depart_seconds: number; arrive_seconds: number;
  total_minutes: number; legs: HubLeg[];
};

const MICRO_RAIL_HOP_MAX_MINUTES = 4;

/**
 * Rejects rail→bus chains where Skyline is only being used as a tiny hop before
 * a longer transfer wait. These chains are poor routing choices even when their
 * door-to-door arithmetic happens to look competitive.
 */
export function isTransferSane(option: {
  legs: Array<{
    mode: "walk" | "drive" | "bus" | "rail";
    kind?: "access" | "rail" | "connect" | "egress";
    minutes: number | null;
    depart_seconds: number | null;
    arrive_seconds: number | null;
  }>;
}) {
  for (let index = 0; index < option.legs.length; index += 1) {
    const rail = option.legs[index];
    if (!rail || rail.mode !== "rail") continue;

    const nextBus = option.legs
      .slice(index + 1)
      .find((leg) => leg.mode === "bus" && leg.depart_seconds !== null);

    if (!nextBus) continue;

    const railMinutes =
      rail.minutes ??
      (rail.depart_seconds !== null && rail.arrive_seconds !== null
        ? Math.max(0, (rail.arrive_seconds - rail.depart_seconds) / 60)
        : null);

    const transferWait =
      rail.arrive_seconds !== null && nextBus.depart_seconds !== null
        ? Math.max(0, (nextBus.depart_seconds - rail.arrive_seconds) / 60)
        : null;

    // A sub-4-minute Skyline leg is a micro-hop. If it feeds a bus egress,
    // there is no reason to force the rider onto rail for a single station.
    if (railMinutes !== null && railMinutes < MICRO_RAIL_HOP_MAX_MINUTES) return false;

    // Never make a rider wait longer for the bus than the rail ride that got
    // them there. Prefer the direct bus or a meaningful rail corridor run.
    if (
      railMinutes !== null &&
      transferWait !== null &&
      transferWait > railMinutes
    ) {
      return false;
    }
  }

  return true;
}

export function filterTransferSanityOptions<T extends {
  legs: Array<{
    mode: "walk" | "drive" | "bus" | "rail";
    kind?: "access" | "rail" | "connect" | "egress";
    minutes: number | null;
    depart_seconds: number | null;
    arrive_seconds: number | null;
  }>;
}>(options: T[]) {
  return options.filter(isTransferSane);
}

/** Rough road time to a rail hub: 1.35× straight-line at ~40 km/h (parking not included). */
export function estimateHubAccessMinutes(from: Point, hub: Point) {
  const km = Math.sqrt(distanceSquared(from, hub)) * 111.2;
  return Math.max(4, Math.round((km * 1.35 / 40) * 60));
}

/** Last resort when no station near the origin has a direct egress: board at
 * the rail station nearest the origin (derived from GTFS, never hardcoded),
 * plan its rail + home-side legs, and prepend an estimated road access leg. */
export async function hubAccessFallback(input: {
  origin: Point;
  stations: (InboundStation & { stop_name?: string | null })[];
  afterSeconds: number;
  fetchFromHub: (hub: Point & { stopId: string }, afterSeconds: number) => Promise<HubOption[]>;
}): Promise<HubOption[]> {
  const hubs = input.stations
    .filter((s) => s.stop_lat !== null && s.stop_lon !== null)
    .map((s) => ({ stopId: s.stop_id, name: s.stop_name ?? null, lat: Number(s.stop_lat), lon: Number(s.stop_lon) }))
    .filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lon))
    .sort((a, b) => distanceSquared(input.origin, a) - distanceSquared(input.origin, b))
    .slice(0, 2);
  for (const hub of hubs) {
    const access = estimateHubAccessMinutes(input.origin, hub);
    const options = await input.fetchFromHub(hub, input.afterSeconds + access * 60);
    if (!options.length) continue;
    return options.map((option) => {
      const legs = option.legs.filter((leg) => !(leg.kind === "access" && leg.mode === "walk" && (leg.minutes ?? 0) <= 1));
      const leave = option.depart_seconds - access * 60;
      return {
        ...option,
        leave_by_seconds: leave,
        total_minutes: Math.round((option.arrive_seconds - leave) / 60),
        legs: [{
          kind: "access", mode: "drive", route_short: null, route_long: null, headsign: null,
          from: null, to: hub.name, to_stop_id: hub.stopId,
          depart_seconds: leave, arrive_seconds: option.depart_seconds, minutes: access,
        }, ...legs],
      };
    });
  }
  return [];
}
