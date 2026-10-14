import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { settledPlannerSearch } from "@/lib/planner-cache";
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
 * migration 0021), but on a busy database a search can also wait its turn
 * before that clock starts (seen: 15 s+ in the Oct 13 side-by-side). A search
 * still unanswered after this is treated as failed, so its row says "Can't
 * check Skyline right now", never "no trip". It only stops a stuck search from
 * hanging the answer: counted from when the search is sent (see MAX_OPEN_SEARCHES) and
 * far above the database's own limit, so a slow search that answers is kept.
 */
export const SEARCH_DEADLINE_MS = 25_000;
/**
 * A live drive time that takes longer than this is treated as unreadable: the
 * drive-to-station trips it would time are dropped and Skyline is flagged
 * "Can't check", exactly as when TomTom fails.
 */
export const DRIVE_DEADLINE_MS = 25_000;
/**
 * Cloudflare Workers keep at most 6 outgoing connections open per request; the
 * rest wait. The server queues them itself so each deadline starts when its
 * call is sent, not while it waits its turn: at most 4 database searches at
 * once (the general search goes first; a small, shared database), and 2 live
 * drive times.
 */
export const MAX_OPEN_SEARCHES = 4;
export const MAX_OPEN_DRIVES = 2;
/**
 * Cloudflare Workers (free plan) allow 50 outgoing requests per request. A
 * trip that would need more (a long Arrive By search with a car) stops here
 * and is reported as over budget; the phone then runs it the old way, so the
 * rider gets the same answer instead of a cut-short one.
 */
export const OUTGOING_BUDGET = 45;

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

/** Runs at most `max` calls at once, the rest in order of asking. */
function openLimit(max: number) {
  let open = 0;
  const waiting: Array<() => void> = [];
  return async <T>(work: () => PromiseLike<T>): Promise<T> => {
    if (open >= max) await new Promise<void>((resolve) => waiting.push(resolve));
    open += 1;
    try {
      return await work();
    } finally {
      open -= 1;
      waiting.shift()?.();
    }
  };
}

/** Counts for one trip, for timing reports (no places, no times of day). */
export type ServerPlanStats = {
  /** Timetable searches asked for, and how many went to the database. */
  searches: number;
  searchesSent: number;
  /** Live drive times asked for (each at most one TomTom request). */
  driveLookups: number;
  late: number;
  /** Calls refused because the request's outgoing budget was used up. */
  overBudget: number;
};

export const emptyStats = (): ServerPlanStats => ({
  searches: 0,
  searchesSent: 0,
  driveLookups: 0,
  late: 0,
  overBudget: 0,
});

/** Planner diagnostics on the server: stage and error code only, never arguments. */
function serverLog(type: string, data: Record<string, unknown>) {
  const pick = (key: string, max: number) =>
    typeof data[key] === "string" ? (data[key] as string).slice(0, max) : undefined;
  console.info(`[plan] ${type}`, {
    stage: pick("stage", 40),
    code: pick("code", 20),
    message: pick("message", 80),
  });
}

/** The server's planner dependencies for one request. */
export function serverDeps(
  stats: ServerPlanStats,
  options: {
    search?: (
      fn: string,
      args: Record<string, unknown> | undefined,
      signal?: AbortSignal,
    ) => PromiseLike<Reply>;
    drive?: DriveLookup;
    searchDeadlineMs?: number;
    driveDeadlineMs?: number;
    budget?: number;
  } = {},
): TransitPlanDeps {
  const search =
    options.search ??
    ((fn: string, args: Record<string, unknown> | undefined, signal?: AbortSignal) => {
      const call = plannerClient().rpc(fn as never, args as never);
      return (signal ? call.abortSignal(signal) : call) as unknown as PromiseLike<Reply>;
    });
  const drive: DriveLookup = options.drive ?? ((data) => lookupTrafficMinutes(data));
  const searchDeadline = options.searchDeadlineMs ?? SEARCH_DEADLINE_MS;
  const driveDeadline = options.driveDeadlineMs ?? DRIVE_DEADLINE_MS;
  const budget = options.budget ?? OUTGOING_BUDGET;
  let outgoing = 0;
  const spend = () => {
    if (outgoing >= budget) {
      stats.overBudget += 1;
      return false;
    }
    outgoing += 1;
    return true;
  };
  // Shared only inside this request (see settledPlannerSearch).
  const inflight = new Map<string, Promise<unknown>>();
  const drives = new Map<string, Promise<{ trafficMinutes: number } | null>>();

  const sendSearch = openLimit(MAX_OPEN_SEARCHES);
  const sendDrive = openLimit(MAX_OPEN_DRIVES);

  // Timetable answers are remembered for a few minutes by their exact
  // arguments: the same trip in the same minute isn't searched twice.
  const rpc = ((fn: string, args?: Record<string, unknown>) => {
    stats.searches += 1;
    return settledPlannerSearch(
      fn,
      args,
      (): PromiseLike<Reply> => {
        if (!spend())
          return Promise.resolve({
            data: null,
            error: { code: "budget", message: "outgoing request budget used up" },
          });
        stats.searchesSent += 1;
        return sendSearch(() => {
          // A search past its deadline is cancelled, so it stops holding a connection.
          const cancel = new AbortController();
          return withDeadline(search(fn, args, cancel.signal), searchDeadline, (): Reply => {
            stats.late += 1;
            cancel.abort();
            return {
              data: null,
              error: { code: "deadline", message: `${fn} ran past ${searchDeadline} ms` },
            };
          });
        });
      },
      inflight,
    );
  }) as unknown as typeof plannerRpc;

  return {
    rpc,
    driveLookup: (data) => {
      // The same lookup twice in one trip search is asked once; the lookup
      // also keeps its own two-minute memory of live traffic.
      const key = JSON.stringify([
        data.fromLat,
        data.fromLon,
        data.toLat,
        data.toLon,
        data.departureTime ?? null,
      ]);
      let lookup = drives.get(key);
      if (!lookup) {
        if (!spend()) return Promise.resolve(null);
        stats.driveLookups += 1;
        lookup = sendDrive(() =>
          withDeadline(drive(data), driveDeadline, () => {
            stats.late += 1;
            return null;
          }),
        );
        drives.set(key, lookup);
      }
      return lookup;
    },
    setTimer: (handler, ms) => setTimeout(handler, ms),
    log: serverLog,
    parallel: true,
  };
}

export type ServerPlanAnswer = TransitPlanResult & {
  /** The planner threw (every search failed): the phone shows both rows as "Can't check". */
  failed: boolean;
  /** The trip needed more outgoing requests than one server request allows: the phone runs it itself. */
  overBudget: boolean;
  timing: ServerPlanStats & { ms: number };
};

/** Runs one trip search on the server. Never throws: a failure is reported in the answer. */
export async function planTripOnServer(
  ctx: TransitPlanContext,
  deps?: (stats: ServerPlanStats) => TransitPlanDeps,
): Promise<ServerPlanAnswer> {
  const started = Date.now();
  const stats = emptyStats();
  try {
    const result = await planTransitTripDetailed(ctx, (deps ?? serverDeps)(stats));
    return {
      ...result,
      failed: false,
      overBudget: stats.overBudget > 0,
      timing: { ...stats, ms: Date.now() - started },
    };
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
      overBudget: stats.overBudget > 0,
      timing: { ...stats, ms: Date.now() - started },
    };
  }
}
