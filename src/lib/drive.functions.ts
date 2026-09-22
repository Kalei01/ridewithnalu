import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { incidentTouchesRoute, type GeoPoint } from "./drive/incident-correlation";
import { bypassedCorridors, extractCorridor, type GuidanceInstruction } from "./drive/corridor";

const schema = z.object({
  fromLat: z.number(),
  fromLon: z.number(),
  toLat: z.number(),
  toLon: z.number(),
  departureTime: z.string().datetime({ offset: true }).optional(),
});

export type DriveIncident = {
  description: string;
  road: string | null;
  delayMinutes: number | null;
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
  fetchedAt: number;
  trafficBasis: "live" | "future-estimate";
};

export type DriveTrafficSection = {
  severity: "moderate" | "heavy";
  delayMinutes: number;
  points: Array<{ lat: number; lon: number }>;
};

const CACHE_MS = 5 * 60_000;
const cache = new Map<string, DriveTime>();

function round(value: number) {
  // ~10 m precision keeps the cache useful while the phone's GPS jitters.
  return Math.round(value * 10000) / 10000;
}

/** Live driving time with traffic plus any incident on the route, via TomTom. */
export const driveTime = createServerFn({ method: "POST" })
  .inputValidator((input) => schema.parse(input))
  .handler(async ({ data }): Promise<DriveTime> => {
    const key = process.env["TOMTOM_API_KEY"];
    if (!key) throw new Error("Drive times are not configured yet.");

    const from = `${round(data.fromLat)},${round(data.fromLon)}`;
    const to = `${round(data.toLat)},${round(data.toLon)}`;
    const departureBucket = data.departureTime
      ? Math.floor(new Date(data.departureTime).getTime() / (5 * 60_000))
      : "now";
    const cacheKey = `${from}:${to}:${departureBucket}`;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.fetchedAt < CACHE_MS) {
      console.info("[drive] cache_hit", { trafficBasis: cached.trafficBasis });
      return cached;
    }
    console.info("[drive] cache_miss", { trafficBasis: data.departureTime ? "future-estimate" : "live" });

    const routeUrl =
      `https://api.tomtom.com/routing/1/calculateRoute/${from}:${to}/json` +
      `?key=${key}&traffic=true&travelMode=car&routeType=fastest&computeTravelTimeFor=all` +
      `&sectionType=traffic` +
      `&routeRepresentation=polyline&instructionsType=text` +
      `${data.departureTime ? `&departAt=${encodeURIComponent(data.departureTime)}` : ""}`;


    const response = await fetch(routeUrl);
    if (!response.ok) {
      const body = await response.text();
      console.error(`TomTom routing failed [${response.status}]: ${body}`);
      throw new Error(`Drive time lookup failed (${response.status}).`);
    }

    const payload = (await response.json()) as {
      routes?: Array<{
        summary?: {
          lengthInMeters?: number;
          travelTimeInSeconds?: number;
          noTrafficTravelTimeInSeconds?: number;
          historicTrafficTravelTimeInSeconds?: number;
          liveTrafficIncidentsTravelTimeInSeconds?: number;
          trafficDelayInSeconds?: number;
        };
        legs?: Array<{ points?: Array<{ latitude?: number; longitude?: number }> }>;
        sections?: Array<{
          sectionType?: string;
          startPointIndex?: number;
          endPointIndex?: number;
          magnitudeOfDelay?: number;
          delayInSeconds?: number;
          simpleCategory?: string;
        }>;
        guidance?: { instructions?: GuidanceInstruction[] };
      }>;
    };
    const route = payload.routes?.[0];
    const summary = route?.summary;
    if (!summary?.travelTimeInSeconds) throw new Error("No driving route was found.");

    const trafficSeconds =
      summary.liveTrafficIncidentsTravelTimeInSeconds ?? summary.travelTimeInSeconds;
    // What this road usually takes at this hour. Free-flow is not achievable at
    // rush hour, so it never becomes the low end of anything shown to a rider.
    const typicalSeconds = summary.historicTrafficTravelTimeInSeconds ?? trafficSeconds;

    const fullPath = flattenPath(route?.legs ?? []);
    const path = thinPath(fullPath);
    const trafficSections = readTrafficSections(route?.sections ?? [], fullPath);
    const { onRoute: incidents, offRoute } = await fetchIncidents(key, data, path);

    const corridor = extractCorridor(
      route?.guidance?.instructions ?? [],
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
      fetchedAt: Date.now(),
      trafficBasis: data.departureTime ? "future-estimate" : "live",
    };


    cache.set(cacheKey, result);
    return result;
  });

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
    "{incidents{geometry{type,coordinates},properties{iconCategory,magnitudeOfDelay,delay,roadNumbers,events{description}}}}";
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
        // Heavy congestion nearby that this route avoids: worth saying out loud.
        if (magnitude >= 3 && road) offRoute.push(road);
        continue;
      }
      const description = incident.properties?.events?.[0]?.description;
      if (!description) continue;
      // Skip trivial slow-downs; only report what changes the number.
      if (magnitude < 2) continue;
      const delay = incident.properties?.delay;
      if (out.length < 3) {
        out.push({
          description,
          road,
          delayMinutes: typeof delay === "number" ? Math.round(delay / 60) : null,
        });
      }
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

