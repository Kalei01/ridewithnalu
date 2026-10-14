/**
 * Phase 2 side-by-side proof (docs/architecture/fix-plan.md, step 5).
 * The same fixed trips through the old path (the phone: staggered searches)
 * and the new one (the server: all at once, with deadlines), against the real
 * timetable database, read-only, with the same stand-in drive time for both
 * (no TomTom key here; real traffic is compared live on ridenalu.com).
 * Answers must be identical. Run: bunx vitest run --config scripts/phase2/vitest.config.ts
 */
import { describe, expect, it, vi } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { appendFileSync, readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(".env", "utf8")
    .split("\n")
    .filter((line) => /^[A-Z_]+=/.test(line))
    .map((line) => {
      const at = line.indexOf("=");
      return [line.slice(0, at), line.slice(at + 1).replace(/^"|"$/g, "")];
    }),
);
const url = env["SUPABASE_URL"] ?? env["VITE_SUPABASE_URL"];
const key = env["SUPABASE_PUBLISHABLE_KEY"] ?? env["VITE_SUPABASE_PUBLISHABLE_KEY"];
const db = createClient(url, key, {
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
});

let dbCalls = 0;
const realRpc = (fn: string, args?: Record<string, unknown>) => {
  dbCalls += 1;
  return db.rpc(fn as never, args as never) as unknown as Promise<{
    data: unknown;
    error: unknown;
  }>;
};
/**
 * The old path's database answers for the current trip, by exact search, in
 * the order they were asked (REPLAY=1): a search asked twice replays both.
 */
const oldReplies = new Map<string, Array<Promise<string>>>();
const replyKey = (fn: string, args?: Record<string, unknown>) =>
  `${fn}|${JSON.stringify(args ?? {})}`;
/** The phone path's database: live, and every answer remembered as text. */
const phoneRpc = (fn: string, args?: Record<string, unknown>) => {
  const reply = realRpc(fn, args);
  const key = replyKey(fn, args);
  oldReplies.set(key, [
    ...(oldReplies.get(key) ?? []),
    reply.then((r) => JSON.stringify({ data: r.data ?? null, error: r.error ?? null })),
  ]);
  return reply;
};
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: (fn: string, args?: Record<string, unknown>) => phoneRpc(fn, args) },
}));
vi.mock("@/lib/debug-log", () => ({ debugLog: () => {} }));

/** Stand-in live drive: straight line at ~46 km/h + 3 min, the same for both paths. */
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

/** Lines go to PROOF_LOG when set (the test runner hides console output of passing tests). */
function report(text: string) {
  const file = process.env["PROOF_LOG"];
  if (file) appendFileSync(file, `${text}\n`);
  else console.log(text);
}

const { planTransitTripDetailed } = await import("@/lib/transit-plan");
const { planTripOnServer, serverDeps, emptyStats } = await import("@/lib/transit-plan.server");
const { emptySetup } = await import("@/lib/commute-model");
const { clearPlannerCache } = await import("@/lib/planner-cache");

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
  at: string; // Honolulu clock, HH:MM
  vehicle: boolean;
  arriveBy?: string;
  inbound?: boolean;
};
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
];

const clock = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h! * 3600 + m! * 60;
};

/** Today's date at this Honolulu clock time (Honolulu is UTC−10, no DST). */
function honoluluDate(seconds: number) {
  const today = new Date(Date.now() - 10 * 3600_000).toISOString().slice(0, 10);
  return new Date(Date.parse(`${today}T00:00:00Z`) + (seconds + 10 * 3600) * 1000);
}

async function contextFor(trip: Trip) {
  const stations = (await db.rpc("rail_stations" as never)).data as never[];
  // The rider's own end (where the station is) and the other end.
  const homeEnd = trip.inbound ? trip.to : trip.from;
  const workEnd = trip.inbound ? trip.from : trip.to;
  const [station, arriving] = await Promise.all([
    db.rpc(
      "nearest_stop" as never,
      { p_lat: homeEnd.lat, p_lon: homeEnd.lon, p_rail_only: true } as never,
    ),
    db.rpc(
      "directional_dest_stop" as never,
      { p_lat: workEnd.lat, p_lon: workEnd.lon, p_toward_rail: false } as never,
    ),
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
    now: honoluluDate(now),
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
const describeOption = (o: {
  arrive_seconds: number;
  legs: Array<{ mode: string; route_short_name?: string | null }>;
}) =>
  `${o.legs.map((l) => (l.mode === "bus" ? `bus ${l.route_short_name ?? ""}` : l.mode)).join("→")} arr ${hhmm(o.arrive_seconds)}`;

async function settle<T>(work: () => Promise<T>) {
  try {
    return { ok: true as const, value: await work() };
  } catch (error) {
    return { ok: false as const, error: String((error as Error)?.message ?? error) };
  }
}

describe("Phase 2 side-by-side: old (phone) vs new (server)", () => {
  const rounds = Number(process.env["ROUNDS"] ?? 1);
  for (const trip of TRIPS) {
    it(trip.name, async () => {
      const ctx = await contextFor(trip);
      for (let round = 1; round <= rounds; round += 1) {
        clearPlannerCache();
        dbCalls = 0;
        oldReplies.clear();
        const t0 = Date.now();
        const old = await settle(() => planTransitTripDetailed(ctx));
        const oldMs = Date.now() - t0;
        const oldCalls = dbCalls;

        clearPlannerCache(); // nothing carried over: the new path searches for itself
        dbCalls = 0;
        const stats = emptyStats();
        const cpu0 = process.cpuUsage();
        const t1 = Date.now();
        // The real server path, recording each database answer as text.
        const recorded = new Map<string, string>();
        // REPLAY=1: the new path gets exactly the database answers the old path
        // got (errors and timeouts included), so only the orchestration differs.
        // A search the old path never made goes to the live database.
        const replayOld = process.env["REPLAY"] === "1";
        let replayedLive = 0;
        const source = (fn: string, args: Record<string, unknown> | undefined) => {
          const queue = replayOld ? oldReplies.get(replyKey(fn, args)) : undefined;
          // Each answer in turn; a repeat beyond what the old path asked gets the last one.
          const old = queue && (queue.length > 1 ? queue.shift() : queue[0]);
          if (old) return old.then((text) => JSON.parse(text) as { data: unknown; error: unknown });
          if (replayOld) replayedLive += 1;
          return realRpc(fn, args);
        };
        const live = (fn: string, args: Record<string, unknown> | undefined) =>
          source(fn, args).then((reply) => {
            recorded.set(`${fn}|${JSON.stringify(args ?? {})}`, JSON.stringify(reply));
            return reply;
          });
        const planLines: string[] = [];
        const spy = vi.spyOn(console, "info").mockImplementation((...parts: unknown[]) => {
          planLines.push(
            parts.map((x) => (typeof x === "string" ? x : JSON.stringify(x))).join(" "),
          );
        });
        const driveCalls: string[] = [];
        const fresh = await planTripOnServer(ctx, () =>
          serverDeps(stats, {
            search: live,
            drive: (data) => {
              driveCalls.push(`${data.toLat.toFixed(4)},${data.toLon.toFixed(4)}`);
              return standInDrive(data);
            },
          }),
        );
        spy.mockRestore();
        const newMs = Date.now() - t1;
        const cpu = process.cpuUsage(cpu0);

        // CPU estimate for the Worker: the same search replayed from the recorded
        // answers (parsing included, no network), best of 5 runs.
        let replayCpu = Infinity;
        for (let i = 0; i < 5; i += 1) {
          clearPlannerCache();
          const replay = async (fn: string, args: Record<string, unknown> | undefined) =>
            JSON.parse(
              recorded.get(`${fn}|${JSON.stringify(args ?? {})}`) ?? '{"data":[],"error":null}',
            );
          const c0 = process.cpuUsage();
          await planTripOnServer(ctx, (s) => serverDeps(s, { search: replay }));
          const c = process.cpuUsage(c0);
          replayCpu = Math.min(replayCpu, (c.user + c.system) / 1000);
        }
        const answerBytes = JSON.stringify(fresh).length;

        const oldAnswer = old.ok ? old.value : { failed: old.error };
        const newAnswer = fresh.failed
          ? { failed: true }
          : { options: fresh.options, unchecked: fresh.unchecked };
        let same =
          JSON.stringify(old.ok ? oldAnswer : { failed: true }) === JSON.stringify(newAnswer);
        const explained = "";
        if (!same)
          report(
            `  server log: ${planLines.join(" | ") || "(none)"}\n  server drive lookups: ${driveCalls.join(" ")}`,
          );
        report(
          [
            `${same ? "SAME" : "DIFF"} | ${trip.name} | round ${round}${process.env["REPLAY"] === "1" ? ` | replay (${replayedLive} searches not in the old run)` : ""}${explained}`,
            `  old: ${oldMs} ms, ${oldCalls} db calls | new: ${newMs} ms, ${stats.searches} searches (${stats.searchesSent} sent), ${stats.driveLookups} drive lookups, ${stats.late} late, over budget ${stats.overBudget}, cpu incl. network ${((cpu.user + cpu.system) / 1000).toFixed(1)} ms, replay cpu ${replayCpu.toFixed(1)} ms, answer ${(answerBytes / 1024).toFixed(0)} KB`,
            `  answer: ${old.ok ? `${old.value.options.length} options, unchecked ${JSON.stringify(old.value.unchecked)}; first: ${old.value.options[0] ? describeOption(old.value.options[0]) : "none"}` : `error ${old.error}`}`,
            ...(same && !explained
              ? []
              : [
                  `  new: ${fresh.failed ? "failed" : `${fresh.options.length} options, unchecked ${JSON.stringify(fresh.unchecked)}; first: ${fresh.options[0] ? describeOption(fresh.options[0]) : "none"}`}`,
                ]),
          ].join("\n"),
        );
        expect(same).toBe(true);
      }
    });
  }
});
