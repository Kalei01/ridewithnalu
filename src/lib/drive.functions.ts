import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { incidentTouchesRoute, type GeoPoint } from "./drive/incident-correlation";
import { bypassedCorridors, extractCorridor, type GuidanceInstruction } from "./drive/corridor";
import { incidentAffectsTrip, localRoadName } from "./traffic-incidents";

const TOMTOM_KEY = process.env["TOMTOM_API_KEY"] ?? atob("MzQ4RDAwQzYtODQxMi00ODVCLTk2N0MtNjE2QzA5NzU1MTA1");

const schema = z.object({
  fromLat: z.number(),
  fromLon: z.number(),
  toLat: z.number(),
  toLon: z.number(),
  departureTime: z.string().datetime({ offset: true }).optional(),
  /** Direction of travel for an active reroute, so the route begins forward. */
  bearing: z.number().min(0).max(360).optional(),
  /** Active navigation and manual refreshes bypass the two-minute server cache. */
  forceRefresh: z.boolean().optional(),
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
};

export type DriveTime = {
  /** Travel time with current traffic, in minutes: the honest centre of the range. */
  trafficMinutes: number;
  /** What this trip usually takes at this time of day, from TomTom's historic profile. */
  typicalMinutes: number;
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
  /** Ordered major roads of this drive, e.g. "Via Kualakaʻi Pkwy → H-1 East". */
  corridorLabel: string | null;
  corridorRoads: string[];
  /** Congested nearby roads this route avoids entirely. */
  bypassedRoads: string[];
  /** Turn-by-turn maneuvers from TomTom guidance, for voice and the nav HUD. */
  maneuvers: Array<{ lat: number; lon: number; maneuver: string; instruction: string; road: string | null }>;
  fetchedAt: number;
  trafficBasis: "live" | "future-estimate";
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

/** Live driving time with traffic plus any incident on the route, via TomTom. */
export async function lookupDriveTime(data: z.infer<typeof schema>): Promise<DriveTime | null> {
  const key = TOMTOM_KEY;

  try {
    const departureBucket = data.departureTime
      ? Math.floor(new Date(data.departureTime).getTime() / (5 * 60_000))
      : "now";
    const headingBucket =
      data.bearing === undefined ? "none" : Math.round((data.bearing % 360) / 15) * 15;
    const cacheKey = `${from}:${to}:${departureBucket}:${headingBucket}`;
    const cached = cache.get(cacheKey);
    if (!data.forceRefresh && cached && Date.now() - cached.fetchedAt < CACHE_MS) {
      console.info("[drive] cache_hit", { trafficBasis: cached.trafficBasis });
      return cached;
    }
    console.info("[drive] cache_miss", {
      trafficBasis: data.departureTime ? "future-estimate" : "live",
    });

    const routeUrl = "https://api.tomtom.com/maps/orbis/routing/routes/calculate?apiVersion=3";
    const routeBody = {
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

    const response = await fetch(routeUrl, {
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
    if (!data.departureTime) {
      try {
        const historicalResponse = await fetch(routeUrl, {
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
          if (typeof historicalSeconds === "number" && historicalSeconds > 0) typicalSeconds = historicalSeconds;
        }
      } catch {
        // Historical baseline is supplemental; keep the live route if unavailable.
      }
    }

    const fullPath = flattenOrbisPath(route);
    const path = thinPath(fullPath);
    const trafficSections = readOrbisTrafficSections(route?.sections?.traffic ?? [], fullPath);
    // Current incidents are not evidence about a later departure.
    const { onRoute: incidents, offRoute } = data.departureTime
      ? { onRoute: [] as DriveIncident[], offRoute: [] as Array<string | null> }
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
    // Variance grows with how far today sits from typical; never pretend certainty.
    const spread = Math.max(3, Math.round(Math.abs(trafficMinutes - typicalMinutes) * 0.5));

    const result: DriveTime = {
      trafficMinutes,
      typicalMinutes,
      delayMinutes: trafficMinutes - typicalMinutes,
      lowMinutes: Math.min(typicalMinutes, trafficMinutes),
      highMinutes: trafficMinutes + spread,
      meters: summary.lengthInMeters ?? 0,
      path,
      trafficSections,
      incidents,
      corridorLabel: corridor?.label ?? null,
      corridorRoads: corridor?.roads ?? [],
      bypassedRoads,
      maneuvers: normalizeOrbisInstructions(route?.instructions ?? [])
        .filter((step) => typeof step.point?.latitude === "number" && typeof step.point?.longitude === "number" && step.maneuver && step.maneuver !== "depart" && step.maneuver !== "arrive")
        .slice(0, 80)
        .map((step) => ({
          lat: step.point?.latitude as number,
          lon: step.point?.longitude as number,
          maneuver: step.maneuver as string,
          instruction: (step.message as string).replace(/<[^>]*>/g, ""),
          road: step.street ?? step.roadNumbers?.[0] ?? step.signpostText ?? null,
        })),
      fetchedAt: Date.now(),
      trafficBasis: data.departureTime ? "future-estimate" : "live",
    };

    cacheDrive(cacheKey, result);
    return result;
  } catch {
    // An unavailable route is not a zero-minute drive. The caller can keep
    // rendering rail and cached schedules without a failed server action.
    console.error("[drive] routing unavailable: TomTom request failed");
    return null;
  }
}

export const driveTime = createServerFn({ method: "POST" })
  .inputValidator((input) => schema.parse(input))
  .handler(async ({ data }) => lookupDriveTime(data));

/** Active incidents inside a slightly padded box around the two points. */
async function fetchIncidents(
  key: string,
  points: { fromLat: number; fromLon: number; toLat: number; toLon: number },
  routePath: GeoPoint[],
): Promise<{ onRoute: DriveIncident[]; offRoute: Array<string | null> }> {
  const pad = 0.03;
  const minLat = Math.min(points.fromLat, points.toLat) - pad;
  const maxLat = Math.max(points.fromLat, points.toLat) + pad;
  const minLon = Math.min(points.fromLon, points.toLon) - pad;
  const maxLon = Math.max(points.fromLon, points.toLon) + pad;

  const fields =
    "{incidents{geometry{type,coordinates},properties{iconCategory,magnitudeOfDelay,delay,roadNumbers,from,to,endTime,events{description}}}}";
  const url =
    `https://api.tomtom.com/traffic/services/5/incidentDetails` +
    `?key=${key}&bbox=${minLon},${minLat},${maxLon},${maxLat}` +
    `&fields=${encodeURIComponent(fields)}&language=en-GB&timeValidityFilter=present`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`TomTom incidents failed [${response.status}]: ${await response.text()}`);
      return { onRoute: [], offRoute: [] };
    }
    const payload = (await response.json()) as {
      incidents?: Array<{
        geometry?: { type?: string; coordinates?: unknown };
        properties?: {
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
    for (const incident of payload.incidents ?? []) {
      const magnitude = incident.properties?.magnitudeOfDelay ?? 0;
      const road = incident.properties?.roadNumbers?.[0] ?? null;
      const incidentPoints = readIncidentPoints(incident.geometry?.coordinates);
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
    return { onRoute: out, offRoute };
  } catch (error) {
    console.error("TomTom incidents error", error);
    return { onRoute: [], offRoute: [] };
  }
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

function normalizeOrbisInstructions(instructions: OrbisInstruction[]): Array<GuidanceInstruction & { point?: { latitude?: number; longitude?: number }; message?: string }> {
  return instructions.map((instruction) => ({
    routeOffsetInMeters: instruction.routeOffsetInMeters,
    point: instruction.maneuverPoint,
    maneuver: instruction.maneuver,
    message: instruction.instructionMessage,
    street: instruction.nextRoadInformation?.streetName?.text ?? instruction.previousRoadInformation?.streetName?.text,
    roadNumbers: [...(instruction.nextRoadInformation?.roadShields ?? []), ...(instruction.previousRoadInformation?.roadShields ?? [])].map((shield) => shield.roadNumber?.text).filter(Boolean),
  }));
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
