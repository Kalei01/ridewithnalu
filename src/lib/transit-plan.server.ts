import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { cachedPlannerSearch } from "@/lib/planner-cache";
import { lookupTrafficMinutes } from "@/lib/drive.functions";
import {
  planTransitTripDetailed,
  type DriveLookup,
  type TransitPlanContext,
  type TransitPlanDeps,
  type TransitPlanResult,
  type plannerRpc,
} from "@/lib/transit-plan";

/**
 * The trip search run on the server, in one request from the phone. Same
 * planner, same rules (planTransitTripDetailed); what changes is where it runs
 * and that the station searches and the Skyline bridge start together.
 */

/**
 * The database stops any search at 10 s (anon/authenticated statement_timeout,
 * migration 0021). A search still unanswered a little after that is treated as
 * failed, so its row says "Can't check Skyline right now", never "no trip".
 * Above the database's own limit on purpose: no search it would have answered
 * is cut short.
 */
export const SEARCH_DEADLINE_MS = 12_000;
/**
 * A live drive time that takes longer than this is treated as unreadable: the
 * drive-to-station trips it would time are dropped and Skyline is flagged
 * "Can't check", exactly as when TomTom fails.
 */
export const DRIVE_DEADLINE_MS = 12_000;

function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith("sb_publishable_") || value.startsWith("sb_secret_");
}

let client: ReturnType<typeof createClient<Database>> | undefined;

/**
 * The public (publishable-key) client, as the phone uses when signed out: the
 * planner functions read only the published timetable. No session is kept,
 * so nothing about one rider can reach another's request.
 */
function plannerClient() {
  if (client) return client;
  const url = process.env["SUPABASE_URL"] || import.meta.env["VITE_SUPABASE_URL"];
  const key =
    process.env["SUPABASE_PUBLISHABLE_KEY"] || import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) throw new Error("Trip search is not configured");
  client = createClient<Database>(url, key, {
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        // New Supabase API keys are opaque strings, not bearer JWTs.
        if (isNewSupabaseApiKey(key) && headers.get("Authorization") === `Bearer ${key}`)
          headers.delete("Authorization");
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      },
    },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return client;
}

type Reply = { data: unknown; error: unknown };

/** Resolves with `late()` if `work` hasn't settled within `ms`; the timer never outlives the work. */
function withDeadline<T>(work: PromiseLike<T>, ms: number, late: () => T): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    Promise.resolve(work).finally(() => clearTimeout(timer)),
    new Promise<T>((resolve) => {
      timer = setTimeout(() => resolve(late()), ms);
    }),
  ]);
}

/** Counts for one trip, for timing reports (no places, no times of day). */
export type ServerPlanStats = { searches: number; driveLookups: number; late: number };

/** The server's planner dependencies for one request. */
export function serverDeps(
  stats: ServerPlanStats,
  options: {
    search?: (fn: string, args: Record<string, unknown> | undefined) => PromiseLike<Reply>;
    drive?: DriveLookup;
    searchDeadlineMs?: number;
    driveDeadlineMs?: number;
  } = {},
): TransitPlanDeps {
  const search =
    options.search ??
    ((fn: string, args: Record<string, unknown> | undefined) =>
      plannerClient().rpc(fn as never, args as never) as unknown as PromiseLike<Reply>);
  const drive: DriveLookup = options.drive ?? ((data) => lookupTrafficMinutes(data));
  const searchDeadline = options.searchDeadlineMs ?? SEARCH_DEADLINE_MS;
  const driveDeadline = options.driveDeadlineMs ?? DRIVE_DEADLINE_MS;

  // Timetable answers are remembered for a few minutes by their exact
  // arguments (planner-cache): the same trip in the same minute isn't searched
  // twice. The deadline sits outside that memory, so a late answer still lands
  // there for the next ask instead of being thrown away.
  const rpc = ((fn: string, args?: Record<string, unknown>) => {
    stats.searches += 1;
    return withDeadline(
      cachedPlannerSearch(fn, args, () => search(fn, args)),
      searchDeadline,
      (): Reply => {
        stats.late += 1;
        return {
          data: null,
          error: { code: "deadline", message: `${fn} ran past ${searchDeadline} ms` },
        };
      },
    );
  }) as unknown as typeof plannerRpc;

  return {
    rpc,
    driveLookup: (data) => {
      stats.driveLookups += 1;
      // The lookup keeps its own two-minute memory of live traffic.
      return withDeadline(drive(data), driveDeadline, () => {
        stats.late += 1;
        return null;
      });
    },
    setTimer: (handler, ms) => setTimeout(handler, ms),
    // Planner diagnostics carry stage and error codes only (never places).
    log: (type, data) => console.info(`[plan] ${type}`, data),
    parallel: true,
  };
}

export type ServerPlanAnswer = TransitPlanResult & {
  /** The planner threw (every search failed): the phone shows both rows as "Can't check". */
  failed: boolean;
  timing: ServerPlanStats & { ms: number };
};

/** Runs one trip search on the server. Never throws: a failure is reported in the answer. */
export async function planTripOnServer(
  ctx: TransitPlanContext,
  deps?: (stats: ServerPlanStats) => TransitPlanDeps,
): Promise<ServerPlanAnswer> {
  const started = Date.now();
  const stats: ServerPlanStats = { searches: 0, driveLookups: 0, late: 0 };
  try {
    const result = await planTransitTripDetailed(ctx, (deps ?? serverDeps)(stats));
    return { ...result, failed: false, timing: { ...stats, ms: Date.now() - started } };
  } catch (error) {
    const e = error as { code?: unknown; message?: unknown } | null;
    console.info("[plan] trip_failed", {
      code: typeof e?.code === "string" ? e.code : "unknown",
      message: typeof e?.message === "string" ? e.message.slice(0, 120) : "failed",
    });
    return {
      options: [],
      unchecked: { skyline: true, bus: true },
      failed: true,
      timing: { ...stats, ms: Date.now() - started },
    };
  }
}
