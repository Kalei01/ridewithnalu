/**
 * Nalu plans: what each tier gets. One place to change the lineup.
 *
 *   guest  not signed in
 *   free   signed up (free account)
 *   plus   paid subscription, or a comped owner account
 *
 * ENFORCE_TIERS is off: nothing is restricted until the lineup is agreed.
 * The database answers "which tier am I?" through the my_tier() function.
 */

export type Tier = "guest" | "free" | "plus";

export const ENFORCE_TIERS = false;

export type Feature =
  | "drive_vs_transit_answer"
  | "nearby_stops"
  | "live_bus_times"
  | "saved_places"
  | "arrive_by"
  | "leave_alert_one"
  | "leave_alerts_all"
  | "turn_by_turn"
  | "traffic_rescue_tips"
  | "ask_nalu";

const RANK: Record<Tier, number> = { guest: 0, free: 1, plus: 2 };

/** The lowest tier that unlocks each feature (draft lineup, to be agreed). */
export const FEATURE_TIER: Record<Feature, Tier> = {
  drive_vs_transit_answer: "guest",
  nearby_stops: "guest",
  live_bus_times: "guest",
  saved_places: "free",
  arrive_by: "free",
  leave_alert_one: "free",
  leave_alerts_all: "plus",
  turn_by_turn: "plus",
  traffic_rescue_tips: "plus",
  ask_nalu: "plus",
};

/** "Where to?" trip checks per day. Null means unlimited. */
export const DAILY_TRIP_LIMIT: Record<Tier, number | null> = {
  guest: 5,
  free: null,
  plus: null,
};

const PREVIEW_KEY = "nalu-dev-preview-tier-v1";

/** Developer mode: the tier the owner is previewing on this device, if any. */
export function readPreviewTier(): Tier | null {
  try {
    const value = window.localStorage.getItem(PREVIEW_KEY);
    return value === "guest" || value === "free" || value === "plus" ? value : null;
  } catch {
    return null;
  }
}

export function writePreviewTier(tier: Tier | null) {
  try {
    if (tier) window.localStorage.setItem(PREVIEW_KEY, tier);
    else window.localStorage.removeItem(PREVIEW_KEY);
  } catch {
    /* private mode */
  }
  window.dispatchEvent(new Event("nalu-preview-tier"));
}

/** A developer preview always shows the limits, even before they're switched on. */
export function tierAllows(tier: Tier, feature: Feature, previewing = false): boolean {
  if (!ENFORCE_TIERS && !previewing) return true;
  return RANK[tier] >= RANK[FEATURE_TIER[feature]];
}

export function asTier(value: unknown): Tier {
  return value === "plus" || value === "free" ? value : "guest";
}

const TRIP_COUNT_KEY = "nalu-trip-checks-v1";

/**
 * Counts a "Where to?" trip check on this device for today (Honolulu date) and
 * says whether it's allowed. A soft limit for guests; signing up removes it.
 */
export function consumeTripCheck(tier: Tier, now = new Date()): { allowed: boolean; remaining: number | null } {
  const limit = DAILY_TRIP_LIMIT[tier];
  if (!ENFORCE_TIERS || limit === null) return { allowed: true, remaining: null };
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Pacific/Honolulu" }).format(now);
  let used = 0;
  try {
    const saved = JSON.parse(window.localStorage.getItem(TRIP_COUNT_KEY) ?? "null") as { day: string; used: number } | null;
    used = saved?.day === today ? saved.used : 0;
    if (used >= limit) return { allowed: false, remaining: 0 };
    window.localStorage.setItem(TRIP_COUNT_KEY, JSON.stringify({ day: today, used: used + 1 }));
  } catch {
    return { allowed: true, remaining: null };
  }
  return { allowed: true, remaining: limit - used - 1 };
}
