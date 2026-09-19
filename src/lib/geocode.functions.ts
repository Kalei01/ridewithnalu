import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const schema = z.object({ address: z.string().min(3).max(200) });

/** Geocodes a free-text address with TomTom. Called once, then cached client-side. */
export const geocodeAddress = createServerFn({ method: "POST" })
  .inputValidator((input) => schema.parse(input))
  .handler(async ({ data }) => {
    const key = process.env["TOMTOM_API_KEY"];
    if (!key) throw new Error("Address lookup is not configured yet.");

    const url = `https://api.tomtom.com/search/2/geocode/${encodeURIComponent(
      data.address,
    )}.json?key=${key}&limit=1&countrySet=US&lat=21.3&lon=-157.85&radius=120000`;

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
