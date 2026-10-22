/**
 * Protects the TomTom free monthly quota (Routing 20,000, Traffic Incident
 * Details 2,500) and decides when to use the Mapbox fallback.
 *
 * Everything here is in memory, per server instance (a Cloudflare isolate):
 * there is no shared counter store in this project. Counts therefore
 * UNDER-estimate the real usage when several instances run, and reset when an
 * instance is recycled. The TomTom dashboard is the source of truth; these
 * numbers are an early warning and a brake, never an accounting record.
 */

export const TOMTOM_ROUTING_MONTHLY_LIMIT = 20_000;
export const TOMTOM_INCIDENTS_MONTHLY_LIMIT = 2_500;
/** TomTom Geocoding (separate quota from routing): used to place HPD police reports. */
export const TOMTOM_GEOCODING_MONTHLY_LIMIT = 20_000;
/** Mapbox Directions free tier: 100,000 requests a month. We stop well short of it. */
export const MAPBOX_DIRECTIONS_MONTHLY_LIMIT = 100_000;
const MAPBOX_STOP_FRACTION = 0.95;
const WARN_FRACTION = 0.8;

/** After TomTom says 403 (quota/key) it is left alone for this long. */
export const BREAKER_FORBIDDEN_MS = 15 * 60_000;
/** After a 429, 5xx or timeout it is skipped for a short while, then tried again. */
export const BREAKER_TRANSIENT_MS = 60_000;

export type TomtomOutcome = number | "timeout" | "error";

export type TomtomScope = "routing" | "incidents" | "geocoding";

/** Routing and incident details have separate quotas, so each has its own breaker. */
const breakers: Record<TomtomScope, { until: number; reason: string | null }> = {
  routing: { until: 0, reason: null },
  incidents: { until: 0, reason: null },
  geocoding: { until: 0, reason: null },
};

/** Whether TomTom may be called now (false while that scope's breaker is open). */
export function tomtomAvailable(scope: TomtomScope = "routing", now = Date.now()): boolean {
  return now >= breakers[scope].until;
}

/** True for outcomes that mean "use the fallback for this lookup". */
export function isFallbackOutcome(outcome: TomtomOutcome): boolean {
  if (outcome === "timeout" || outcome === "error") return true;
  return outcome === 403 || outcome === 429 || outcome >= 500;
}

/** Feed every TomTom answer in; opens the breaker on 403 (15 min) or a transient failure (1 min). */
export function noteTomtomOutcome(
  outcome: TomtomOutcome,
  scope: TomtomScope = "routing",
  now = Date.now(),
): void {
  const b = breakers[scope];
  if (outcome === 403) {
    b.until = Math.max(b.until, now + BREAKER_FORBIDDEN_MS);
    b.reason = "TomTom HTTP 403 (quota or key)";
    console.warn(`[tomtom] 403 on ${scope}: skipping TomTom ${scope} for 15 minutes`);
  } else if (isFallbackOutcome(outcome)) {
    b.until = Math.max(b.until, now + BREAKER_TRANSIENT_MS);
    b.reason = `TomTom ${outcome}`;
  } else if (typeof outcome === "number" && outcome >= 200 && outcome < 300 && now >= b.until) {
    b.reason = null;
  }
}

export function breakerState(
  scope: TomtomScope = "routing",
  now = Date.now(),
): { open: boolean; reason: string | null; reopensInMs: number } {
  const b = breakers[scope];
  const open = now < b.until;
  return { open, reason: open ? b.reason : null, reopensInMs: open ? b.until - now : 0 };
}

// ---- monthly usage (per server instance) -----------------------------------

export type UsageKind =
  "tomtomRouting" | "tomtomIncidents" | "tomtomGeocoding" | "mapboxDirections";

const LIMITS: Record<UsageKind, number> = {
  tomtomRouting: TOMTOM_ROUTING_MONTHLY_LIMIT,
  tomtomIncidents: TOMTOM_INCIDENTS_MONTHLY_LIMIT,
  tomtomGeocoding: TOMTOM_GEOCODING_MONTHLY_LIMIT,
  mapboxDirections: MAPBOX_DIRECTIONS_MONTHLY_LIMIT,
};

const usage: { month: string; counts: Record<UsageKind, number>; warned: Set<UsageKind> } = {
  month: "",
  counts: { tomtomRouting: 0, tomtomIncidents: 0, tomtomGeocoding: 0, mapboxDirections: 0 },
  warned: new Set(),
};

function monthOf(now: number) {
  return new Date(now).toISOString().slice(0, 7);
}

function rollMonth(now: number) {
  const month = monthOf(now);
  if (usage.month === month) return;
  usage.month = month;
  usage.counts = { tomtomRouting: 0, tomtomIncidents: 0, tomtomGeocoding: 0, mapboxDirections: 0 };
  usage.warned = new Set();
}

/** Counts one outgoing request; logs a warning once per month at 80% of the limit. */
export function countCall(kind: UsageKind, now = Date.now()): void {
  rollMonth(now);
  usage.counts[kind] += 1;
  const used = usage.counts[kind];
  if (used >= LIMITS[kind] * WARN_FRACTION && !usage.warned.has(kind)) {
    usage.warned.add(kind);
    console.warn(
      `[quota] ${kind} at ${used}/${LIMITS[kind]} (80%+ of the monthly free allowance, counted on this server instance only)`,
    );
  }
}

/** True once this instance's own count reaches the limit (an under-estimate, so never a false stop). */
export function quotaSpent(kind: UsageKind, now = Date.now()): boolean {
  rollMonth(now);
  const stop = kind === "mapboxDirections" ? MAPBOX_STOP_FRACTION : 1;
  return usage.counts[kind] >= LIMITS[kind] * stop;
}

/** Past 80% of the month's allowance: caches stretch to save what is left. */
export function quotaTight(kind: UsageKind, now = Date.now()): boolean {
  rollMonth(now);
  return usage.counts[kind] >= LIMITS[kind] * WARN_FRACTION;
}

export type UsageSnapshot = {
  month: string;
  scope: "this server instance only (under-estimate)";
  tomtomRouting: { used: number; limit: number; remainingEstimate: number };
  tomtomIncidents: { used: number; limit: number; remainingEstimate: number };
  tomtomGeocoding: { used: number; limit: number; remainingEstimate: number };
  mapboxDirections: { used: number; limit: number; remainingEstimate: number };
};

export function usageSnapshot(now = Date.now()): UsageSnapshot {
  rollMonth(now);
  const one = (kind: UsageKind) => ({
    used: usage.counts[kind],
    limit: LIMITS[kind],
    remainingEstimate: Math.max(0, LIMITS[kind] - usage.counts[kind]),
  });
  return {
    month: usage.month,
    scope: "this server instance only (under-estimate)",
    tomtomRouting: one("tomtomRouting"),
    tomtomIncidents: one("tomtomIncidents"),
    tomtomGeocoding: one("tomtomGeocoding"),
    mapboxDirections: one("mapboxDirections"),
  };
}

/** Whether a TomTom routing request may go out right now (breaker closed and quota left). */
export function tomtomRoutingAllowed(now = Date.now()): boolean {
  return tomtomAvailable("routing", now) && !quotaSpent("tomtomRouting", now);
}

/** Test hook: forget the breaker, counters and caches. */
export function resetTomtomGuard(): void {
  breakers.routing = { until: 0, reason: null };
  breakers.incidents = { until: 0, reason: null };
  breakers.geocoding = { until: 0, reason: null };
  usage.month = "";
  usage.counts = { tomtomRouting: 0, tomtomIncidents: 0, tomtomGeocoding: 0, mapboxDirections: 0 };
  usage.warned = new Set();
  typicalCache.clear();
  incidentMemory.clear();
}

// ---- the historical ("usual") time: a profile, valid for hours -------------

const TYPICAL_TTL_MS = 6 * 60 * 60_000;
const TYPICAL_MAX = 200;
const typicalCache = new Map<string, { at: number; seconds: number }>();

/** One key per origin/destination (≈100 m) and hour of the day: the usual time changes slowly. */
export function typicalKey(
  data: { fromLat: number; fromLon: number; toLat: number; toLon: number },
  now = Date.now(),
): string {
  const r = (v: number) => (Math.round(v * 1000) / 1000).toFixed(3);
  const hour = new Date(now - 10 * 3600_000).getUTCHours(); // Hawaii time
  return `${r(data.fromLat)},${r(data.fromLon)}>${r(data.toLat)},${r(data.toLon)}@${hour}`;
}

export function readTypical(key: string, now = Date.now()): number | null {
  const hit = typicalCache.get(key);
  return hit && now - hit.at < TYPICAL_TTL_MS ? hit.seconds : null;
}

export function rememberTypical(key: string, seconds: number, now = Date.now()): void {
  typicalCache.delete(key);
  typicalCache.set(key, { at: now, seconds });
  while (typicalCache.size > TYPICAL_MAX) {
    const oldest = typicalCache.keys().next().value;
    if (typeof oldest !== "string") break;
    typicalCache.delete(oldest);
  }
}

// ---- incident details: one shared answer per area --------------------------

/** Most of Oʻahu in one box (about 4,700 km²; TomTom allows 10,000). One call serves every trip on the island. */
export const OAHU_INCIDENT_BOX = { minLat: 21.2, maxLat: 21.75, minLon: -158.35, maxLon: -157.6 };

export type Box = { minLat: number; maxLat: number; minLon: number; maxLon: number };

/**
 * The box to ask TomTom for. A trip inside Oʻahu uses the one shared island box
 * (so every rider shares a single cached answer); anything else uses its own
 * box snapped outward to a 0.05° grid so near-identical trips still share.
 */
export function incidentBoxFor(trip: Box): { key: string; box: Box } {
  const o = OAHU_INCIDENT_BOX;
  if (
    trip.minLat >= o.minLat &&
    trip.maxLat <= o.maxLat &&
    trip.minLon >= o.minLon &&
    trip.maxLon <= o.maxLon
  )
    return { key: "oahu", box: o };
  const g = 0.05;
  const box = {
    minLat: Math.floor(trip.minLat / g) * g,
    maxLat: Math.ceil(trip.maxLat / g) * g,
    minLon: Math.floor(trip.minLon / g) * g,
    maxLon: Math.ceil(trip.maxLon / g) * g,
  };
  const f = (v: number) => v.toFixed(2);
  return { key: `${f(box.minLat)},${f(box.minLon)},${f(box.maxLat)},${f(box.maxLon)}`, box };
}

/** How old an incident answer may be: 5 min for active navigation, 10 min otherwise, 30 min once the month's allowance is tight. */
export function incidentMaxAgeMs(navigating: boolean, now = Date.now()): number {
  if (quotaTight("tomtomIncidents", now)) return 30 * 60_000;
  return navigating ? 5 * 60_000 : 10 * 60_000;
}

const incidentMemory = new Map<string, { at: number; value: unknown }>();
const incidentInflight = new Map<string, Promise<unknown>>();

/**
 * Shared, deduplicated read-through for one incident box. `load` runs at most
 * once per box per max-age, and identical concurrent loads are asked once.
 * A null result is not remembered (the next caller retries once the breaker allows).
 */
export async function sharedIncidents<T>(
  key: string,
  maxAgeMs: number,
  load: () => Promise<T | null>,
  now = Date.now(),
): Promise<T | null> {
  const hit = incidentMemory.get(key);
  if (hit && now - hit.at < maxAgeMs) return hit.value as T;
  const running = incidentInflight.get(key);
  if (running) return (await running) as T | null;
  const task = (async () => {
    const value = await load();
    if (value !== null) {
      incidentMemory.delete(key);
      incidentMemory.set(key, { at: now, value });
      while (incidentMemory.size > 12) {
        const oldest = incidentMemory.keys().next().value;
        if (typeof oldest !== "string") break;
        incidentMemory.delete(oldest);
      }
    }
    return value;
  })();
  incidentInflight.set(key, task);
  try {
    return await task;
  } finally {
    incidentInflight.delete(key);
  }
}
