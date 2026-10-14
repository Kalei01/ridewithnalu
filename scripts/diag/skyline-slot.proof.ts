/**
 * Skyline "no trip" (8-option cap) replay harness. Not part of `bun run test`.
 *
 *   CAPTURE=<dir>  runs each trip against the real timetable database (read-only)
 *                  and saves every database answer to <dir>/<n>.json
 *   REPLAY=<dir>   runs the same trips from those answers only (no network) and
 *                  prints the rows each trip gets: compare before/after a change.
 *
 * Live drive times use the Phase 2 stand-in (no TomTom key here).
 * Run: CAPTURE=/tmp/x bunx vitest run --config scripts/diag/vitest.skyline.config.ts
 */
import { describe, expect, it, vi } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

const captureDir = process.env["CAPTURE"];
const replayDir = process.env["REPLAY"];

const env = Object.fromEntries(
  (captureDir ? readFileSync(".env", "utf8") : "")
    .split("\n")
    .filter((line) => /^[A-Z_]+=/.test(line))
    .map((line) => {
      const at = line.indexOf("=");
      return [line.slice(0, at), line.slice(at + 1).replace(/^"|"$/g, "")];
    }),
);
const url = env["SUPABASE_URL"] ?? env["VITE_SUPABASE_URL"];
const key = env["SUPABASE_PUBLISHABLE_KEY"] ?? env["VITE_SUPABASE_PUBLISHABLE_KEY"];
const db = captureDir
  ? createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (input, init) => {
          const headers = new Headers(init?.headers);
          if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`)
            headers.delete("Authorization");
          headers.set("apikey", key);
          return fetch(input, { ...init, headers });
        },
      },
    })
  : null;

const replyKey = (fn: string, args?: Record<string, unknown>) =>
  `${fn}|${JSON.stringify(args ?? {})}`;
let answers: Record<string, unknown> = {};
const rpc = async (fn: string, args?: Record<string, unknown>) => {
  const k = replyKey(fn, args);
  if (replayDir)
    return (answers[k] ?? { data: [], error: null }) as { data: unknown; error: unknown };
  const r = await db!.rpc(fn as never, args as never);
  const reply = { data: r.data ?? null, error: r.error ?? null };
  answers[k] = reply;
  return reply;
};
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: (fn: string, args?: Record<string, unknown>) => rpc(fn, args) },
}));
vi.mock("@/lib/debug-log", () => ({ debugLog: () => {} }));
function standInDrive(d: { fromLat: number; fromLon: number; toLat: number; toLon: number }) {
  const km =
    Math.hypot(
      (d.toLat - d.fromLat) * 111,
      (d.toLon - d.fromLon) * 111 * Math.cos((d.fromLat * Math.PI) / 180),
    ) * 1.3;
  return Promise.resolve({ trafficMinutes: 3 + km * 1.3 });
}
vi.mock("@/lib/drive.functions", () => ({
  driveTime: ({ data }: { data: Parameters<typeof standInDrive>[0] }) => standInDrive(data),
  lookupTrafficMinutes: (data: Parameters<typeof standInDrive>[0]) => standInDrive(data),
}));
vi.stubGlobal("window", { setTimeout: (h: () => void, ms: number) => setTimeout(h, ms) });

const { planTransitTripDetailed } = await import("@/lib/transit-plan");
const { emptySetup } = await import("@/lib/commute-model");
const { clearPlannerCache } = await import("@/lib/planner-cache");
const { transitChoices, tripSteps } = await import("@/lib/trip-choices");

type P = { lat: number; lon: number };
const KAPOLEI = { lat: 21.335, lon: -158.079 };
const EWA = { lat: 21.319, lon: -158.032 };
const DOWNTOWN = { lat: 21.3086, lon: -157.8618 };
const MERCHANT = { lat: 21.30937, lon: -157.86318 };
const AIRPORT = { lat: 21.3245, lon: -157.9251 };
const WAIKIKI = { lat: 21.2793, lon: -157.8294 };
const MILILANI = { lat: 21.4513, lon: -158.0153 };
type Trip = {
  name: string;
  from: P;
  to: P;
  at: string;
  vehicle: boolean;
  arriveBy?: string;
  inbound?: boolean;
};
const nowHst = (() => {
  const d = new Date(Date.now() - 10 * 3600_000);
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
})();
/** The Phase 2 fixed set, plus the triage windows (16:00, 18:30) and right now. */
const TRIPS: Trip[] = [
  {
    name: "Kapolei → downtown, rush 6:30, car",
    from: KAPOLEI,
    to: DOWNTOWN,
    at: "06:30",
    vehicle: true,
  },
  {
    name: "Kapolei → downtown, rush 7:15, bus only",
    from: KAPOLEI,
    to: DOWNTOWN,
    at: "07:15",
    vehicle: false,
  },
  {
    name: "Kapolei → downtown, quiet 13:00, car",
    from: KAPOLEI,
    to: DOWNTOWN,
    at: "13:00",
    vehicle: true,
  },
  {
    name: "Kapolei → downtown, 16:30, car",
    from: KAPOLEI,
    to: DOWNTOWN,
    at: "16:30",
    vehicle: true,
  },
  {
    name: "Kapolei → downtown, arrive by 8:00, car",
    from: KAPOLEI,
    to: DOWNTOWN,
    at: "06:00",
    vehicle: true,
    arriveBy: "08:00",
  },
  {
    name: "ʻEwa Beach → Merchant St, rush 6:45, car",
    from: EWA,
    to: MERCHANT,
    at: "06:45",
    vehicle: true,
  },
  {
    name: "ʻEwa Beach → Merchant St, quiet 11:00, bus only",
    from: EWA,
    to: MERCHANT,
    at: "11:00",
    vehicle: false,
  },
  {
    name: "ʻEwa Beach → Merchant St, arrive by 8:30, bus only",
    from: EWA,
    to: MERCHANT,
    at: "06:30",
    vehicle: false,
    arriveBy: "08:30",
  },
  {
    name: "Airport → Waikīkī, quiet 14:00",
    from: AIRPORT,
    to: WAIKIKI,
    at: "14:00",
    vehicle: false,
  },
  {
    name: "Airport → Waikīkī, late night 23:30",
    from: AIRPORT,
    to: WAIKIKI,
    at: "23:30",
    vehicle: false,
  },
  {
    name: "Airport → Waikīkī, after midnight 00:40",
    from: AIRPORT,
    to: WAIKIKI,
    at: "00:40",
    vehicle: false,
  },
  {
    name: "Kapolei → downtown, late night 23:45, car",
    from: KAPOLEI,
    to: DOWNTOWN,
    at: "23:45",
    vehicle: true,
  },
  {
    name: "Mililani → downtown, rush 7:00, car",
    from: MILILANI,
    to: DOWNTOWN,
    at: "07:00",
    vehicle: true,
  },
  {
    name: "Downtown → Kapolei (home), 17:00, car (pickup)",
    from: DOWNTOWN,
    to: KAPOLEI,
    at: "17:00",
    vehicle: true,
    inbound: true,
  },
  {
    name: "Downtown → ʻEwa Beach (home), 17:30, bus only",
    from: DOWNTOWN,
    to: EWA,
    at: "17:30",
    vehicle: false,
    inbound: true,
  },
  {
    name: "Kapolei → downtown, 16:00, car (triage window)",
    from: KAPOLEI,
    to: DOWNTOWN,
    at: "16:00",
    vehicle: true,
  },
  {
    name: "Kapolei → downtown, 18:30, car (triage window)",
    from: KAPOLEI,
    to: DOWNTOWN,
    at: "18:30",
    vehicle: true,
  },
  {
    name: "ʻEwa Beach → Merchant St, 16:00, car",
    from: EWA,
    to: MERCHANT,
    at: "16:00",
    vehicle: true,
  },
  {
    name: "ʻEwa Beach → Merchant St, 18:30, car",
    from: EWA,
    to: MERCHANT,
    at: "18:30",
    vehicle: true,
  },
  {
    name: `Kapolei → downtown, now ${nowHst}, car`,
    from: KAPOLEI,
    to: DOWNTOWN,
    at: nowHst,
    vehicle: true,
  },
];
const clock = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h! * 3600 + m! * 60;
};
function honoluluDate(seconds: number, day: string) {
  return new Date(Date.parse(`${day}T00:00:00Z`) + (seconds + 10 * 3600) * 1000);
}
async function contextFor(trip: Trip, day: string) {
  const stations = ((await rpc("rail_stations")).data ?? []) as never[];
  const homeEnd = trip.inbound ? trip.to : trip.from;
  const workEnd = trip.inbound ? trip.from : trip.to;
  const [station, arriving] = await Promise.all([
    rpc("nearest_stop", { p_lat: homeEnd.lat, p_lon: homeEnd.lon, p_rail_only: true }),
    rpc("directional_dest_stop", { p_lat: workEnd.lat, p_lon: workEnd.lon, p_toward_rail: false }),
  ]);
  const rail = (station.data as Array<{ stop_id: string }> | null)?.[0];
  const out = (arriving.data as Array<{ stop_id: string }> | null)?.[0];
  const now = clock(trip.at);
  return {
    arrivalStationId: trip.inbound ? (rail?.stop_id ?? null) : null,
    arriveByTarget: trip.arriveBy ? clock(trip.arriveBy) : null,
    browseStations: stations,
    vehicleToStation: trip.vehicle ? "vehicle" : "none",
    inbound: Boolean(trip.inbound),
    now: honoluluDate(now, day),
    nowSeconds: now,
    planMode: trip.arriveBy ? "arrive-by" : "leave-now",
    scheduleAfterSeconds: now,
    setup: { ...emptySetup, homeStopId: rail?.stop_id ?? "", destStopId: out?.stop_id ?? "" },
    tripDirection: {
      inbound: Boolean(trip.inbound),
      reverseTrip: false,
      departingFromSavedHome: !trip.inbound,
      arrivingAtSavedHome: Boolean(trip.inbound),
      from: trip.from,
      to: trip.to,
    },
  } as Parameters<typeof planTransitTripDetailed>[0];
}
const hhmm = (s: number) =>
  `${String(Math.floor((s % 86400) / 3600)).padStart(2, "0")}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}`;
function report(text: string) {
  const file = process.env["PROOF_LOG"];
  if (file) appendFileSync(file, `${text}\n`);
  else console.log(text);
}

describe("Skyline slot replay", () => {
  TRIPS.forEach((trip, n) => {
    it(trip.name, async () => {
      const file = `${captureDir ?? replayDir}/${n}.json`;
      let day = new Date(Date.now() - 10 * 3600_000).toISOString().slice(0, 10);
      if (replayDir) {
        const saved = JSON.parse(readFileSync(file, "utf8"));
        answers = saved.answers;
        day = saved.day;
        trip.at = saved.at;
        trip.name = saved.name;
      } else answers = {};
      clearPlannerCache();
      const ctx = await contextFor(trip, day);
      const result = await planTransitTripDetailed(ctx);
      if (captureDir) {
        mkdirSync(captureDir, { recursive: true });
        writeFileSync(file, JSON.stringify({ name: trip.name, day, at: trip.at, answers }));
      }
      const picks = transitChoices(result.options, ctx.arriveByTarget);
      const row = (p: { option: { arrive_seconds: number } | null; makesIt: boolean }) =>
        p.option
          ? `${tripSteps(p.option as never)} arr ${hhmm(p.option.arrive_seconds)}${p.makesIt ? "" : " (late)"}`
          : "NONE";
      report(
        [
          `${trip.name}`,
          `  options ${result.options.length}, unchecked ${JSON.stringify(result.unchecked)}`,
          `  Skyline row: ${row(picks.skyline)}`,
          `  Bus row:     ${row(picks.bus)}`,
          ...result.options.map(
            (o) =>
              `    ${o.extraTransfers ? "+" : " "} ${tripSteps(o)} arr ${hhmm(o.arrive_seconds)}`,
          ),
        ].join("\n"),
      );
      expect(result).toBeTruthy();
    });
  });
});
