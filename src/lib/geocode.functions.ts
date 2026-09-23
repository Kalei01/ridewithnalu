import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const schema = z.object({ address: z.string().min(3).max(200) });
const searchSchema = z.object({ query: z.string().min(2).max(200) });

// Oahu bias: island centre plus a bounding box so suggestions stay local.
const OAHU = { lat: 21.4389, lon: -158.0001, radius: 70000 };
const OAHU_BOX = { topLeft: "21.75,-158.35", btmRight: "21.20,-157.60" };

/** Geocodes a free-text address with TomTom. Called once, then cached client-side. */
export const geocodeAddress = createServerFn({ method: "POST" })
  .inputValidator((input) => schema.parse(input))
  .handler(async ({ data }) => {
    const key = process.env["TOMTOM_API_KEY"];
    if (!key) throw new Error("Address lookup is not configured yet.");

    const url = `https://api.tomtom.com/search/2/geocode/${encodeURIComponent(
      data.address,
    )}.json?key=${key}&limit=1&countrySet=US&lat=${OAHU.lat}&lon=${OAHU.lon}&radius=${OAHU.radius}`;

    const response = await fetch(url);
    if (!response.ok) {
      const body = await response.text();
      console.error(`TomTom geocode failed [${response.status}]: ${body}`);
      throw new Error(`Address lookup failed (${response.status}).`);
    }

    const payload = (await response.json()) as {
      results?: Array<{
        position?: { lat?: number; lon?: number };
        address?: { freeformAddress?: string };
      }>;
    };
    const hit = payload.results?.[0];
    if (!hit?.position?.lat || !hit.position.lon) {
      return { found: false as const };
    }
    return {
      found: true as const,
      lat: hit.position.lat,
      lon: hit.position.lon,
      label: hit.address?.freeformAddress ?? data.address,
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
    const params = new URLSearchParams({
      key,
      limit: "10",
      typeahead: "true",
      countrySet: "US",
      topLeft: OAHU_BOX.topLeft,
      btmRight: OAHU_BOX.btmRight,
      // A numbered query is a street address: keep shop listings out of it.
      idxSet: addressQuery ? "PAD,Addr,Str" : "POI,PAD,Addr,Geo,Str",
      extendedPostalCodesFor: addressQuery ? "PAD,Addr" : "POI,PAD,Addr",
      language: "en-US",
    });

    const url = `https://api.tomtom.com/search/2/search/${encodeURIComponent(
      data.query,
    )}.json?${params.toString()}`;

    const response = await fetch(url);
    if (!response.ok) {
      const body = await response.text();
      console.error(`TomTom search failed [${response.status}]: ${body}`);
      throw new Error(`Place search failed (${response.status}).`);
    }

    const payload = (await response.json()) as {
      results?: Array<{
        id?: string;
        type?: string;
        score?: number;
        poi?: { name?: string };
        position?: { lat?: number; lon?: number };
        entryPoints?: Array<{ type?: string; position?: { lat?: number; lon?: number } }>;
        address?: { freeformAddress?: string; municipality?: string };
      }>;
    };

    const results: PlaceSuggestion[] = [];
    const seen = new Set<string>();
    const ranked = [...(payload.results ?? [])].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    for (const hit of ranked) {
      // Drive to the door, not the middle of the parcel, when TomTom knows it.
      const entry =
        hit.entryPoints?.find((point) => point.type === "main")?.position ??
        hit.entryPoints?.[0]?.position;
      const lat = entry?.lat ?? hit.position?.lat;
      const lon = entry?.lon ?? hit.position?.lon;
      if (typeof lat !== "number" || typeof lon !== "number") continue;
      if (!insideOahu(lat, lon)) continue;
      const address = hit.address?.freeformAddress ?? hit.address?.municipality ?? "";
      const name = hit.poi?.name || address;
      if (!name) continue;
      // Same name at the same address is one place, however many listings exist.
      const fingerprint = `${name.toLowerCase()}|${address.toLowerCase()}`;
      if (seen.has(fingerprint)) continue;
      seen.add(fingerprint);
      results.push({ id: hit.id ?? `${lat},${lon}`, name, address, lat, lon });
      if (results.length === 6) break;
    }
    return { results };
  });


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
