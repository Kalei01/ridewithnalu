import { supabase } from "@/integrations/supabase/client";
import { DIRECTION_KEY, SETUP_DISMISSED_KEY, STORAGE_KEY, emptySetup } from "@/lib/commute-model";

/**
 * "Start from here": a trip that begins at a stop the rider tapped on the map
 * instead of where they are standing. It builds the same saved trip setup the
 * Browse screen builds for a one-tap trip (src/routes/index.tsx
 * startTripToPlace / findTripStops) and writes it to the same storage key, then
 * the app opens on the trip. Throws when the stop lookups fail.
 */
export async function startTripFrom(
  origin: { lat: number; lon: number },
  destination: { name: string; lat: number; lon: number },
) {
  const [station, arriving, boarding] = await Promise.all([
    supabase.rpc("nearest_stop", { p_lat: origin.lat, p_lon: origin.lon, p_rail_only: true }),
    supabase.rpc("directional_dest_stop", {
      p_lat: destination.lat,
      p_lon: destination.lon,
      p_toward_rail: false,
    }),
    supabase.rpc("directional_dest_stop", {
      p_lat: destination.lat,
      p_lon: destination.lon,
      p_toward_rail: true,
    }),
  ]);
  const rail = station.data?.[0];
  const out = arriving.data?.[0];
  const back = boarding.data?.[0];
  if (station.error && arriving.error && boarding.error) throw new Error("Stop lookup failed");
  const setup = {
    ...emptySetup,
    // Door-to-door driving is always weighed for a one-tap trip.
    allowDrive: true,
    homeStopId: rail?.stop_id ?? "",
    homeStopName: rail?.stop_name ?? "",
    homeLat: origin.lat,
    homeLon: origin.lon,
    destinationName: destination.name,
    destinationAddress: destination.name,
    destLat: destination.lat,
    destLon: destination.lon,
    destStopId: out?.stop_id ?? "",
    destStopName: out?.stop_name ?? "",
    destStopWalkM: Number(out?.distance_m ?? 0),
    destReturnStopId: back?.stop_id ?? "",
    destReturnStopName: back?.stop_name ?? "",
    destReturnWalkM: Number(back?.distance_m ?? 0),
  };
  window.localStorage.removeItem(DIRECTION_KEY);
  window.localStorage.removeItem(SETUP_DISMISSED_KEY);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(setup));
  window.location.assign("/");
}
