import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const scheduledSchema = z.object({
  routeShortName: z.string().nullable(),
  headsign: z.string().nullable(),
  scheduledSeconds: z.number().int(),
});

const inputSchema = z.object({
  stopId: z.string().trim().min(1).max(40),
  scheduled: z.array(scheduledSchema).max(12).default([]),
});

export type BusArrival = {
  routeShortName: string;
  headsign: string;
  estimatedArrivalTime: string | null;
  scheduledArrivalTime: string;
  estimatedSeconds: number;
  scheduledSeconds: number;
  isDelayed: boolean;
  delayMinutes: number;
  minutesAway: number;
  isLive: boolean;
  canceled: boolean;
};

export type BusArrivalsResult = {
  arrivals: BusArrival[];
  error: boolean;
  configured: boolean;
  fetchedAt: number;
};

type CachedFeed = { expiresAt: number; xml: string };
const CACHE_MS = 30_000;
const cache = new Map<string, CachedFeed>();

function text(xml: string, tag: string) {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return (match?.[1] ?? "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .trim();
}

function honoluluSecondsNow() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Pacific/Honolulu",
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date());
  const number = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  return number("hour") * 3600 + number("minute") * 60 + number("second");
}

function parseClock(value: string, nowSeconds: number) {
  const match = value.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AP]M)?/i);
  if (!match) return null;
  let hour = Number(match[1]);
  const meridiem = match[4]?.toUpperCase();
  if (meridiem === "PM" && hour !== 12) hour += 12;
  if (meridiem === "AM" && hour === 12) hour = 0;
  let seconds = hour * 3600 + Number(match[2]) * 60 + Number(match[3] ?? 0);
  if (seconds < nowSeconds - 6 * 3600) seconds += 24 * 3600;
  return seconds;
}

function clock(seconds: number) {
  const wrapped = ((seconds % 86400) + 86400) % 86400;
  const hour = Math.floor(wrapped / 3600);
  const minute = Math.floor((wrapped % 3600) / 60);
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: "UTC" }).format(
    new Date(Date.UTC(2020, 0, 1, hour, minute)),
  );
}

function normalize(value: string | null) {
  return (value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export const busArrivals = createServerFn({ method: "POST" })
  .inputValidator((input) => inputSchema.parse(input))
  .handler(async ({ data }): Promise<BusArrivalsResult> => {
    const key = process.env["HEA_API_KEY"];
    const failed = (configured: boolean): BusArrivalsResult => ({
      arrivals: [], error: true, configured, fetchedAt: Date.now(),
    });
    if (!key) return failed(false);

    try {
      const cached = cache.get(data.stopId);
      let xml: string;
      if (cached && cached.expiresAt > Date.now()) {
        xml = cached.xml;
      } else {
        const url = new URL("http://api.thebus.org/arrivals/");
        url.searchParams.set("key", key);
        url.searchParams.set("stop", data.stopId);
        const response = await fetch(url, { signal: AbortSignal.timeout(8_000) });
        if (!response.ok) return failed(true);
        xml = await response.text();
        cache.set(data.stopId, { xml, expiresAt: Date.now() + CACHE_MS });
      }
      if (text(xml, "errorMessage")) return failed(true);

      const nowSeconds = honoluluSecondsNow();
      const blocks = xml.match(/<arrival\b[^>]*>[\s\S]*?<\/arrival>/gi) ?? [];
      const arrivals = blocks.flatMap((block): BusArrival[] => {
        const routeShortName = text(block, "route");
        const headsign = text(block, "headsign");
        const predictedClock = text(block, "stopTime");
        const predictedSeconds = parseClock(predictedClock, nowSeconds);
        if (predictedSeconds === null) return [];
        const routeMatches = data.scheduled.filter((item) => normalize(item.routeShortName) === normalize(routeShortName));
        const headsignMatches = routeMatches.filter((item) => {
          const a = normalize(item.headsign);
          const b = normalize(headsign);
          return !a || !b || a.includes(b) || b.includes(a);
        });
        const candidates = headsignMatches.length > 0 ? headsignMatches : routeMatches;
        const scheduled = candidates.sort(
          (a, b) => Math.abs(a.scheduledSeconds - predictedSeconds) - Math.abs(b.scheduledSeconds - predictedSeconds),
        )[0];
        const scheduledSeconds = scheduled?.scheduledSeconds ?? predictedSeconds;
        const isLive = text(block, "estimated") === "1";
        const delayMinutes = isLive ? Math.round((predictedSeconds - scheduledSeconds) / 60) : 0;
        return [{
          routeShortName,
          headsign,
          estimatedArrivalTime: isLive ? predictedClock : null,
          scheduledArrivalTime: clock(scheduledSeconds),
          estimatedSeconds: predictedSeconds,
          scheduledSeconds,
          isDelayed: delayMinutes > 2,
          delayMinutes,
          minutesAway: Math.max(0, Math.ceil((predictedSeconds - nowSeconds) / 60)),
          isLive,
          canceled: text(block, "canceled") === "1",
        }];
      }).filter((arrival) => !arrival.canceled).sort((a, b) => a.estimatedSeconds - b.estimatedSeconds);

      return { arrivals, error: false, configured: true, fetchedAt: Date.now() };
    } catch (error) {
      console.error("TheBus HEA arrivals failed", error instanceof Error ? error.message : "Unknown error");
      return failed(true);
    }
  });