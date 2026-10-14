import { DOWNTOWN_POINT, KAPOLEI_POINT } from "@/lib/commute-model";
import { honoluluSeconds } from "@/lib/commute-formatting";
import { lookupDriveTime, type DriveTime } from "@/lib/drive.functions";
import { getHourly, periodAt } from "@/lib/weather.functions";
import { plannerClient } from "@/lib/transit-plan.server";
import { skylineStationIdFromText } from "@/lib/rail/station-names";
import { sharedAnswer } from "./shared-cache.server";
import { simplifyPath } from "./simplify-path";
import type { HomeLive, HomeShowers, HomeSkyline, HomeTraffic, HomeTrain } from "./home-types";

/** The live strip's whole answer is shared for this long (traffic inside it stays ≤ 2 min old). */
export const HOME_LIVE_MAX_AGE_MS = 30_000;
/** Traffic older than this is read again, so with the shared answer it is never past 2 minutes. */
const TRAFFIC_REFRESH_MS = 90_000;

/** Skyline's two end stations (GTFS stop ids) and the longest scheduled run, plus a margin. */
const EAST_KAPOLEI = "10047";
const KALIHI_TC = "10030";
const LONGEST_RUN_SECONDS = 2_100 + 120;

/** Named areas for "showers near …": the commute's two ends and the wetter sides of town. */
export const SHOWER_AREAS = [
  { area: "Kapolei", lat: 21.3358, lon: -158.0798 },
  { area: "Waipahu", lat: 21.3867, lon: -158.0092 },
  { area: "downtown Honolulu", lat: 21.3099, lon: -157.8644 },
  { area: "Mānoa", lat: 21.3069, lon: -157.81 },
  { area: "Kāneʻohe", lat: 21.4022, lon: -157.798 },
] as const;
/** NWS wording that means rain is expected, and the chance that makes it worth saying. */
const RAIN_WORDS = /\b(rain|showers?|drizzle|thunderstorms?)\b/i;
const SHOWER_MIN_PERCENT = 30;

function trafficFrom(direction: HomeTraffic["direction"], drive: DriveTime): HomeTraffic {
  return {
    direction,
    minutes: drive.trafficMinutes,
    typicalMinutes: drive.typicalMinutes,
    delayMinutes: drive.delayMinutes,
    corridor: drive.corridorLabel,
    fetchedAt: drive.fetchedAt,
    path: simplifyPath(drive.path, 40),
    sections: drive.trafficSections.map((section) => ({
      severity: section.severity,
      path: simplifyPath(section.points, 25),
    })),
  };
}

/** Kapolei ↔ downtown with live traffic: the same lookup (and two-minute cache) as Browse's H-1 check. */
async function liveTraffic(direction: HomeTraffic["direction"]): Promise<HomeTraffic | null> {
  const [from, to] =
    direction === "eastbound" ? [KAPOLEI_POINT, DOWNTOWN_POINT] : [DOWNTOWN_POINT, KAPOLEI_POINT];
  const ends = { fromLat: from.lat, fromLon: from.lon, toLat: to.lat, toLon: to.lon };
  try {
    let drive = await lookupDriveTime(ends);
    if (drive && Date.now() - drive.fetchedAt > TRAFFIC_REFRESH_MS)
      drive = await lookupDriveTime({ ...ends, forceRefresh: true });
    // Only live traffic tints the map; a future estimate or a failed check shows nothing.
    if (!drive || drive.trafficBasis !== "live") return null;
    return trafficFrom(direction, drive);
  } catch {
    return null;
  }
}

type DepartureRow = { trip_headsign: string | null; departure_seconds: number | null };

/** Trains that left an end of the line in the last ~37 minutes or leave soon: every train on the line now, as scheduled. */
async function trainsFrom(stopId: string, nowSeconds: number): Promise<HomeTrain[] | null> {
  const { data, error } = await plannerClient().rpc("rail_departures", {
    p_home_stop: stopId,
    p_after_seconds: Math.max(0, nowSeconds - LONGEST_RUN_SECONDS),
    p_limit: 12,
  });
  if (error || !Array.isArray(data)) return null;
  return (data as DepartureRow[])
    .filter((row) => typeof row.departure_seconds === "number")
    .map((row) => ({
      departSeconds: row.departure_seconds as number,
      endStopId: skylineStationIdFromText(row.trip_headsign) ?? null,
    }))
    .sort((a, b) => a.departSeconds - b.departSeconds);
}

async function skylineNow(nowSeconds: number): Promise<HomeSkyline | null> {
  try {
    const [eastbound, westbound] = await Promise.all([
      trainsFrom(EAST_KAPOLEI, nowSeconds),
      trainsFrom(KALIHI_TC, nowSeconds),
    ]);
    if (!eastbound || !westbound) return null;
    return { eastbound, westbound };
  } catch {
    return null;
  }
}

/** The named area with the likeliest rain this hour, when NWS expects showers somewhere. */
async function showersNow(): Promise<HomeShowers | null> {
  const now = Date.now();
  const reads = await Promise.all(
    SHOWER_AREAS.map(async ({ area, lat, lon }): Promise<HomeShowers | null> => {
      try {
        const periods = await getHourly(lat, lon);
        const period = periods ? periodAt(periods, now) : null;
        const forecast = period?.shortForecast ?? "";
        const percent = period?.probabilityOfPrecipitation?.value ?? null;
        if (!RAIN_WORDS.test(forecast) || (percent ?? 0) < SHOWER_MIN_PERCENT) return null;
        const read: HomeShowers = { area, percent, forecast };
        return read;
      } catch {
        return null;
      }
    }),
  );
  const wet = reads.filter((read): read is HomeShowers => read !== null);
  wet.sort((a, b) => (b.percent ?? 0) - (a.percent ?? 0));
  return wet[0] ?? null;
}

export async function buildHomeLive(): Promise<HomeLive> {
  const generated = new Date();
  const serviceSeconds = honoluluSeconds(generated);
  const [eastbound, westbound, skyline, showers] = await Promise.all([
    liveTraffic("eastbound"),
    liveTraffic("westbound"),
    skylineNow(serviceSeconds),
    showersNow(),
  ]);
  return {
    generatedAt: generated.getTime(),
    serviceSeconds,
    traffic: { eastbound, westbound },
    skyline,
    showers,
  };
}

/** The shared answer: one check per ~30 s per data center, however many people open the page. */
export async function homeLive(): Promise<HomeLive> {
  const entry = await sharedAnswer("home-live-v1", HOME_LIVE_MAX_AGE_MS, buildHomeLive);
  return entry?.value ?? (await buildHomeLive());
}
