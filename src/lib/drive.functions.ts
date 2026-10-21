import { createServerFn } from "@tanstack/react-start";
import { rateLimit } from "./rate-limit.server";
import { z } from "zod";
import { incidentTouchesRoute, type GeoPoint } from "./drive/incident-correlation";
import { bypassedCorridors, extractCorridor, type GuidanceInstruction } from "./drive/corridor";
import { incidentAffectsTrip, incidentCategoryLabel, localRoadName } from "./traffic-incidents";
import {
  LABEL_LOOKAHEAD_M,
  LABEL_MIN_AHEAD_M,
  localizeInstruction,
  localizeRoadLabel,
  routeBearingAfter,
} from "./local-directions";
import { distanceAlongPath } from "./navigation-voice";
import { lookupHdotLaneClosureRoutes, type HdotLaneClosureRoute, type HdotScheduledClosure, lookupHdotScheduledClosures } from "./hdot-lane-closures.functions";

// Per-visitor limits on paid lookups (see rate-limit.server.ts).
const driveLimit = rateLimit("drive", 150);

function tomtomKey() {
  return process.env["TOMTOM_API_KEY"] ?? "";
}

const schema = z.object({
  fromLat: z.number().min(-90).max(90),
  fromLon: z.number().min(-180).max(180),
  toLat: z.number().min(-90).max(90),
  toLon: z.number().min(-180).max(180),
  departureTime: z.string().datetime({ offset: true }).optional(),
  /** Direction of travel for an active reroute, so the route begins forward. */
  bearing: z.number().min(0).max(360).optional(),
  /** Active navigation and manual refreshes bypass the two-minute server cache. */
  forceRefresh: z.boolean().optional(),
  /**
   * Points on the road the rider is already on, so the route must pass through
   * them. Used to price "stay on my current road" with the same live traffic
   * as the fastest route (see route-commitment.ts). Never shown to riders.
   */
  via: z
    .array(
      z.object({
        lat: z.number().min(-90).max(90),
        lon: z.number().min(-180).max(180),
      }),
    )
    .max(2).optional(),
});

export type DriveIncident = {
  description: string;
  road: string | null;
  delayMinutes: number | null;
  /** TomTom's structured incident category when available. */
  category?: string | null;
  /** Start/end names for the affected stretch when TomTom provides them. */
  from?: string | null;
  to?: string | null;
  /** Expected incident end time when the provider supplies one. */
  endTime?: string | null;
  /** TomTom incident geometry, used to place the reported incident on the route map. */
  points?: Array<{ lat: number; lon: number }>;
  /** TomTom's incident id, so an alert is spoken once per incident. */
  id?: string | null;
  /** Nearby list only: geometry sits on the driven route (within ~90 m). */
  onRoute?: boolean;
};

export type DriveTime = {
  /** Travel time with current traffic, in minutes: the honest centre of the range. */
  trafficMinutes: number;
  /** What this trip usually takes at this time of day, from TomTom's historic profile. */
  typicalMinutes: number;
  /** TomTom's historic profile answered; otherwise typicalMinutes is just the live time (no "usual" to compare). */
  typicalChecked?: boolean;
  /** Minutes slower than usual right now (negative when it is running better). */
  delayMinutes: number;
  /** Low end of the plausible range. */
  lowMinutes: number;
  /** High end of the plausible range; the number a commuter should plan around. */
  highMinutes: number;
  meters: number;
  /** Road geometry of the driven route, for drawing the real corridor on a map. */
  path: Array<{ lat: number; lon: number }>;
  /** Congested stretches of the route, for colouring the drawn corridor. */
  trafficSections: DriveTrafficSection[];
  incidents: DriveIncident[];
  /**
   * Categorised incidents with a named place near (within ~1.5 km) but not
   * counted as delaying this route, e.g. an accident a reroute now avoids.
   * Reported facts only; they never change the drive time or any verdict.
   */
  nearbyIncidents?: DriveIncident[];
  /** Official HDOT lane-closure route segments intersecting this TomTom route. */
  hdotLaneClosures?: HdotLaneClosureRoute[];
  /** Official HDOT weekly scheduled closures relevant to this route. */
  hdotScheduledClosures?: HdotScheduledClosure[];
  /** Ordered major roads of this drive, e.g. "Via Kualakaʻi Pkwy → H-1 East". */
  corridorLabel: string | null;
  corridorRoads: string[];
  /** Congested nearby roads this route avoids entirely. */
  bypassedRoads: string[];
  /** Turn-by-turn maneuvers from TomTom guidance, for voice and the nav HUD. */
  maneuvers: Array<{ lat: number; lon: number; maneuver: string; instruction: string; road: string | null }>;
  fetchedAt: number;
  trafficBasis: "live" | "future-estimate";
  /** Only on a route priced through via points: which request shape TomTom accepted. */
  viaShape?: string;
};

export type DriveTrafficSection = {
  severity: "moderate" | "heavy";
  delayMinutes: number;
  points: Array<{ lat: number; lon: number }>;
};

const CACHE_MS = 2 * 60_000;
const MAX_CACHE_ENTRIES = 100;
const cache = new Map<string, DriveTime>();

function cacheDrive(key: string, value: DriveTime) {
  cache.delete(key);
  cache.set(key, value);
  while (cache.size > MAX_CACHE_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (typeof oldest !== "string") break;
    cache.delete(oldest);
  }
}

function round(value: number) {
  // ~10 m precision keeps the cache useful while the phone's GPS jitters.
  return Math.round(value * 10000) / 10000;
}

const ORBIS_ROUTE_URL = "https://api.tomtom.com/maps/orbis/routing/routes/calculate?apiVersion=3";

/** One cache key per trip ends, departure (5-min bucket) and heading. */
function driveCacheKey(data: z.infer<typeof schema>) {
  const from = `${round(data.fromLat)},${round(data.fromLon)}`;
  const to = `${round(data.toLat)},${round(data.toLon)}`;
  const departureBucket = data.departureTime
    ? Math.floor(new Date(data.departureTime).getTime() / (5 * 60_000))
    : "now";
  const headingBucket =
    data.bearing === undefined ? "none" : Math.round((data.bearing % 360) / 15) * 15;
  const via = (data.via ?? []).map((p) => `${round(p.lat)},${round(p.lon)}`).join(";");
  return `${from}:${to}:${departureBucket}:${headingBucket}${via ? `:via=${via}` : ""}`;
}

/** The live (or future-estimate) route request, the same for every caller. */
function orbisRouteBody(data: z.infer<typeof schema>) {
  return {
    routePlanningLocations: {
      origin: { type: "Point", coordinates: [data.fromLon, data.fromLat] },
      destination: { type: "Point", coordinates: [data.toLon, data.toLat] },
    },
    traffic: "live",
    routeType: "fast",
    travelMode: "car",
    vehicleEngineType: "combustion",
    ...(data.departureTime ? { departureDateTime: data.departureTime } : {}),
    ...(data.bearing === undefined ? {} : { vehicleHeadingInDegrees: Math.round(data.bearing % 360) }),
    guidance: "instructions",
    instructionPhonetics: "ipa",
  };
}

type RouteBody = ReturnType<typeof orbisRouteBody>;
type ViaPoint = { lat: number; lon: number };
const point = (p: ViaPoint) => ({ type: "Point", coordinates: [p.lon, p.lat] });

/**
 * Ways to ask TomTom Orbis v3 for a route that passes through given points.
 * The exact body shape was not documented where we could read it, so they are
 * tried in order until one is accepted; the accepted name is remembered for
 * this server and reported on the result (`viaShape`).
 */
const VIA_SHAPES: Array<{ name: string; apply: (body: RouteBody, via: ViaPoint[]) => object }> = [
  {
    name: "waypoints",
    apply: (b, via) => ({
      ...b,
      routePlanningLocations: { ...b.routePlanningLocations, waypoints: via.map(point) },
    }),
  },
  {
    name: "locations-array",
    apply: (b, via) => ({
      ...b,
      routePlanningLocations: [
        b.routePlanningLocations.origin,
        ...via.map(point),
        b.routePlanningLocations.destination,
      ],
    }),
  },
  {
    name: "waypoints-wrapped",
    apply: (b, via) => ({
      ...b,
      routePlanningLocations: {
        ...b.routePlanningLocations,
        waypoints: via.map((p) => ({ point: point(p) })),
      },
    }),
  },
  {
    name: "path-linestring",
    apply: (b, via) => ({
      ...b,
      routePlanningLocations: {
        ...b.routePlanningLocations,
        path: {
          type: "LineString",
          coordinates: [
            b.routePlanningLocations.origin.coordinates,
            ...via.map((p) => [p.lon, p.lat]),
            b.routePlanningLocations.destination.coordinates,
          ],
        },
      },
    }),
  },
  {
    name: "top-level-waypoints",
    apply: (b, via) => ({ ...b, waypoints: via.map(point) }),
  },
  {
    name: "pointWaypoints",
    apply: (b, via) => ({
      ...b,
      routePlanningLocations: { ...b.routePlanningLocations, pointWaypoints: via.map(point) },
    }),
  },
  {
    name: "top-level-path",
    apply: (b, via) => ({
      ...b,
      path: {
        type: "LineString",
        coordinates: [
          b.routePlanningLocations.origin.coordinates,
          ...via.map((p) => [p.lon, p.lat]),
          b.routePlanningLocations.destination.coordinates,
        ],
      },
    }),
  },
];
class ViaRefusedError extends Error {}
let workingViaShape: string | null = null;

function requestOrbisRoute(key: string, routeBody: object) {
  return fetch(ORBIS_ROUTE_URL, { signal: AbortSignal.timeout(8000),
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "TomTom-Api-Key": key,
      "TomTom-Api-Version": "3",
      Accept: "application/json",
      Attributes: "routes",
      "Accept-Language": "en-GB",
    },
    body: JSON.stringify(routeBody),
  });
}

/** Live driving time with traffic plus any incident on the route, via TomTom. */
export async function lookupDriveTime(data: z.infer<typeof schema>): Promise<DriveTime | null> {
  const key = tomtomKey();
  if (!key) {
    console.error("[drive] routing unavailable: TOMTOM_API_KEY is not set");
    return null;
  }

  try {
    const cacheKey = driveCacheKey(data);
    const cached = cache.get(cacheKey);
    if (!data.forceRefresh && cached && Date.now() - cached.fetchedAt < CACHE_MS) {
      console.info("[drive] cache_hit", { trafficBasis: cached.trafficBasis });
      return cached;
    }
    console.info("[drive] cache_miss", {
      trafficBasis: data.departureTime ? "future-estimate" : "live",
    });

    const routeUrl = ORBIS_ROUTE_URL;
    let routeBody: object = orbisRouteBody(data);
    let response: Response;
    let viaShape: string | undefined;
    if (data.via?.length) {
      const shapes = [...VIA_SHAPES].sort(
        (a, b) => Number(b.name === workingViaShape) - Number(a.name === workingViaShape),
      );
      let accepted: Response | null = null;
      const refusals: string[] = [];
      for (const shape of shapes) {
        const body = shape.apply(routeBody as RouteBody, data.via);
        const attempt = await requestOrbisRoute(key, body);
        if (attempt.ok) {
          accepted = attempt;
          routeBody = body;
          viaShape = shape.name;
          workingViaShape = shape.name;
          break;
        }
        const detail = `${shape.name}: ${attempt.status} ${(await attempt.text()).replace(/\s+/g, " ").slice(0, 220)}`;
        refusals.push(detail);
        console.error(`[drive] via shape rejected - ${detail}`);
      }
      if (!accepted) {
        console.error("[drive] no via shape accepted");
        // TomTom's own refusal text (no key in it), so the cause can be read from the response.
        throw new ViaRefusedError(`via refused by TomTom - ${refusals.join(" | ")}`.slice(0, 1500));
      }
      console.info("[drive] via shape accepted", { viaShape });
      response = accepted;
    } else {
      response = await requestOrbisRoute(key, routeBody);
    }
    if (!response.ok) {
      console.error(`[drive] Orbis routing unavailable: TomTom returned ${response.status}`);
      return null;
    }

    const payload = (await response.json()) as {
      routes?: Array<{
        summary?: { lengthInMeters?: number; travelDurationInSeconds?: number; trafficDelayDurationInSeconds?: number; trafficLengthInMeters?: number; departureDateTime?: string; arrivalDateTime?: string };
        legs?: Array<{ path?: { type?: string; coordinates?: Array<[number, number]> } }>;
        path?: { type?: string; coordinates?: Array<[number, number]> };
        sections?: { traffic?: Array<{ startPathIndex?: number; endPathIndex?: number; iconCategory?: string; effectiveSpeedInKilometersPerHour?: number; delayDurationInSeconds?: number; delayMagnitude?: string }> };
        instructions?: OrbisInstruction[];
      }>;
    };
    const route = payload.routes?.[0];
    const summary = route?.summary;
    if (!summary?.travelDurationInSeconds) {
      console.warn("[drive] routing unavailable: no route was returned");
      return null;
    }

    const trafficSeconds = summary.travelDurationInSeconds;
    let typicalSeconds = trafficSeconds;
    let typicalChecked = false;
    if (!data.departureTime) {
      try {
        const historicalResponse = await fetch(routeUrl, { signal: AbortSignal.timeout(8000),
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "TomTom-Api-Key": key,
            "TomTom-Api-Version": "3",
            Accept: "application/json",
            Attributes: "routes",
            "Accept-Language": "en-GB",
          },
          body: JSON.stringify({ ...routeBody, traffic: "historical" }),
        });
        if (historicalResponse.ok) {
          const historical = (await historicalResponse.json()) as { routes?: Array<{ summary?: { travelDurationInSeconds?: number } }> };
          const historicalSeconds = historical.routes?.[0]?.summary?.travelDurationInSeconds;
          if (typeof historicalSeconds === "number" && historicalSeconds > 0) {
            typicalSeconds = historicalSeconds;
            typicalChecked = true;
          }
        }
      } catch {
        // Historical baseline is supplemental; keep the live route if unavailable.
      }
    }

    const fullPath = flattenOrbisPath(route);
    let hdotLaneClosures: HdotLaneClosureRoute[] = [];
    let hdotScheduledClosures: HdotScheduledClosure[] = [];
    if (fullPath.length >= 2) {
      hdotLaneClosures = await lookupHdotLaneClosureRoutes({ routePath: fullPath });
      hdotScheduledClosures = await lookupHdotScheduledClosures(hdotLaneClosures);
    }
    const path = thinPath(fullPath);
    const trafficSections = readOrbisTrafficSections(route?.sections?.traffic ?? [], fullPath);
    // Current incidents are not evidence about a later departure.
    const {
      onRoute: incidents,
      offRoute,
      nearby: nearbyIncidents,
    } = data.departureTime
      ? {
          onRoute: [] as DriveIncident[],
          offRoute: [] as Array<string | null>,
          nearby: [] as DriveIncident[],
        }
      : await fetchIncidents(key, data, path);

    const corridor = extractCorridor(
      normalizeOrbisInstructions(route?.instructions ?? []),
      summary.lengthInMeters ?? 0,
      { fromLon: data.fromLon, toLon: data.toLon },
    );
    // Compare against every road the route touches, so a road the drive uses
    // for even one leg is never advertised as skipped.
    const bypassedRoads = corridor ? bypassedCorridors(offRoute, corridor.allRoads) : [];

    const trafficMinutes = Math.round(trafficSeconds / 60);
    const typicalMinutes = Math.round(typicalSeconds / 60);
    // TomTom Orbis does not provide a route-level uncertainty interval.
    // Never manufacture one from the live-vs-typical difference: that is a
    // comparison to the historical profile, not a confidence range.
    const result: DriveTime = {
      trafficMinutes,
      typicalMinutes,
      typicalChecked,
      delayMinutes: trafficMinutes - typicalMinutes,
      // No fabricated uncertainty: the live provider ETA is the only
      // defensible current-trip duration. Keep the legacy fields equal so
      // downstream planners cannot silently turn a made-up range into an ETA.
      lowMinutes: trafficMinutes,
      highMinutes: trafficMinutes,
      meters: summary.lengthInMeters ?? 0,
      path,
      trafficSections,
      incidents,
      nearbyIncidents,
      hdotLaneClosures,
      hdotScheduledClosures,
      corridorLabel: corridor?.label ?? null,
      corridorRoads: corridor?.roads ?? [],
      bypassedRoads,
      maneuvers: buildManeuvers(route?.instructions ?? [], fullPath),
      fetchedAt: Date.now(),
      trafficBasis: data.departureTime ? "future-estimate" : "live",
      ...(viaShape ? { viaShape } : {}),
    };

    cacheDrive(cacheKey, result);
    return result;
  } catch (error) {
    if (error instanceof ViaRefusedError) throw error;
    // An unavailable route is not a zero-minute drive. The caller can keep
    // rendering rail and cached schedules without a failed server action.
    console.error("[drive] routing unavailable: TomTom request failed");
    return null;
  }
}

const trafficCache = new Map<string, { trafficMinutes: number; fetchedAt: number }>();

/**
 * Only the live road time, for timing a drive to a Skyline station on the
 * server (transit-plan.server.ts): the same route request, the same rounding
 * and the same two-minute memory as lookupDriveTime's trafficMinutes, without
 * the typical-traffic, incident and roadwork lookups only the Drive row shows.
 * One outgoing request instead of up to five, so a trip search fits the
 * server's per-request limit.
 */
export async function lookupTrafficMinutes(
  data: z.infer<typeof schema>,
): Promise<{ trafficMinutes: number } | null> {
  const key = tomtomKey();
  if (!key) {
    console.error("[drive] routing unavailable: TOMTOM_API_KEY is not set");
    return null;
  }
  const cacheKey = driveCacheKey(data);
  const full = cache.get(cacheKey);
  if (full && Date.now() - full.fetchedAt < CACHE_MS) return { trafficMinutes: full.trafficMinutes };
  const remembered = trafficCache.get(cacheKey);
  if (remembered && Date.now() - remembered.fetchedAt < CACHE_MS)
    return { trafficMinutes: remembered.trafficMinutes };
  try {
    const response = await requestOrbisRoute(key, orbisRouteBody(data));
    if (!response.ok) {
      console.error(`[drive] Orbis routing unavailable: TomTom returned ${response.status}`);
      return null;
    }
    const payload = (await response.json()) as {
      routes?: Array<{ summary?: { travelDurationInSeconds?: number } }>;
    };
    const seconds = payload.routes?.[0]?.summary?.travelDurationInSeconds;
    if (!seconds) return null;
    const trafficMinutes = Math.round(seconds / 60);
    trafficCache.delete(cacheKey);
    trafficCache.set(cacheKey, { trafficMinutes, fetchedAt: Date.now() });
    while (trafficCache.size > MAX_CACHE_ENTRIES) {
      const oldest = trafficCache.keys().next().value;
      if (typeof oldest !== "string") break;
      trafficCache.delete(oldest);
    }
    return { trafficMinutes };
  } catch {
    console.error("[drive] routing unavailable: TomTom request failed");
    return null;
  }
}

export const driveTime = createServerFn({ method: "POST" })
  .middleware([driveLimit])
  .validator((input) => schema.parse(input))
  .handler(async ({ data }) => lookupDriveTime(data));

/** Active incidents inside a slightly padded box around the two points. */
async function fetchIncidents(
  key: string,
  points: { fromLat: number; fromLon: number; toLat: number; toLon: number },
  routePath: GeoPoint[],
): Promise<{
  onRoute: DriveIncident[];
  offRoute: Array<string | null>;
  nearby: DriveIncident[];
}> {
  const pad = 0.03;
  const minLat = Math.min(points.fromLat, points.toLat) - pad;
  const maxLat = Math.max(points.fromLat, points.toLat) + pad;
  const minLon = Math.min(points.fromLon, points.toLon) - pad;
  const maxLon = Math.max(points.fromLon, points.toLon) + pad;

  const fields =
    "{incidents{geometry{type,coordinates},properties{id,iconCategory,magnitudeOfDelay,delay,roadNumbers,from,to,endTime,events{description}}}}";
  const url =
    `https://api.tomtom.com/traffic/services/5/incidentDetails` +
    `?key=${key}&bbox=${minLon},${minLat},${maxLon},${maxLat}` +
    `&fields=${encodeURIComponent(fields)}&language=en-GB&timeValidityFilter=present`;

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) {
      console.error(`TomTom incidents failed [${response.status}]: ${await response.text()}`);
      return { onRoute: [], offRoute: [], nearby: [] };
    }
    const payload = (await response.json()) as {
      incidents?: Array<{
        geometry?: { type?: string; coordinates?: unknown };
        properties?: {
          id?: string;
          magnitudeOfDelay?: number;
          delay?: number;
          roadNumbers?: string[];
          from?: string;
          iconCategory?: number;
          to?: string;
          endTime?: string;
          events?: Array<{ description?: string }>;
        };
      }>;
    };
    const out: DriveIncident[] = [];
    const offRoute: Array<string | null> = [];
    const nearby: DriveIncident[] = [];
    for (const incident of payload.incidents ?? []) {
      const magnitude = incident.properties?.magnitudeOfDelay ?? 0;
      const road = incident.properties?.roadNumbers?.[0] ?? null;
      const incidentPoints = readIncidentPoints(incident.geometry?.coordinates);
      const nearbyCandidate = nearbyIncidentFrom(incident.properties, incidentPoints, routePath);
      if (nearbyCandidate && nearby.length < 5) nearby.push(nearbyCandidate);
      if (!incidentTouchesRoute(incidentPoints, routePath)) {
        // Heavy congestion nearby that this route avoids: worth saying out loud,
        // but only when it is clearly off the driven corridor, not a parallel
        // lane or ramp of a road the route actually uses.
        if (magnitude >= 3 && road && !incidentTouchesRoute(incidentPoints, routePath, 300)) {
          offRoute.push(road);
        }
        continue;
      }
      const description = incident.properties?.events?.[0]?.description;
      if (!description) continue;
      // Skip trivial slow-downs; only report what changes the number.
      if (magnitude < 2) continue;
      const delay = incident.properties?.delay;
      const candidate: DriveIncident = {
        id: typeof incident.properties?.id === "string" ? incident.properties.id : null,
        description,
        road: localRoadName(road),
        delayMinutes: typeof delay === "number" ? Math.round(delay / 60) : null,
        category:
          typeof incident.properties?.iconCategory === "string"
            ? incident.properties.iconCategory
            : typeof incident.properties?.iconCategory === "number"
              ? String(incident.properties.iconCategory)
              : null,
        from: incident.properties?.from ?? null,
        to: incident.properties?.to ?? null,
        endTime: incident.properties?.endTime ?? null,
        points: incidentPoints,
      };
      // Don't alarm the driver about something their own route is not paying for.
      if (!incidentAffectsTrip(candidate)) continue;
      if (out.length < 3) out.push(candidate);
    }
    return { onRoute: out, offRoute, nearby };
  } catch (error) {
    console.error("TomTom incidents error", error);
    return { onRoute: [], offRoute: [], nearby: [] };
  }
}

/** Within this distance of the route an incident is still "ahead of you". */
const NEARBY_INCIDENT_M = 1500;

/**
 * An incident that has a category and a place but may not delay this route:
 * kept so Nalu can still say what and where (an accident a reroute avoided).
 * Nothing is inferred; delay is only what TomTom reports.
 */
export function nearbyIncidentFrom(
  properties:
    | {
        id?: string;
        delay?: number;
        roadNumbers?: string[];
        from?: string;
        to?: string;
        endTime?: string;
        iconCategory?: number;
        events?: Array<{ description?: string }>;
      }
    | undefined,
  points: GeoPoint[],
  routePath: GeoPoint[],
): DriveIncident | null {
  if (!properties || points.length === 0) return null;
  const category = properties.iconCategory === undefined ? null : String(properties.iconCategory);
  const road = localRoadName(properties.roadNumbers?.[0] ?? null);
  const from = properties.from ?? null;
  const candidate: DriveIncident = {
    id: typeof properties.id === "string" ? properties.id : null,
    description: properties.events?.[0]?.description ?? "",
    road,
    delayMinutes: typeof properties.delay === "number" ? Math.round(properties.delay / 60) : null,
    category,
    from,
    to: properties.to ?? null,
    endTime: properties.endTime ?? null,
    points,
  };
  if (!incidentCategoryLabel(candidate) || !(road || from)) return null;
  if (!incidentTouchesRoute(points, routePath, NEARBY_INCIDENT_M)) return null;
  return { ...candidate, onRoute: incidentTouchesRoute(points, routePath) };
}

function readIncidentPoints(coordinates: unknown): GeoPoint[] {
  if (!Array.isArray(coordinates)) return [];
  const out: GeoPoint[] = [];
  const visit = (value: unknown) => {
    if (!Array.isArray(value)) return;
    if (value.length >= 2 && typeof value[0] === "number" && typeof value[1] === "number") {
      out.push({ lon: value[0], lat: value[1] });
      return;
    }
    value.forEach(visit);
  };
  visit(coordinates);
  return out;
}

function flattenOrbisPath(route: { path?: { coordinates?: Array<[number, number]> }; legs?: Array<{ path?: { coordinates?: Array<[number, number]> } }> } | undefined): Array<{ lat: number; lon: number }> {
  const coordinates = route?.path?.coordinates ?? route?.legs?.flatMap((leg) => leg.path?.coordinates ?? []) ?? [];
  return coordinates.map(([lon, lat]) => ({ lat, lon }));
}

type OrbisRoadInfo = {
  streetName?: { text?: string };
  roadShields?: Array<{ roadNumber?: { text?: string } }>;
};

type OrbisInstruction = {
  routeOffsetInMeters?: number;
  maneuverPoint?: { latitude?: number; longitude?: number };
  maneuver?: string;
  instructionMessage?: string;
  previousRoadInformation?: OrbisRoadInfo;
  nextRoadInformation?: OrbisRoadInfo;
};

/** Last raw instruction shape seen when no turns could be read (health check diagnosis). */
export let lastUnreadInstructionShape: string | null = null;

/** A point in any format TomTom uses: {latitude, longitude}, {lat, lon}, or GeoJSON coordinates. */
function readPoint(value: unknown): { lat: number; lon: number } | null {
  if (!value || typeof value !== "object") return null;
  const o = value as Record<string, unknown>;
  const lat = o["latitude"] ?? o["lat"];
  const lon = o["longitude"] ?? o["lon"] ?? o["lng"];
  if (typeof lat === "number" && typeof lon === "number") return { lat, lon };
  const c = o["coordinates"];
  if (Array.isArray(c) && typeof c[0] === "number" && typeof c[1] === "number") return { lat: c[1], lon: c[0] };
  return null;
}

/** The spot `meters` along the route path, for instructions that only give a distance. */
function pointAtOffset(path: Array<{ lat: number; lon: number }>, meters: number) {
  let travelled = 0;
  for (let i = 1; i < path.length; i += 1) {
    const a = path[i - 1]!;
    const b = path[i]!;
    const dLat = (b.lat - a.lat) * 111_320;
    const dLon = (b.lon - a.lon) * 111_320 * Math.cos((a.lat * Math.PI) / 180);
    const step = Math.hypot(dLat, dLon);
    if (travelled + step >= meters) return b;
    travelled += step;
  }
  return path[path.length - 1] ?? null;
}

const TURN_WORDS: Record<string, string> = {
  TURN_LEFT: "Turn left",
  TURN_RIGHT: "Turn right",
  SHARP_LEFT: "Make a sharp left",
  SHARP_RIGHT: "Make a sharp right",
  BEAR_LEFT: "Bear left",
  BEAR_RIGHT: "Bear right",
  KEEP_LEFT: "Keep left",
  KEEP_RIGHT: "Keep right",
  MAKE_UTURN: "Make a U-turn",
  ENTER_MOTORWAY: "Take the ramp",
  ENTER_FREEWAY: "Take the ramp",
  TAKE_EXIT: "Take the exit",
  MOTORWAY_EXIT_LEFT: "Take the exit on the left",
  MOTORWAY_EXIT_RIGHT: "Take the exit on the right",
  ROUNDABOUT_CROSS: "Go straight through the roundabout",
  STRAIGHT: "Continue straight",
};

/** "TURN_RIGHT", "turnRight", "turn-right" → "TURN_RIGHT". */
function normalizeManeuver(value: string) {
  return value
    .replace(/([a-z])([A-Z])/g, "$1_$2")
    .replace(/[-\s]+/g, "_")
    .toUpperCase();
}

/**
 * Turn-by-turn steps for the voice and the next-turn arrow. Reads TomTom's
 * instructions whatever shape their location and wording come in, so a format
 * change can't silently empty the list (which leaves the voice with nothing to say).
 */
export function buildManeuvers(instructions: OrbisInstruction[], path: Array<{ lat: number; lon: number }>) {
  const rawSteps = instructions.flatMap((raw) => {
    const any = raw as unknown as Record<string, unknown>;
    const maneuverRaw = typeof raw.maneuver === "string" ? raw.maneuver : typeof any["maneuverType"] === "string" ? (any["maneuverType"] as string) : null;
    if (!maneuverRaw) return [];
    const maneuver = normalizeManeuver(maneuverRaw);
    if (maneuver.startsWith("DEPART")) return [];
    const point =
      readPoint(raw.maneuverPoint) ??
      readPoint(any["point"]) ??
      (typeof raw.routeOffsetInMeters === "number" ? pointAtOffset(path, raw.routeOffsetInMeters) : null);
    if (!point) return [];
    const street = raw.nextRoadInformation?.streetName?.text ?? raw.previousRoadInformation?.streetName?.text ?? null;
    const shield = [...(raw.nextRoadInformation?.roadShields ?? []), ...(raw.previousRoadInformation?.roadShields ?? [])]
      .map((s) => s.roadNumber?.text)
      .find((t): t is string => Boolean(t));
    const message =
      (typeof raw.instructionMessage === "string" && raw.instructionMessage) ||
      (typeof any["message"] === "string" && (any["message"] as string)) ||
      (typeof any["instructionText"] === "string" && (any["instructionText"] as string)) ||
      (maneuver.startsWith("ARRIVE")
        ? "Arrive at your destination"
        : `${TURN_WORDS[maneuver] ?? "Continue"}${street ? ` onto ${street}` : ""}`);
    return [
      {
        lat: point.lat,
        lon: point.lon,
        maneuver,
        instruction: localizeInstruction(message.replace(/<[^>]*>/g, "")),
        // Street names first; route numbers only through the local-name map.
        road: localRoadName(street) ?? localRoadName(shield ?? null) ?? null,
      },
    ];
  });
  // The HUD road label drops a direction word only when it contradicts the
  // heading measured along that same road: up to 2 km, but never past the next
  // maneuver. With less than 800 m of the road left, the provider's label stays.
  const steps = rawSteps.map((step, index) => {
    const next = rawSteps[index + 1];
    const along = next ? distanceAlongPath(path, next) - distanceAlongPath(path, step) : Infinity;
    const labelBearing = routeBearingAfter(
      path,
      step,
      Math.min(LABEL_LOOKAHEAD_M, along),
      LABEL_MIN_AHEAD_M,
    );
    return { ...step, road: localizeRoadLabel(step.road, labelBearing) };
  });
  if (instructions.length > 0 && steps.length === 0) {
    const first = instructions[0] as unknown as Record<string, unknown>;
    lastUnreadInstructionShape = JSON.stringify(
      Object.fromEntries(Object.entries(first).map(([k, v]) => [k, typeof v === "object" ? Object.keys(v ?? {}) : typeof v])),
    ).slice(0, 300);
    console.warn("[drive] no turns could be read from TomTom instructions", lastUnreadInstructionShape);
  }
  return steps.slice(0, 80);
}

function normalizeOrbisInstructions(instructions: OrbisInstruction[]): Array<GuidanceInstruction & { point?: { latitude?: number; longitude?: number }; message?: string }> {
  return instructions.map((instruction) => {
    const roadNumbers = [...(instruction.nextRoadInformation?.roadShields ?? []), ...(instruction.previousRoadInformation?.roadShields ?? [])]
      .map((shield) => shield.roadNumber?.text)
      .filter((value): value is string => Boolean(value));
    const result: GuidanceInstruction & { point?: { latitude?: number; longitude?: number }; message?: string } = {
      roadNumbers,
    };
    if (instruction.routeOffsetInMeters !== undefined) result.routeOffsetInMeters = instruction.routeOffsetInMeters;
    if (instruction.maneuverPoint !== undefined) result.point = instruction.maneuverPoint;
    if (instruction.maneuver !== undefined) result.maneuver = instruction.maneuver;
    if (instruction.instructionMessage !== undefined) result.message = instruction.instructionMessage;
    const street = instruction.nextRoadInformation?.streetName?.text ?? instruction.previousRoadInformation?.streetName?.text;
    if (street !== undefined) result.street = street;
    return result;
  });
}

function readOrbisTrafficSections(sections: Array<{ startPathIndex?: number; endPathIndex?: number; delayDurationInSeconds?: number; delayMagnitude?: string }>, fullPath: Array<{ lat: number; lon: number }>): DriveTrafficSection[] {
  const out: DriveTrafficSection[] = [];
  for (const section of sections) {
    const start = section.startPathIndex;
    const end = section.endPathIndex;
    if (typeof start !== "number" || typeof end !== "number" || end <= start) continue;
    const slice = fullPath.slice(start, Math.min(end + 1, fullPath.length));
    if (slice.length < 2) continue;
    out.push({
      severity: section.delayMagnitude === "major" || section.delayMagnitude === "undefined" ? "heavy" : "moderate",
      delayMinutes: Math.round((section.delayDurationInSeconds ?? 0) / 60),
      points: thinPath(slice, 80),
    });
    if (out.length === 12) break;
  }
  return out;
}

/** Flatten TomTom leg geometry into one ordered list of route points. */
function flattenPath(
  legs: Array<{ points?: Array<{ latitude?: number; longitude?: number }> }>,
): Array<{ lat: number; lon: number }> {
  const all: Array<{ lat: number; lon: number }> = [];
  for (const leg of legs) {
    for (const point of leg.points ?? []) {
      if (typeof point.latitude !== "number" || typeof point.longitude !== "number") continue;
      all.push({ lat: point.latitude, lon: point.longitude });
    }
  }
  return all;
}

/** Thin geometry to a payload a phone can draw without a huge response. */
function thinPath(
  all: Array<{ lat: number; lon: number }>,
  maxPoints = 300,
): Array<{ lat: number; lon: number }> {
  if (all.length <= maxPoints) return all;
  const step = all.length / maxPoints;
  const out: Array<{ lat: number; lon: number }> = [];
  for (let index = 0; index < maxPoints; index += 1) {
    const point = all[Math.floor(index * step)];
    if (point) out.push(point);
  }
  const last = all[all.length - 1];
  if (last) out.push(last);
  return out;
}

/** Turn TomTom traffic sections into drawable congested stretches of the route. */
function readTrafficSections(
  sections: Array<{
    sectionType?: string;
    startPointIndex?: number;
    endPointIndex?: number;
    magnitudeOfDelay?: number;
    delayInSeconds?: number;
  }>,
  fullPath: Array<{ lat: number; lon: number }>,
): DriveTrafficSection[] {
  const out: DriveTrafficSection[] = [];
  for (const section of sections) {
    if (section.sectionType && section.sectionType !== "TRAFFIC") continue;
    const start = section.startPointIndex;
    const end = section.endPointIndex;
    if (typeof start !== "number" || typeof end !== "number" || end <= start) continue;
    const magnitude = section.magnitudeOfDelay ?? 0;
    if (magnitude < 1) continue;
    const slice = fullPath.slice(start, Math.min(end + 1, fullPath.length));
    if (slice.length < 2) continue;
    out.push({
      severity: magnitude >= 3 ? "heavy" : "moderate",
      delayMinutes: Math.round((section.delayInSeconds ?? 0) / 60),
      points: thinPath(slice, 80),
    });
    if (out.length === 12) break;
  }
  return out;
}
