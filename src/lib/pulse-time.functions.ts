import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { localPulseClock } from "./intelligence/pulse-time";

const coordinate = z.object({
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
});

const inputSchema = z.object({
  home: coordinate,
  work: coordinate,
  fallbackTimeZone: z.string().min(1).max(100),
});

type TimeZoneLookup = { timezone: string; source: "TomTom" | "fallback" };

const inflight = new Map<string, Promise<TimeZoneLookup>>();

async function resolveTimeZone(point: z.infer<typeof coordinate>, fallbackTimeZone: string): Promise<TimeZoneLookup> {
  const key = process.env["TOMTOM_API_KEY"];
  if (!key) return { timezone: fallbackTimeZone, source: "fallback" };

  const cacheKey = `${point.lat.toFixed(5)},${point.lon.toFixed(5)}`;
  const existing = inflight.get(cacheKey);
  if (existing) return existing;

  const request = (async () => {
    try {
      const url =
        `https://api.tomtom.com/search/2/reverseGeocode/${point.lat},${point.lon}.json` +
        `?key=${encodeURIComponent(key)}&radius=100&language=en-US&dateTime=${encodeURIComponent(new Date().toISOString())}`;
      const response = await fetch(url);
      if (!response.ok) {
        console.warn("[pulse-time] TomTom timezone lookup failed", response.status);
        return { timezone: fallbackTimeZone, source: "fallback" as const };
      }

      const payload = (await response.json()) as {
        addresses?: Array<{
          address?: {
            timeZone?: { ianaId?: string };
          };
        }>;
      };
      const timezone = payload.addresses?.[0]?.address?.timeZone?.ianaId;
      if (timezone) return { timezone, source: "TomTom" as const };
      return { timezone: fallbackTimeZone, source: "fallback" as const };
    } catch (error) {
      console.warn("[pulse-time] timezone lookup error", error);
      return { timezone: fallbackTimeZone, source: "fallback" as const };
    } finally {
      inflight.delete(cacheKey);
    }
  })();

  inflight.set(cacheKey, request);
  return request;
}

export const pulseClocks = createServerFn({ method: "POST" })
  .inputValidator((input) => inputSchema.parse(input))
  .handler(async ({ data }) => {
    const [homeZone, workZone] = await Promise.all([
      resolveTimeZone(data.home, data.fallbackTimeZone),
      resolveTimeZone(data.work, data.fallbackTimeZone),
    ]);
    const now = new Date();

    return {
      home: localPulseClock(now, homeZone.timezone),
      work: localPulseClock(now, workZone.timezone),
      sources: {
        home: homeZone.source,
        work: workZone.source,
      },
    };
  });
