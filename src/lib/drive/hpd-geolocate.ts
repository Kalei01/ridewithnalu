/**
 * Puts Honolulu Police traffic reports on the map. The feed has no coordinates,
 * only an address ("H-1 Fwy EB / Moanalua", "Kamehameha Hwy / Kaiahua St") and an
 * area. Three ways to place one, best first:
 *
 *  1. Freeway + exit: the Oʻahu freeway gazetteer (hpd-freeways.ts). Exact, on the
 *     carriageway of the stated direction. No network.
 *  2. Street intersection / block address: TomTom Geocoding (its own monthly
 *     quota, separate from routing), restricted to Oʻahu and cached per
 *     normalized address for days (addresses repeat all day). Exact only when
 *     TomTom returns a cross street or a point address. If TomTom is paused,
 *     over quota or unreachable, Mapbox geocoding answers instead; Mapbox's
 *     terms allow temporary use only, so its results are never put in the address
 *     cache and are always "approximate".
 *  3. Anything else: the centroid of the report's area, "approximate" with a wide
 *     soft radius. An approximate report is a pin and a circle, never an alert.
 *
 * The direction (EB/WB/NB/SB) always comes from the address text, not from the geocoder.
 */
import { countCall, noteTomtomOutcome, quotaSpent, tomtomAvailable } from "./tomtom-guard";
import type { GeoPoint } from "./incident-correlation";
import {
  nearestOnFreeway,
  parseHeading,
  placeOnFreeway,
  plain,
  stripHeading,
  type FreewayId,
  type Heading,
} from "./hpd-freeways";

export type HpdGeoConfidence = "exact" | "approximate";
export type HpdGeo = {
  point: GeoPoint;
  confidence: HpdGeoConfidence;
  /** Soft radius for the map: how far from `point` the real spot could be. */
  radiusM: number;
  /** From the address text; null when the report names no direction. */
  direction: Heading | null;
  how: "freeway-exit" | "freeway-area" | "intersection" | "address" | "street" | "area";
  provider: "gazetteer" | "tomtom" | "mapbox" | "area" | "feed";
  /** Set when the report is on a gazetteer freeway. */
  freeway: FreewayId | null;
};

const OAHU = { minLat: 21.2, maxLat: 21.75, minLon: -158.35, maxLon: -157.6 };
const insideOahu = (p: GeoPoint) =>
  p.lat >= OAHU.minLat && p.lat <= OAHU.maxLat && p.lon >= OAHU.minLon && p.lon <= OAHU.maxLon;

/** Geocode answers live this long (addresses repeat for days); a clean "not found" a shorter while. */
export const GEO_TTL_MS = 3 * 24 * 3600_000;
export const GEO_MISS_TTL_MS = 6 * 3600_000;
const GEO_MAX_ENTRIES = 1500;
/** New provider lookups allowed per feed refresh, so one refresh can never spend the month's quota. */
export const MAX_NEW_LOOKUPS = 25;

// ---- area centroids (approximate placement only) -----------------------------

const AREA_CENTROIDS: Array<[RegExp, GeoPoint]> = [
  [/KAPOLEI|EWA|BARBERS|KO OLINA/, { lat: 21.3355, lon: -158.07 }],
  [/WAIANAE|NANAKULI|MAKAHA/, { lat: 21.4425, lon: -158.185 }],
  [/WAIPAHU/, { lat: 21.3867, lon: -158.0092 }],
  [/PEARL CITY|AIEA|WAIAU|WAIMALU/, { lat: 21.3945, lon: -157.9555 }],
  [/MILILANI|WAHIAWA|WAIPIO/, { lat: 21.455, lon: -158.015 }],
  [/NORTH SHORE|HALEIWA|WAIALUA|KAHUKU/, { lat: 21.595, lon: -158.1 }],
  [/KANEOHE|WINDWARD|KAHALUU|HEEIA/, { lat: 21.4085, lon: -157.8 }],
  [/KAILUA|WAIMANALO/, { lat: 21.4, lon: -157.74 }],
  [/KALIHI|MOANALUA|AIRPORT|SALT LAKE|MAPUNAPUNA/, { lat: 21.335, lon: -157.8925 }],
  [/WAIKIKI|KAPAHULU/, { lat: 21.2815, lon: -157.8285 }],
  [
    /KAIMUKI|KAHALA|WAIALAE|DIAMOND HEAD|EAST HONOLULU|HAWAII KAI|KALANIANAOLE|NIU/,
    { lat: 21.285, lon: -157.78 },
  ],
  [
    /ALA MOANA|KAKAAKO|DOWNTOWN|HONOLULU|MAKIKI|MANOA|NUUANU|CENTRAL/,
    { lat: 21.3069, lon: -157.8583 },
  ],
];

export function areaCentroid(area: string | null | undefined): GeoPoint | null {
  if (!area) return null;
  const t = plain(area);
  for (const [pattern, point] of AREA_CENTROIDS) if (pattern.test(t)) return point;
  return null;
}

// ---- address cache -----------------------------------------------------------

type Found = {
  point: GeoPoint;
  kind: "cross" | "address" | "street";
  provider: "tomtom";
};
type CacheEntry = { at: number; found: Found | null; unavailable?: true };
/** After a failed provider call the address is not asked again for this long. */
export const GEO_UNAVAILABLE_TTL_MS = 10 * 60_000;
const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<Found | "unavailable" | "skipped" | null>>();

export function resetHpdGeo(): void {
  cache.clear();
  inflight.clear();
}

export function hpdGeoCacheSize(): number {
  return cache.size;
}

/** One key per physical place: direction words, case, ʻokina and street suffix spellings do not matter. */
export function addressCacheKey(address: string): string {
  return stripHeading(address)
    .replace(/\bHIGHWAY\b/g, "HWY")
    .replace(/\bFREEWAY\b/g, "FWY")
    .replace(/\bBOULEVARD\b/g, "BLVD")
    .replace(/\bROAD\b/g, "RD")
    .replace(/\bSTREET\b/g, "ST")
    .replace(/\bAVENUE\b/g, "AVE")
    .replace(/\bPARKWAY\b/g, "PKWY")
    .replace(/\bDRIVE\b/g, "DR")
    .replace(/\s*(?:&|@|\bAT\b|\bAND\b)\s*/g, " / ")
    .replace(/\bBLK\b|\bBLOCK\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function remember(key: string, entry: CacheEntry): void {
  cache.delete(key);
  cache.set(key, entry);
  while (cache.size > GEO_MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (typeof oldest !== "string") break;
    cache.delete(oldest);
  }
}

// ---- providers ---------------------------------------------------------------

export type GeoDeps = {
  fetcher: typeof fetch;
  tomtomKey: string;
  mapboxToken: string;
  now: number;
  /** Cache and gazetteer only: no provider call of any kind (health checks, previews). */
  offline?: boolean;
};

export function defaultGeoDeps(now = Date.now()): GeoDeps {
  return {
    fetcher: fetch,
    tomtomKey: (typeof process !== "undefined" ? process.env?.["TOMTOM_API_KEY"] : "") ?? "",
    mapboxToken: (typeof process !== "undefined" ? process.env?.["MAPBOX_ACCESS_TOKEN"] : "") ?? "",
    now,
  };
}

type TomTomResult = {
  type?: string;
  position?: { lat?: number; lon?: number };
  address?: { streetName?: string; freeformAddress?: string };
};

/** "KAMEHAMEHA HWY / KAIAHUA ST" → "KAMEHAMEHA HWY & KAIAHUA ST" for a cross-street lookup. */
function crossQuery(key: string): string {
  return key.split(" / ").join(" & ");
}

const STREET_WORDS = new Set([
  "HWY",
  "RD",
  "ST",
  "AVE",
  "BLVD",
  "PKWY",
  "DR",
  "LN",
  "PL",
  "N",
  "S",
  "E",
  "W",
]);

/** The distinctive word of a street ("KAMEHAMEHA" from "KAMEHAMEHA HWY"). */
function mainWord(street: string): string | null {
  return (
    stripHeading(street)
      .split(" ")
      .find((w) => /[A-Z]/.test(w) && w.length > 2 && !STREET_WORDS.has(w)) ?? null
  );
}

/** Does the answer name at least one of the streets we asked about? */
function namesMatch(result: TomTomResult, streets: string[]): boolean {
  const text = plain(
    `${result.address?.streetName ?? ""} ${result.address?.freeformAddress ?? ""}`,
  );
  if (!text.trim()) return false;
  return streets.some((street) => {
    const word = mainWord(street);
    return word !== null && text.includes(word);
  });
}

/**
 * One TomTom Geocoding lookup. The plain /search/2/geocode endpoint is used (country and the
 * Oʻahu box only, no idxSet: its behaviour could not be checked from here), so nothing is
 * trusted on faith: the answer is "exact" only when TomTom says the result is a Cross Street
 * (for an intersection) or a Point Address (for a block address) AND the street it names is
 * one of the streets in the report. A result with no type, another type, or other street
 * names is "approximate". "skipped" = no call was made (no key, breaker open, quota spent);
 * "unavailable" = a call was made and failed.
 */
async function tomtomGeocode(
  key: string,
  deps: GeoDeps,
): Promise<Found | "unavailable" | "skipped" | null> {
  if (
    !deps.tomtomKey ||
    !tomtomAvailable("geocoding", deps.now) ||
    quotaSpent("tomtomGeocoding", deps.now)
  )
    return "skipped";
  const streets = key.split(" / ").filter(Boolean);
  const isCross = streets.length >= 2;
  const attempts: Array<{ query: string; kind: Found["kind"] }> = isCross
    ? [
        { query: crossQuery(key), kind: "cross" },
        { query: streets[0]!, kind: "street" },
      ]
    : /^\d/.test(key)
      ? [{ query: key, kind: "address" }]
      : [{ query: key, kind: "street" }];
  for (const attempt of attempts) {
    countCall("tomtomGeocoding", deps.now);
    try {
      const params = new URLSearchParams({
        key: deps.tomtomKey,
        countrySet: "US",
        limit: "3",
        language: "en-US",
        topLeft: `${OAHU.maxLat},${OAHU.minLon}`,
        btmRight: `${OAHU.minLat},${OAHU.maxLon}`,
      });
      const response = await deps.fetcher(
        `https://api.tomtom.com/search/2/geocode/${encodeURIComponent(attempt.query)}.json?${params}`,
        { signal: AbortSignal.timeout(4000) },
      );
      noteTomtomOutcome(response.status, "geocoding", deps.now);
      if (!response.ok) return "unavailable";
      const payload = (await response.json()) as { results?: TomTomResult[] };
      for (const result of payload.results ?? []) {
        const lat = result.position?.lat;
        const lon = result.position?.lon;
        if (typeof lat !== "number" || typeof lon !== "number") continue;
        const point = { lat, lon };
        if (!insideOahu(point)) continue;
        const exact =
          namesMatch(result, streets) &&
          ((attempt.kind === "cross" && result.type === "Cross Street") ||
            (attempt.kind === "address" && result.type === "Point Address"));
        return { point, kind: exact ? attempt.kind : "street", provider: "tomtom" };
      }
    } catch (error) {
      noteTomtomOutcome(
        error instanceof Error && error.name === "TimeoutError" ? "timeout" : "error",
        "geocoding",
        deps.now,
      );
      return "unavailable";
    }
  }
  return null;
}

/** Mapbox temporary geocoding: used for this response only, never cached, always approximate. */
async function mapboxGeocode(key: string, deps: GeoDeps): Promise<GeoPoint | null> {
  if (!deps.mapboxToken) return null;
  try {
    const query = key.split(" / ").join(" and ");
    const params = new URLSearchParams({
      access_token: deps.mapboxToken,
      bbox: `${OAHU.minLon},${OAHU.minLat},${OAHU.maxLon},${OAHU.maxLat}`,
      country: "us",
      limit: "1",
      types: "address,street,poi",
    });
    const response = await deps.fetcher(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?${params}`,
      { signal: AbortSignal.timeout(4000), headers: { Referer: "https://ridenalu.com/" } },
    );
    if (!response.ok) return null;
    const payload = (await response.json()) as { features?: Array<{ center?: number[] }> };
    const center = payload.features?.[0]?.center;
    const point = center && center.length >= 2 ? { lat: center[1]!, lon: center[0]! } : null;
    return point && insideOahu(point) ? point : null;
  } catch {
    return null;
  }
}

type Budget = { left: number };

/** Cached TomTom geocode of a normalized address. */
async function geocodeKey(
  key: string,
  deps: GeoDeps,
  budget: Budget,
): Promise<{ found: Found | null } | "unavailable" | "over-budget"> {
  const hit = cache.get(key);
  if (hit) {
    if (hit.unavailable) {
      if (deps.now - hit.at < GEO_UNAVAILABLE_TTL_MS) return "unavailable";
    } else if (deps.now - hit.at < (hit.found ? GEO_TTL_MS : GEO_MISS_TTL_MS)) {
      return { found: hit.found };
    }
  }
  if (deps.offline) return "unavailable";
  const running = inflight.get(key);
  if (running) {
    const shared = await running;
    return shared === "unavailable" || shared === "skipped" ? "unavailable" : { found: shared };
  }
  if (budget.left <= 0) return "over-budget";
  budget.left -= 1;
  const task = tomtomGeocode(key, deps);
  inflight.set(key, task);
  try {
    const result = await task;
    if (result === "skipped") return "unavailable";
    if (result === "unavailable") {
      remember(key, { at: deps.now, found: null, unavailable: true });
      return "unavailable";
    }
    remember(key, { at: deps.now, found: result });
    return { found: result };
  } finally {
    inflight.delete(key);
  }
}

// ---- placing one report ------------------------------------------------------

export type PlaceOutcome = { geo: HpdGeo | null; reason: "placed" | "no-location" | "over-budget" };

/**
 * Place one address. `budget` caps how many fresh provider lookups a batch may make.
 * Never throws.
 */
export async function placeHpdAddress(
  address: string,
  area: string | null,
  deps: GeoDeps,
  budget: Budget = { left: MAX_NEW_LOOKUPS },
): Promise<PlaceOutcome> {
  try {
    const direction = parseHeading(address);
    const centroid = areaCentroid(area);

    // 1. Freeway + exit from the gazetteer.
    const freeway = placeOnFreeway(address);
    if (freeway) {
      if (freeway.match === "exit")
        return {
          reason: "placed",
          geo: {
            point: freeway.point,
            // Only a node placed at a real exit maneuver is exact; a snapped name is a soft pin.
            confidence: freeway.verified ? "exact" : "approximate",
            radiusM: freeway.verified ? 150 : 800,
            direction: freeway.heading,
            how: "freeway-exit",
            provider: "gazetteer",
            freeway: freeway.freeway,
          },
        };
      // A freeway with no exit we know: somewhere along it, nearest the report's area.
      if (centroid)
        return {
          reason: "placed",
          geo: {
            point: nearestOnFreeway(freeway.freeway, centroid, freeway.heading),
            confidence: "approximate",
            radiusM: 2500,
            direction: freeway.heading,
            how: "freeway-area",
            provider: "area",
            freeway: freeway.freeway,
          },
        };
      return { geo: null, reason: "no-location" };
    }

    // 2. Streets: TomTom geocoding (cached), Mapbox only when TomTom cannot answer.
    const key = addressCacheKey(address);
    const result = key ? await geocodeKey(key, deps, budget) : "unavailable";
    if (result === "over-budget") {
      return centroid
        ? { reason: "over-budget", geo: areaGeo(centroid, direction) }
        : { geo: null, reason: "over-budget" };
    }
    if (result === "unavailable") {
      const point = key && !deps.offline ? await mapboxGeocode(key, deps) : null;
      if (point)
        return {
          reason: "placed",
          geo: {
            point,
            confidence: "approximate",
            radiusM: 800,
            direction,
            how: "street",
            provider: "mapbox",
            freeway: null,
          },
        };
      return centroid
        ? { reason: "placed", geo: areaGeo(centroid, direction) }
        : { geo: null, reason: "no-location" };
    }
    const found = result.found;
    if (found) {
      const exact = found.kind === "cross" || found.kind === "address";
      return {
        reason: "placed",
        geo: {
          point: found.point,
          confidence: exact ? "exact" : "approximate",
          radiusM: found.kind === "cross" ? 80 : found.kind === "address" ? 100 : 1200,
          direction,
          how:
            found.kind === "cross"
              ? "intersection"
              : found.kind === "address"
                ? "address"
                : "street",
          provider: "tomtom",
          freeway: null,
        },
      };
    }
    return centroid
      ? { reason: "placed", geo: areaGeo(centroid, direction) }
      : { geo: null, reason: "no-location" };
  } catch {
    return { geo: null, reason: "no-location" };
  }
}

function areaGeo(point: GeoPoint, direction: Heading | null): HpdGeo {
  return {
    point,
    confidence: "approximate",
    radiusM: 3000,
    direction,
    how: "area",
    provider: "area",
    freeway: null,
  };
}

export type PlacementStats = { total: number; placed: number; exact: number; approximate: number };

export function placementSummary(stats: PlacementStats): string {
  return `placed ${stats.placed} of ${stats.total} (exact ${stats.exact}, approximate ${stats.approximate})`;
}

/** A report whose feed row carried its own coordinates: exact as given. */
export function feedGeo(point: GeoPoint, address: string): HpdGeo {
  return {
    point,
    confidence: "exact",
    radiusM: 50,
    direction: parseHeading(address),
    how: "address",
    provider: "feed",
    freeway: null,
  };
}

/** Place many reports (shared address lookups run once). Reports with a feed-given point are exact as-is. */
export async function placeHpdBatch<
  T extends { address: string; area: string | null; point: GeoPoint | null },
>(
  reports: T[],
  deps: GeoDeps = defaultGeoDeps(),
): Promise<{ placed: Array<T & { geo: HpdGeo | null }>; stats: PlacementStats }> {
  const budget: Budget = { left: MAX_NEW_LOOKUPS };
  const stats: PlacementStats = { total: reports.length, placed: 0, exact: 0, approximate: 0 };
  // Lookups start together (the budget is spent synchronously, shared lookups run once).
  const placed = await Promise.all(
    reports.map(async (report): Promise<T & { geo: HpdGeo | null }> => {
      if (report.point) return { ...report, geo: feedGeo(report.point, report.address) };
      return {
        ...report,
        geo: (await placeHpdAddress(report.address, report.area, deps, budget)).geo,
      };
    }),
  );
  for (const report of placed) {
    if (!report.geo) continue;
    stats.placed += 1;
    if (report.geo.confidence === "exact") stats.exact += 1;
    else stats.approximate += 1;
  }
  return { placed, stats };
}
