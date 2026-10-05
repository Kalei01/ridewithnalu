import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const schema = z.object({
  fromLat: z.number(),
  fromLon: z.number(),
  toLat: z.number(),
  toLon: z.number(),
});

/** Walking is only worth offering for short trips. */
export const WALK_LIMIT_MINUTES = 20;

/**
 * Walking time on real streets (TomTom pedestrian routing), so "Walk · 12 min"
 * is a real estimate, not a straight line. Null when unavailable.
 */
export const walkTime = createServerFn({ method: "POST" })
  .validator((input) => schema.parse(input))
  .handler(async ({ data }): Promise<{ minutes: number; meters: number } | null> => {
    const key = process.env["TOMTOM_API_KEY"] ?? "";
    if (!key) return null;
    const points = `${data.fromLat},${data.fromLon}:${data.toLat},${data.toLon}`;
    const url = `https://api.tomtom.com/routing/1/calculateRoute/${points}/json?travelMode=pedestrian&routeType=shortest&key=${key}`;
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!response.ok) {
        console.warn(`[walk] TomTom pedestrian routing returned ${response.status}`);
        return null;
      }
      const payload = (await response.json()) as {
        routes?: Array<{ summary?: { travelTimeInSeconds?: number; lengthInMeters?: number } }>;
      };
      const summary = payload.routes?.[0]?.summary;
      if (!summary?.travelTimeInSeconds) return null;
      return {
        minutes: Math.max(1, Math.round(summary.travelTimeInSeconds / 60)),
        meters: summary.lengthInMeters ?? 0,
      };
    } catch (error) {
      console.warn("[walk] pedestrian routing failed", error);
      return null;
    }
  });
