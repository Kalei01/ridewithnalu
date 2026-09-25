import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const schema = z.object({ address: z.string().min(3).max(200) });
const searchSchema = z.object({ query: z.string().min(2).max(200) });

// Oahu bias: a bounding box only. An island-centre radius bias ranks
// identically named listings in Waipahu/'Aiea above the real town venue.
const OAHU_BOX = { topLeft: "21.75,-158.35", btmRight: "21.20,-157.60" };

type TomTomHit = {
  id?: string;
  type?: string;
  score?: number;
  poi?: { name?: string };
  position?: { lat?: number; lon?: number };
  entryPoints?: Array<{ type?: string; position?: { lat?: number; lon?: number } }>;
  address?: {
    freeformAddress?: string;
    municipality?: string;
    streetNumber?: string;
    streetName?: string;
  };
};

/** Door position when TomTom knows it, otherwise the listing position. */
function hitPoint(hit: TomTomHit) {
  const entry =
    hit.entryPoints?.find((point) => point.type === "main")?.position ??
    hit.entryPoints?.[0]?.position;
  const lat = entry?.lat ?? hit.position?.lat;
  const lon = entry?.lon ?? hit.position?.lon;
  return typeof lat === "number" && typeof lon === "number" ? { lat, lon } : null;
}

async function tomtomSearch(
  endpoint: "search" | "poiSearch",
  query: string,
  params: Record<string, string>,
): Promise<TomTomHit[]> {
  const search = new URLSearchParams({
    countrySet: "US",
    topLeft: OAHU_BOX.topLeft,
    btmRight: OAHU_BOX.btmRight,
    language: "en-US",
    ...params,
  });
  const url = `https://api.tomtom.com/search/2/${endpoint}/${encodeURIComponent(query)}.json?${search}`;
  const response = await fetch(url);
  if (!response.ok) {
    const body = await response.text();
    console.error(`TomTom ${endpoint} failed [${response.status}]: ${body}`);
    throw new Error(`Place search failed (${response.status}).`);
  }
  const payload = (await response.json()) as { results?: TomTomHit[] };
  return payload.results ?? [];
}

/** Geocodes free text inside Oahu, preferring named places for non-address queries. */
export const geocodeAddress = createServerFn({ method: "POST" })
  .inputValidator((input) => schema.parse(input))
  .handler(async ({ data }) => {
    const key = process.env["TOMTOM_API_KEY"];
    if (!key) throw new Error("Address lookup is not configured yet.");
    const addressQuery = looksLikeStreetAddress(data.address);
    const hits = await tomtomSearch("search", data.address, {
      key,
      limit: "10",
      idxSet: addressQuery ? "PAD,Addr,Str" : "POI,PAD,Addr,Geo,Str",
    });
    const ranked = hits
      .map((hit) => ({ hit, point: hitPoint(hit) }))
      .filter((row) => row.point && insideOahu(row.point.lat, row.point.lon))
      .sort(
        (a, b) =>
          (!addressQuery ? Number(b.hit.type === "POI") - Number(a.hit.type === "POI") : 0) ||
          (b.hit.score ?? 0) - (a.hit.score ?? 0),
      );
    const best = ranked[0];
    if (!best?.point) return { found: false as const };
    return {
      found: true as const,
      lat: best.point.lat,
      lon: best.point.lon,
      label: best.hit.address?.freeformAddress ?? data.address,
    };
  });

export type PlaceSuggestion = {
  id: string;
  name: string;
  address: string;
  lat: number;
  lon: number;
};

/** A query that starts with a house number is an address, not a place name. */
function looksLikeStreetAddress(query: string) {
  return /^\s*\d/.test(query);
}

function insideOahu(lat: number, lon: number) {
  return lat >= 21.2 && lat <= 21.75 && lon >= -158.35 && lon <= -157.6;
}

/**
 * Live destination suggestions from TomTom fuzzy search, kept inside Oahu.
 *
 * Bias is a bounding box only: an island-centre radius bias pushed town
 * results (e.g. Ala Moana Center) below identically named listings in
 * Waipahu and 'Aiea, which sent riders to the wrong side of the island.
 */
export const searchPlaces = createServerFn({ method: "POST" })
  .inputValidator((input) => searchSchema.parse(input))
  .handler(async ({ data }): Promise<{ results: PlaceSuggestion[] }> => {
    const key = process.env["TOMTOM_API_KEY"];
    if (!key) throw new Error("Place search is not configured yet.");

    const addressQuery = looksLikeStreetAddress(data.query);
    const hits = await tomtomSearch("search", data.query, {
      key,
      limit: "10",
      typeahead: "true",
      // A numbered query is a street address: keep shop listings out of it.
      idxSet: addressQuery ? "PAD,Addr,Str" : "POI,PAD,Addr,Geo,Str",
      extendedPostalCodesFor: addressQuery ? "PAD,Addr" : "POI,PAD,Addr",
    });

    const results: PlaceSuggestion[] = [];
    const seen = new Set<string>();
    const ranked = [...hits].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    for (const hit of ranked) {
      const point = hitPoint(hit);
      if (!point || !insideOahu(point.lat, point.lon)) continue;
      const address = hit.address?.freeformAddress ?? hit.address?.municipality ?? "";
      const name = hit.poi?.name || address;
      if (!name) continue;
      // Same name at the same address is one place, however many listings exist.
      const fingerprint = `${name.toLowerCase()}|${address.toLowerCase()}`;
      if (seen.has(fingerprint)) continue;
      seen.add(fingerprint);
      results.push({ id: hit.id ?? `${point.lat},${point.lon}`, name, address, ...point });
    }

    if (!addressQuery) {
      const venue = await resolveAmbiguousVenue(key, data.query, results).catch((error) => {
        console.error("Venue disambiguation failed", error);
        return null;
      });
      if (venue) {
        const rest = results.filter((row) => row.address.toLowerCase() !== venue.address.toLowerCase());
        return { results: [venue, ...rest].slice(0, 6) };
      }
    }
    return { results: results.slice(0, 6) };
  });

const GENERIC_VENUE_WORDS = /\b(shopping\s+cent(er|re)|cent(er|re)|mall|plaza|marketplace)\b/gi;

function normalizeStreet(hit: TomTomHit) {
  const number = hit.address?.streetNumber?.trim();
  const street = (hit.address?.streetName ?? "")
    .replace(/\bBlvd\b\.?/i, "Boulevard")
    .replace(/\bAve\b\.?/i, "Avenue")
    .replace(/\bSt\b\.?/i, "Street")
    .replace(/\bHwy\b\.?/i, "Highway")
    .trim()
    .toLowerCase();
  return number && street ? `${number} ${street}` : null;
}

/**
 * TomTom's Oahu data holds several listings that share one venue's name at
 * unrelated addresses (e.g. "Ala Moana Shopping Center" filed in Waipahu and
 * 'Aiea). When a typed name maps to 3+ addresses, the real venue is the
 * address its tenants agree on: search the core name and take the street
 * address shared by the most listings, then suggest that first.
 */
async function resolveAmbiguousVenue(
  key: string,
  query: string,
  results: PlaceSuggestion[],
): Promise<PlaceSuggestion | null> {
  const typed = query.trim().toLowerCase();
  const sameName = results.filter((row) => row.name.toLowerCase() === typed);
  const addresses = new Set(sameName.map((row) => row.address.toLowerCase()));
  if (addresses.size < 3) return null;

  const core = query.replace(GENERIC_VENUE_WORDS, " ").replace(/\s+/g, " ").trim();
  if (core.length < 3) return null;
  const tenants = await tomtomSearch("poiSearch", core, { key, limit: "100" });
  const coreLower = core.toLowerCase();
  const groups = new Map<string, TomTomHit[]>();
  for (const hit of tenants) {
    const point = hitPoint(hit);
    if (!point || !insideOahu(point.lat, point.lon)) continue;
    const street = normalizeStreet(hit);
    if (!street) continue;
    const mentionsName =
      (hit.poi?.name ?? "").toLowerCase().includes(coreLower) || street.includes(coreLower);
    if (!mentionsName) continue;
    groups.set(street, [...(groups.get(street) ?? []), hit]);
  }
  const ordered = [...groups.values()].sort((a, b) => b.length - a.length);
  const top = ordered[0];
  // Require a clear consensus so a tie never silently wins.
  if (!top || top.length < 5 || top.length < (ordered[1]?.length ?? 0) * 2) return null;
  const points = top.map(hitPoint).filter((p): p is { lat: number; lon: number } => Boolean(p));
  const median = (values: number[]) => values.sort((a, b) => a - b)[Math.floor(values.length / 2)]!;
  const sample = top[0]!;
  return {
    id: `venue:${normalizeStreet(sample)}`,
    name: query.trim().replace(/\b\w/g, (c) => c.toUpperCase()),
    address: sample.address?.freeformAddress ?? "",
    lat: median(points.map((p) => p.lat)),
    lon: median(points.map((p) => p.lon)),
  };
}

const reverseSchema = z.object({ lat: z.number(), lon: z.number() });

/**
 * Turns captured GPS coordinates into a readable street address, so a rider can
 * confirm the exact spot the phone detected before saving it.
 */
export const reverseGeocode = createServerFn({ method: "POST" })
  .inputValidator((input) => reverseSchema.parse(input))
  .handler(async ({ data }): Promise<{ found: boolean; label: string | null }> => {
    const key = process.env["TOMTOM_API_KEY"];
    if (!key) return { found: false, label: null };
    const url =
      `https://api.tomtom.com/search/2/reverseGeocode/${data.lat},${data.lon}.json` +
      `?key=${key}&radius=100&language=en-US`;
    try {
      const response = await fetch(url);
      if (!response.ok) {
        console.error(`TomTom reverse geocode failed [${response.status}]`);
        return { found: false, label: null };
      }
      const payload = (await response.json()) as {
        addresses?: Array<{ address?: { freeformAddress?: string } }>;
      };
      const label = payload.addresses?.[0]?.address?.freeformAddress ?? null;
      return { found: Boolean(label), label };
    } catch (error) {
      console.error("TomTom reverse geocode error", error);
      return { found: false, label: null };
    }
  });
