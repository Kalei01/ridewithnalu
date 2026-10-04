/**
 * Live self-test of the parts Nalu depends on. Each check runs the real thing
 * (database, timetable planner, TomTom, Mapbox as seen from ridenalu.com,
 * notification setup) and reports ok/fail with a short plain reason.
 */
import { lookupDriveTime } from "./drive.functions";
import { readServiceAccount } from "./fcm-direct.server";

export type HealthCheck = { name: string; ok: boolean; detail: string; ms: number };

const KAPOLEI = { lat: 21.3358, lon: -158.0798 };
const DOWNTOWN = { lat: 21.3099, lon: -157.8644 };
/** Alert well before the bus timetable runs out. */
const MIN_TIMETABLE_DAYS = 21;

async function timed(name: string, run: () => Promise<{ ok: boolean; detail: string }>): Promise<HealthCheck> {
  const start = Date.now();
  try {
    const result = await Promise.race([
      run(),
      new Promise<{ ok: boolean; detail: string }>((resolve) =>
        setTimeout(() => resolve({ ok: false, detail: "timed out after 20 s" }), 20_000),
      ),
    ]);
    return { name, ...result, ms: Date.now() - start };
  } catch (error) {
    return { name, ok: false, detail: error instanceof Error ? error.message.slice(0, 120) : "failed", ms: Date.now() - start };
  }
}

export async function runHealthChecks(): Promise<{ ok: boolean; checks: HealthCheck[] }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const mapboxToken = import.meta.env["VITE_LOVABLE_CONNECTOR_MAPBOX_PUBLIC_TOKEN"] as string | undefined;
  const tomtomKey = process.env["TOMTOM_API_KEY"] ?? "";

  const checks = await Promise.all([
    timed("timetable", async () => {
      const { data, error } = await supabaseAdmin.rpc("gtfs_data_expiry");
      if (error) return { ok: false, detail: "database query failed" };
      const row = (data as Array<{ expires_on: string; days_remaining: number }> | null)?.[0];
      if (!row) return { ok: false, detail: "no timetable loaded" };
      return {
        ok: row.days_remaining >= MIN_TIMETABLE_DAYS,
        detail: `valid until ${row.expires_on} (${row.days_remaining} days)`,
      };
    }),
    timed("bus and rail planner", async () => {
      const { data, error } = await supabaseAdmin.rpc("plan_transit_general", {
        p_origin_lat: KAPOLEI.lat,
        p_origin_lon: KAPOLEI.lon,
        p_dest_lat: DOWNTOWN.lat,
        p_dest_lon: DOWNTOWN.lon,
        p_after_seconds: 12 * 3600,
        p_limit: 3,
      });
      if (error) return { ok: false, detail: "planner query failed" };
      const count = Array.isArray(data) ? data.length : 0;
      return { ok: count > 0, detail: `${count} trips Kapolei → Downtown at noon` };
    }),
    timed("drive times (TomTom)", async () => {
      const drive = await lookupDriveTime({
        fromLat: KAPOLEI.lat,
        fromLon: KAPOLEI.lon,
        toLat: DOWNTOWN.lat,
        toLon: DOWNTOWN.lon,
      });
      return drive
        ? { ok: true, detail: `Kapolei → Downtown ${drive.trafficMinutes} min` }
        : { ok: false, detail: "no route returned" };
    }),
    timed("turn-by-turn directions", async () => {
      const drive = await lookupDriveTime({
        fromLat: KAPOLEI.lat,
        fromLon: KAPOLEI.lon,
        toLat: DOWNTOWN.lat,
        toLon: DOWNTOWN.lon,
      });
      if (!drive) return { ok: false, detail: "no route returned" };
      const turns = drive.maneuvers?.length ?? 0;
      if (turns > 0) return { ok: true, detail: `${turns} turns, first: ${drive.maneuvers[0]?.instruction ?? ""}`.slice(0, 120) };
      const { lastUnreadInstructionShape } = await import("./drive.functions");
      return { ok: false, detail: `no turns read; TomTom sent ${lastUnreadInstructionShape ?? "no instructions"}` };
    }),
    timed("place search (TomTom)", async () => {
      if (!tomtomKey) return { ok: false, detail: "TOMTOM_API_KEY not set" };
      const url = `https://api.tomtom.com/search/2/search/${encodeURIComponent("Ala Moana Center")}.json?key=${tomtomKey}&countrySet=US&limit=1&topLeft=21.75,-158.35&btmRight=21.20,-157.60`;
      const response = await fetch(url);
      if (!response.ok) return { ok: false, detail: `TomTom returned ${response.status}` };
      const payload = (await response.json()) as { results?: unknown[] };
      return { ok: (payload.results?.length ?? 0) > 0, detail: `${payload.results?.length ?? 0} results` };
    }),
    timed("map (Mapbox from ridenalu.com)", async () => {
      if (!mapboxToken) return { ok: false, detail: "map key missing from the build" };
      const response = await fetch(
        `https://api.mapbox.com/styles/v1/mapbox/navigation-day-v1?access_token=${mapboxToken}`,
        { headers: { Referer: "https://ridenalu.com/" } },
      );
      return response.ok
        ? { ok: true, detail: "map style loads" }
        : { ok: false, detail: `Mapbox returned ${response.status} (check the key's allowed addresses)` };
    }),
    timed("notifications setup", async () => {
      const account = readServiceAccount();
      return account
        ? { ok: true, detail: `Firebase project ${account.project_id}` }
        : { ok: false, detail: "FIREBASE_SERVICE_ACCOUNT_JSON not set" };
    }),
  ]);
  return { ok: checks.every((check) => check.ok), checks };
}
