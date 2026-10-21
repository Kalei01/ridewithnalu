/**
 * Mapbox Directions (v5, `driving-traffic` profile) as the fallback drive-time
 * provider when TomTom refuses (403 quota), is rate limited, errors or times out.
 *
 * Written against Mapbox's documented response:
 *   routes[0] = { duration, duration_typical?, distance,
 *                 geometry: GeoJSON LineString (overview=full, geometries=geojson),
 *                 legs: [{ annotation?: { congestion?: string[] },
 *                          steps: [{ distance, name, ref?, maneuver:
 *                                    { location:[lon,lat], type, modifier?, instruction } }] }] }
 * `duration` already includes live traffic on the driving-traffic profile.
 * `duration_typical` is used only when the response actually carries it.
 *
 * Pure parsing lives here so it can be tested with a fixture; the network call
 * is `fetchMapboxRoute`. The token is the public Mapbox token already used for
 * the map; it is URL-restricted, so the request sends the site as Referer.
 */
import { countCall, quotaSpent } from "./tomtom-guard";

type LatLon = { lat: number; lon: number };

/** Same shape as TomTom Orbis instructions, so the existing maneuver/corridor code reads both. */
export type MapboxInstructionLike = {
  routeOffsetInMeters: number;
  maneuverPoint: { latitude: number; longitude: number };
  maneuver: string;
  instructionMessage: string;
  nextRoadInformation: {
    streetName?: { text: string };
    roadShields?: Array<{ roadNumber: { text: string } }>;
  };
};

export type MapboxRoute = {
  liveSeconds: number;
  /** Present only when Mapbox returned `duration_typical`. */
  typicalSeconds: number | null;
  meters: number;
  path: LatLon[];
  /** Congested runs as indexes into `path` (inclusive start, exclusive end handled by the caller). */
  congestion: Array<{ start: number; end: number; severity: "moderate" | "heavy" }>;
  instructions: MapboxInstructionLike[];
};

type MapboxStep = {
  distance?: number;
  name?: string;
  ref?: string;
  maneuver?: {
    location?: [number, number];
    type?: string;
    modifier?: string;
    instruction?: string;
  };
};

type MapboxPayload = {
  code?: string;
  routes?: Array<{
    duration?: number;
    duration_typical?: number;
    distance?: number;
    geometry?: { coordinates?: Array<[number, number]> };
    legs?: Array<{ steps?: MapboxStep[]; annotation?: { congestion?: string[] } }>;
  }>;
};

export const MAPBOX_DIRECTIONS_URL = "https://api.mapbox.com/directions/v5/mapbox/driving-traffic";

const fix = (v: number) => (Math.round(v * 1e6) / 1e6).toString();

export function buildMapboxUrl(
  data: {
    fromLat: number;
    fromLon: number;
    toLat: number;
    toLon: number;
    departureTime?: string | undefined;
    bearing?: number | undefined;
  },
  token: string,
  nowMs = Date.now(),
): string {
  const params = new URLSearchParams({
    alternatives: "false",
    overview: "full",
    geometries: "geojson",
    steps: "true",
    annotations: "congestion",
    language: "en",
    access_token: token,
  });
  if (data.bearing !== undefined) params.set("bearings", `${Math.round(data.bearing % 360)},45;`);
  if (data.departureTime) {
    const at = new Date(data.departureTime).getTime();
    if (Number.isFinite(at) && at > nowMs + 60_000) {
      params.set("depart_at", new Date(at).toISOString().replace(/\.\d{3}Z$/, "Z"));
    }
  }
  const coords = `${fix(data.fromLon)},${fix(data.fromLat)};${fix(data.toLon)},${fix(data.toLat)}`;
  return `${MAPBOX_DIRECTIONS_URL}/${coords}?${params.toString()}`;
}

/** Mapbox maneuver type + modifier → the TomTom-style codes the nav HUD and voice already understand. */
export function mapboxManeuverCode(type: string, modifier: string | undefined): string | null {
  if (type === "depart") return null;
  if (type === "arrive") return "ARRIVE";
  const m = (modifier ?? "").toLowerCase();
  const side = m.includes("left") ? "LEFT" : m.includes("right") ? "RIGHT" : null;
  if (type === "off ramp") return side ? `MOTORWAY_EXIT_${side}` : "TAKE_EXIT";
  if (type === "on ramp") return "ENTER_MOTORWAY";
  if (type === "fork") return side ? `KEEP_${side}` : "STRAIGHT";
  if (type.includes("roundabout") || type.includes("rotary")) return "ROUNDABOUT_CROSS";
  if (m === "uturn") return "MAKE_UTURN";
  if (m === "sharp left") return "SHARP_LEFT";
  if (m === "sharp right") return "SHARP_RIGHT";
  if (m === "slight left") return "BEAR_LEFT";
  if (m === "slight right") return "BEAR_RIGHT";
  if (m === "left") return "TURN_LEFT";
  if (m === "right") return "TURN_RIGHT";
  // merge / new name / continue / notification with no turn: keep going.
  return "STRAIGHT";
}

function runsOf(congestion: string[]): MapboxRoute["congestion"] {
  const out: MapboxRoute["congestion"] = [];
  let start = -1;
  let severity: "moderate" | "heavy" | null = null;
  const level = (value: string | undefined): "moderate" | "heavy" | null =>
    value === "heavy" || value === "severe" ? "heavy" : value === "moderate" ? "moderate" : null;
  const close = (end: number) => {
    if (severity && start >= 0 && end - start >= 2) out.push({ start, end, severity });
    start = -1;
    severity = null;
  };
  for (let i = 0; i < congestion.length; i += 1) {
    const here = level(congestion[i]);
    if (here !== severity) {
      close(i);
      if (here) {
        start = i;
        severity = here;
      }
    }
  }
  close(congestion.length);
  return out.slice(0, 12);
}

/** Reads a Mapbox Directions response. Null when it holds no usable route. */
export function parseMapboxRoute(payload: MapboxPayload | null | undefined): MapboxRoute | null {
  if (!payload || (payload.code && payload.code !== "Ok")) return null;
  const route = payload.routes?.[0];
  if (!route || typeof route.duration !== "number" || !(route.duration > 0)) return null;
  const coordinates = route.geometry?.coordinates ?? [];
  const path = coordinates.map(([lon, lat]) => ({ lat, lon }));
  if (path.length < 2) return null;

  const instructions: MapboxInstructionLike[] = [];
  let offset = 0;
  for (const step of route.legs?.flatMap((leg) => leg.steps ?? []) ?? []) {
    const type = step.maneuver?.type ?? "";
    const code = mapboxManeuverCode(type, step.maneuver?.modifier);
    const location = step.maneuver?.location;
    if (location && typeof location[0] === "number" && typeof location[1] === "number") {
      const refs = (step.ref ?? "")
        .split(";")
        .map((r) => r.trim())
        .filter(Boolean);
      instructions.push({
        routeOffsetInMeters: offset,
        maneuverPoint: { latitude: location[1], longitude: location[0] },
        // The depart step is kept (road names for the corridor) under a DEPART code buildManeuvers skips.
        maneuver: code ?? "DEPART",
        instructionMessage: step.maneuver?.instruction ?? "",
        nextRoadInformation: {
          ...(step.name ? { streetName: { text: step.name } } : {}),
          ...(refs.length ? { roadShields: refs.map((text) => ({ roadNumber: { text } })) } : {}),
        },
      });
    }
    offset += step.distance ?? 0;
  }

  // Per-segment congestion only lines up with a single-leg route's full geometry.
  const congestionList =
    route.legs?.length === 1 ? (route.legs[0]?.annotation?.congestion ?? []) : [];
  const congestion = congestionList.length === path.length - 1 ? runsOf(congestionList) : [];

  const typical = route.duration_typical;
  return {
    liveSeconds: route.duration,
    typicalSeconds: typeof typical === "number" && typical > 0 ? typical : null,
    meters: route.distance ?? 0,
    path,
    congestion,
    instructions,
  };
}

export function mapboxToken(): string {
  return (
    process.env["MAPBOX_ACCESS_TOKEN"] ??
    (import.meta.env["VITE_LOVABLE_CONNECTOR_MAPBOX_PUBLIC_TOKEN"] as string | undefined) ??
    ""
  );
}

let lastMapboxFailure: string | null = null;
export function lastMapboxFailureReason(): string | null {
  return lastMapboxFailure;
}

const inflight = new Map<string, Promise<MapboxRoute | null>>();

/**
 * One Mapbox Directions request. Null (never throws) when unavailable, spent, or unreadable.
 * Mapbox terms forbid caching or storing Directions results: nothing is kept after the
 * response is delivered. Only identical requests in flight at the same moment share one call.
 */
export function fetchMapboxRoute(
  data: {
    fromLat: number;
    fromLon: number;
    toLat: number;
    toLon: number;
    departureTime?: string | undefined;
    bearing?: number | undefined;
  },
  fetcher: typeof fetch = fetch,
): Promise<MapboxRoute | null> {
  const key = JSON.stringify([
    data.fromLat,
    data.fromLon,
    data.toLat,
    data.toLon,
    data.departureTime ?? null,
    data.bearing ?? null,
  ]);
  const running = inflight.get(key);
  if (running) return running;
  const task = requestMapboxRoute(data, fetcher).finally(() => inflight.delete(key));
  inflight.set(key, task);
  return task;
}

async function requestMapboxRoute(
  data: {
    fromLat: number;
    fromLon: number;
    toLat: number;
    toLon: number;
    departureTime?: string | undefined;
    bearing?: number | undefined;
  },
  fetcher: typeof fetch = fetch,
): Promise<MapboxRoute | null> {
  const token = mapboxToken();
  if (!token) {
    lastMapboxFailure = "no Mapbox token";
    return null;
  }
  if (quotaSpent("mapboxDirections")) {
    lastMapboxFailure = "Mapbox monthly allowance nearly used (this server's count)";
    return null;
  }
  try {
    countCall("mapboxDirections");
    const response = await fetcher(buildMapboxUrl(data, token), {
      signal: AbortSignal.timeout(8000),
      headers: { Referer: "https://ridenalu.com/" },
    });
    if (!response.ok) {
      lastMapboxFailure = `Mapbox HTTP ${response.status}`;
      console.error(`[drive] Mapbox directions returned ${response.status}`);
      return null;
    }
    const route = parseMapboxRoute((await response.json()) as MapboxPayload);
    lastMapboxFailure = route ? null : "Mapbox returned no route";
    return route;
  } catch (error) {
    lastMapboxFailure = `Mapbox ${error instanceof Error ? error.name : "error"}`;
    console.error("[drive] Mapbox directions failed", error instanceof Error ? error.name : "error");
    return null;
  }
}
