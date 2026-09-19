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

/**
 * Live destination suggestions from TomTom fuzzy search, biased to Oahu.
 * Matches place names (e.g. hospitals, malls) as well as street addresses.
 */
export const searchPlaces = createServerFn({ method: "POST" })
  .inputValidator((input) => searchSchema.parse(input))
  .handler(async ({ data }): Promise<{ results: PlaceSuggestion[] }> => {
    const key = process.env["TOMTOM_API_KEY"];
    if (!key) throw new Error("Place search is not configured yet.");

    const params = new URLSearchParams({
      key,
      limit: "5",
      typeahead: "true",
      countrySet: "US",
      lat: String(OAHU.lat),
      lon: String(OAHU.lon),
      radius: String(OAHU.radius),
      topLeft: OAHU_BOX.topLeft,
      btmRight: OAHU_BOX.btmRight,
      idxSet: "POI,PAD,Addr,Str,Geo",
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
        poi?: { name?: string };
        position?: { lat?: number; lon?: number };
        address?: { freeformAddress?: string; municipality?: string };
      }>;
    };

    const results: PlaceSuggestion[] = [];
    for (const hit of payload.results ?? []) {
      const lat = hit.position?.lat;
      const lon = hit.position?.lon;
      if (typeof lat !== "number" || typeof lon !== "number") continue;
      const address = hit.address?.freeformAddress ?? hit.address?.municipality ?? "";
      const name = hit.poi?.name || address;
      if (!name) continue;
      results.push({ id: hit.id ?? `${lat},${lon}`, name, address, lat, lon });
      if (results.length === 5) break;
    }
    return { results };
  });
