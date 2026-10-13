/**
 * Short-lived memory of timetable searches: in the phone's browser tab
 * (cachedPlannerSearch) and, for the server trip search, in the server
 * (settledPlannerSearch, finished answers only; Phase 2).
 *
 * The planner functions (plan_bus_direct, plan_transit_general, plan_outbound,
 * plan_outbound_multi, plan_inbound, service_hours, rail_stations,
 * diagnose_transit_general) read only the published TheBus/Skyline timetable:
 * their answer depends on the exact arguments and on which service day it is
 * in Honolulu, nothing live.
 * So the same search, asked again within a few minutes, gets the answer it
 * already got instead of running on the database again: a retry after one
 * failed search, a switch of the trip question, Arrive By pages that repeat,
 * the trip screen and the planner both asking for the same service hours.
 *
 * Exact arguments only: nothing is rounded, so a cached answer is the answer
 * the database would give. Failures are never kept. Live data (real-time bus
 * arrivals, traffic) never goes through here. Nothing is stored on the device
 * or sent anywhere; closing the tab forgets it.
 */

/** Long enough for retries and back-and-forth; short next to a timetable refresh. */
export const PLANNER_CACHE_TTL_MS = 5 * 60_000;
const MAX_ENTRIES = 120;

type Entry = { expires: number; answer: Promise<unknown> };
const entries = new Map<string, Entry>();

const honoluluDay = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Pacific/Honolulu",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const honoluluClock = new Intl.DateTimeFormat("en-US", {
  timeZone: "Pacific/Honolulu",
  weekday: "short",
  hour: "numeric",
  minute: "numeric",
  hourCycle: "h23",
});

/**
 * Times nothing is remembered: around midnight (the phone's clock may differ a
 * little from the database's, which picks the service day) and during the
 * Sunday 1–4 AM timetable refresh.
 */
export function plannerCacheOff(nowMs: number): boolean {
  const parts = Object.fromEntries(
    honoluluClock.formatToParts(nowMs).map((part) => [part.type, part.value]),
  );
  const minute = Number(parts["hour"]) * 60 + Number(parts["minute"]);
  if (minute >= 23 * 60 + 50 || minute < 10) return true;
  return parts["weekday"] === "Sun" && minute >= 60 && minute < 4 * 60;
}

/** Same arguments in any key order give the same key. */
function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stable((value as Record<string, unknown>)[key])}`)
      .join(",")}}`;
  return JSON.stringify(value) ?? "null";
}

function failed(answer: unknown): boolean {
  return Boolean(answer && typeof answer === "object" && (answer as { error?: unknown }).error);
}

/** A failure is passed on untouched (its error code must survive); answers are copied. */
function copy<T>(answer: T): T {
  return failed(answer) ? answer : structuredClone(answer);
}

/**
 * Runs `search` for this planner function and these exact arguments, or
 * returns the answer the same search got in the last few minutes (the same
 * service day in Honolulu). Searches still running are shared, not repeated.
 * Each caller gets its own copy, so no one can change another's answer.
 */
export function cachedPlannerSearch<T>(
  fn: string,
  args: Record<string, unknown> | undefined,
  search: () => PromiseLike<T>,
  nowMs: number = Date.now(),
): Promise<T> {
  if (plannerCacheOff(nowMs)) return Promise.resolve(search());
  const key = `${fn}|${honoluluDay.format(nowMs)}|${stable(args ?? {})}`;
  const hit = entries.get(key);
  if (hit && hit.expires > nowMs) return hit.answer.then((answer) => copy(answer as T));
  if (hit) entries.delete(key);

  const answer = new Promise<T>((resolve) => resolve(search()));
  const entry: Entry = { expires: nowMs + PLANNER_CACHE_TTL_MS, answer };
  entries.set(key, entry);
  // A failed search is forgotten, so the next ask runs it again.
  const forget = () => {
    if (entries.get(key) === entry) entries.delete(key);
  };
  answer.then((result) => (failed(result) ? forget() : undefined), forget);
  while (entries.size > MAX_ENTRIES) {
    const oldest = entries.keys().next().value;
    if (oldest === undefined) break;
    entries.delete(oldest);
  }
  return answer.then(copy);
}

const settled = new Map<string, { expires: number; answer: unknown }>();

/**
 * The server's version: finished answers are shared between requests (the
 * same exact search within a few minutes), while a search still running is
 * shared only inside the request that started it (`inflight`, one per
 * request): a server request can't wait on another request's connection.
 */
export function settledPlannerSearch<T>(
  fn: string,
  args: Record<string, unknown> | undefined,
  search: () => PromiseLike<T>,
  inflight: Map<string, Promise<unknown>>,
  nowMs: number = Date.now(),
): Promise<T> {
  if (plannerCacheOff(nowMs)) return Promise.resolve(search());
  const key = `${fn}|${honoluluDay.format(nowMs)}|${stable(args ?? {})}`;
  const hit = settled.get(key);
  if (hit && hit.expires > nowMs) return Promise.resolve(copy(hit.answer as T));
  if (hit) settled.delete(key);
  const running = inflight.get(key);
  if (running) return running.then((answer) => copy(answer as T));

  const answer = new Promise<T>((resolve) => resolve(search()));
  inflight.set(key, answer);
  answer.then(
    (result) => {
      if (failed(result)) return;
      settled.set(key, { expires: nowMs + PLANNER_CACHE_TTL_MS, answer: result });
      while (settled.size > MAX_ENTRIES) {
        const oldest = settled.keys().next().value;
        if (oldest === undefined) break;
        settled.delete(oldest);
      }
    },
    () => {},
  );
  return answer.then(copy);
}

/** Forget every remembered search (tests). */
export function clearPlannerCache() {
  entries.clear();
  settled.clear();
}
