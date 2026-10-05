import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { SITE_URL } from "@/lib/site";

const pointSchema = z.object({
  id: z.string(),
  lat: z.number(),
  lon: z.number(),
  /** Minutes from now that this outdoor moment happens. */
  offsetMinutes: z.number(),
});

const schema = z.object({
  points: z.array(pointSchema).max(12),
  /** Coordinate to read air quality for; omitted when nothing is outdoors long enough. */
  airLat: z.number().nullable().optional(),
  airLon: z.number().nullable().optional(),
});

export type MomentConditions = {
  id: string;
  /** Chance of precipitation, 0-100. */
  precipPercent: number | null;
  humidityPercent: number | null;
  /** Feels-like temperature in °F. */
  heatIndexF: number | null;
  shortForecast: string | null;
};

export type AirQuality = {
  /** 1 = Good, 2 = Moderate, 3 = Unhealthy for sensitive groups, 4+ = Unhealthy or worse. */
  category: number;
};

export type WeatherResult = {
  moments: MomentConditions[];
  air: AirQuality | null;
};

const USER_AGENT = `(NaluApp/1.0, ${SITE_URL})`;
const FORECAST_TTL_MS = 20 * 60_000;
const AIR_TTL_MS = 60 * 60_000;

type HourlyPeriod = {
  startTime?: string;
  endTime?: string;
  temperature?: number;
  temperatureUnit?: string;
  shortForecast?: string;
  probabilityOfPrecipitation?: { value?: number | null };
  relativeHumidity?: { value?: number | null };
  heatIndex?: { value?: number | null; unitCode?: string };
};

const forecastCache = new Map<string, { at: number; periods: HourlyPeriod[] }>();
const airCache = new Map<string, { at: number; air: AirQuality | null }>();

// Share identical in-flight provider requests so concurrent commute moments do not
// fan out into duplicate NWS/AirNow calls before the response reaches the cache.
const forecastInflight = new Map<string, Promise<HourlyPeriod[] | null>>();
const airInflight = new Map<string, Promise<AirQuality | null>>();
const MAX_CACHE_ENTRIES = 64;

function setBoundedCache<T>(cache: Map<string, T>, key: string, value: T) {
  cache.delete(key);
  cache.set(key, value);
  while (cache.size > MAX_CACHE_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (typeof oldest !== "string") break;
    cache.delete(oldest);
  }
}

function coordKey(lat: number, lon: number) {
  // ~1 km buckets: plenty of resolution for a forecast, and cache-friendly.
  return `${lat.toFixed(2)},${lon.toFixed(2)}`;
}

/** Rothfusz heat index, used only when NWS does not supply one. */
function heatIndexF(tempF: number, humidity: number): number {
  if (tempF < 80) return tempF;
  const t = tempF;
  const r = humidity;
  let hi =
    -42.379 +
    2.04901523 * t +
    10.14333127 * r -
    0.22475541 * t * r -
    0.00683783 * t * t -
    0.05481717 * r * r +
    0.00122874 * t * t * r +
    0.00085282 * t * r * r -
    0.00000199 * t * t * r * r;
  if (r < 13 && t >= 80 && t <= 112) hi -= ((13 - r) / 4) * Math.sqrt((17 - Math.abs(t - 95)) / 17);
  else if (r > 85 && t >= 80 && t <= 87) hi += ((r - 85) / 10) * ((87 - t) / 5);
  return hi;
}

async function getHourly(lat: number, lon: number): Promise<HourlyPeriod[] | null> {
  const key = coordKey(lat, lon);
  const cached = forecastCache.get(key);
  if (cached && Date.now() - cached.at < FORECAST_TTL_MS) return cached.periods;

  const existing = forecastInflight.get(key);
  if (existing) return existing;

  const request = (async () => {
    try {
      const headers = { "User-Agent": USER_AGENT, Accept: "application/geo+json" };
      const pointsResponse = await fetch(
        `https://api.weather.gov/points/${lat.toFixed(4)},${lon.toFixed(4)}`,
        { signal: AbortSignal.timeout(5000), headers },
      );
      if (!pointsResponse.ok) return null;
      const pointsPayload = (await pointsResponse.json()) as {
        properties?: { forecastHourly?: string };
      };
      const hourlyUrl = pointsPayload.properties?.forecastHourly;
      if (!hourlyUrl) return null;

      const hourlyResponse = await fetch(hourlyUrl, { signal: AbortSignal.timeout(5000), headers });
      if (!hourlyResponse.ok) return null;
      const hourlyPayload = (await hourlyResponse.json()) as {
        properties?: { periods?: HourlyPeriod[] };
      };
      const periods = hourlyPayload.properties?.periods ?? [];
      if (!periods.length) return null;
      setBoundedCache(forecastCache, key, { at: Date.now(), periods });
      return periods;
    } catch (error) {
      console.error("NWS forecast unavailable", error);
      return null;
    } finally {
      forecastInflight.delete(key);
    }
  })();

  forecastInflight.set(key, request);
  return request;
}

function periodAt(periods: HourlyPeriod[], when: number): HourlyPeriod | null {
  for (const period of periods) {
    const start = period.startTime ? Date.parse(period.startTime) : NaN;
    const end = period.endTime ? Date.parse(period.endTime) : NaN;
    if (Number.isFinite(start) && Number.isFinite(end) && when >= start && when < end)
      return period;
  }
  return periods[0] ?? null;
}

async function getAir(lat: number, lon: number): Promise<AirQuality | null> {
  const key = coordKey(lat, lon);
  const cached = airCache.get(key);
  if (cached && Date.now() - cached.at < AIR_TTL_MS) return cached.air;

  const existing = airInflight.get(key);
  if (existing) return existing;

  const apiKey = process.env["AIRNOW_API_KEY"];
  if (!apiKey) return null;

  const request = (async () => {
    try {
      const url =
        `https://www.airnowapi.org/aq/observation/latLong/current/?format=application/json` +
        `&latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}&distance=25&API_KEY=${apiKey}`;
      const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (!response.ok) return null;
      const payload = (await response.json()) as Array<{
        Category?: { Number?: number };
      }>;
      let category = 0;
      for (const observation of payload ?? []) {
        const value = observation.Category?.Number;
        if (typeof value === "number" && value > category) category = value;
      }
      const air = category > 0 ? { category } : null;
      setBoundedCache(airCache, key, { at: Date.now(), air });
      return air;
    } catch (error) {
      console.error("AirNow unavailable", error);
      return null;
    } finally {
      airInflight.delete(key);
    }
  })();

  airInflight.set(key, request);
  return request;
}

/**
 * Forecast conditions for each outdoor moment of a trip, plus air quality.
 * Every failure resolves to empty data so the commute never waits on weather.
 */
export const outdoorConditions = createServerFn({ method: "POST" })
  .inputValidator((input) => schema.parse(input))
  .handler(async ({ data }): Promise<WeatherResult> => {
    const now = Date.now();

    const moments = await Promise.all(
      data.points.map(async (point): Promise<MomentConditions> => {
        const periods = await getHourly(point.lat, point.lon);
        const empty: MomentConditions = {
          id: point.id,
          precipPercent: null,
          humidityPercent: null,
          heatIndexF: null,
          shortForecast: null,
        };
        if (!periods) return empty;
        const period = periodAt(periods, now + point.offsetMinutes * 60_000);
        if (!period) return empty;

        const humidity = period.relativeHumidity?.value ?? null;
        const temperature =
          typeof period.temperature === "number" && period.temperatureUnit !== "C"
            ? period.temperature
            : typeof period.temperature === "number"
              ? period.temperature * 1.8 + 32
              : null;
        const suppliedHeat = period.heatIndex?.value;
        const heat =
          typeof suppliedHeat === "number"
            ? period.heatIndex?.unitCode?.includes("degC")
              ? suppliedHeat * 1.8 + 32
              : suppliedHeat
            : temperature !== null && humidity !== null
              ? heatIndexF(temperature, humidity)
              : null;

        return {
          id: point.id,
          precipPercent: period.probabilityOfPrecipitation?.value ?? null,
          humidityPercent: humidity,
          heatIndexF: heat === null ? null : Math.round(heat),
          shortForecast: period.shortForecast ?? null,
        };
      }),
    );

    const air =
      typeof data.airLat === "number" && typeof data.airLon === "number"
        ? await getAir(data.airLat, data.airLon)
        : null;

    return { moments, air };
  });
