import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const schema = z.object({
  fromLat: z.number(),
  fromLon: z.number(),
  toLat: z.number(),
  toLon: z.number(),
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
  incidents: DriveIncident[];
  fetchedAt: number;
};

const CACHE_MS = 3 * 60_000;
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
    const cacheKey = `${from}:${to}`;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.fetchedAt < CACHE_MS) return cached;

    const routeUrl =
      `https://api.tomtom.com/routing/1/calculateRoute/${from}:${to}/json` +
      `?key=${key}&traffic=true&travelMode=car&routeType=fastest&computeTravelTimeFor=all`;

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
      }>;
    };
    const summary = payload.routes?.[0]?.summary;
    if (!summary?.travelTimeInSeconds) throw new Error("No driving route was found.");

    const trafficSeconds =
      summary.liveTrafficIncidentsTravelTimeInSeconds ?? summary.travelTimeInSeconds;
    // What this road usually takes at this hour. Free-flow is not achievable at
    // rush hour, so it never becomes the low end of anything shown to a rider.
    const typicalSeconds = summary.historicTrafficTravelTimeInSeconds ?? trafficSeconds;

    const incidents = await fetchIncidents(key, data);

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
      incidents,
      fetchedAt: Date.now(),
    };
    cache.set(cacheKey, result);
    return result;
  });

/** Active incidents inside a slightly padded box around the two points. */
async function fetchIncidents(
  key: string,
  points: { fromLat: number; fromLon: number; toLat: number; toLon: number },
): Promise<DriveIncident[]> {
  const pad = 0.03;
  const minLat = Math.min(points.fromLat, points.toLat) - pad;
  const maxLat = Math.max(points.fromLat, points.toLat) + pad;
  const minLon = Math.min(points.fromLon, points.toLon) - pad;
  const maxLon = Math.max(points.fromLon, points.toLon) + pad;

  const fields =
    "{incidents{properties{iconCategory,magnitudeOfDelay,delay,roadNumbers,events{description}}}}";
  const url =
    `https://api.tomtom.com/traffic/services/5/incidentDetails` +
    `?key=${key}&bbox=${minLon},${minLat},${maxLon},${maxLat}` +
    `&fields=${encodeURIComponent(fields)}&language=en-GB&timeValidityFilter=present`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`TomTom incidents failed [${response.status}]: ${await response.text()}`);
      return [];
    }
    const payload = (await response.json()) as {
      incidents?: Array<{
        properties?: {
          magnitudeOfDelay?: number;
          delay?: number;
          roadNumbers?: string[];
          events?: Array<{ description?: string }>;
        };
      }>;
    };
    const out: DriveIncident[] = [];
    for (const incident of payload.incidents ?? []) {
      const description = incident.properties?.events?.[0]?.description;
      if (!description) continue;
      // Skip trivial slow-downs; only report what changes the number.
      if ((incident.properties?.magnitudeOfDelay ?? 0) < 2) continue;
      const road = incident.properties?.roadNumbers?.[0] ?? null;
      const delay = incident.properties?.delay;
      out.push({
        description,
        road,
        delayMinutes: typeof delay === "number" ? Math.round(delay / 60) : null,
      });
      if (out.length === 3) break;
    }
    return out;
  } catch (error) {
    console.error("TomTom incidents error", error);
    return [];
  }
}
