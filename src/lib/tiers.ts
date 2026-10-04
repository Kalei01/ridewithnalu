/**
 * Nalu plans: what each tier gets. One place to change the lineup.
 *
 *   guest  not signed in
 *   free   signed up (free account)
 *   plus   paid subscription, or a comped owner account
 *
 * Lineup agreed in the Plans doc. Two switches, both off in Phase 1 (everything
 * free); Phase 2 (around 200 weekly users) turns them on:
 *   ENFORCE_GUEST_LIMITS  guests get 5 trip checks a day; account features need sign-up
 *   ENFORCE_PLUS          Plus features need Plus (needs payments first)
 * Developers can preview any tier from the Dev panel with the limits applied.
 * The database answers "which tier am I?" through the my_tier() function.
 */

export type Tier = "guest" | "free" | "plus";

export const ENFORCE_GUEST_LIMITS = false;
export const ENFORCE_PLUS = false;
/** True when any limit is on (shown in the Dev panel). */
export const ENFORCE_TIERS = ENFORCE_GUEST_LIMITS || ENFORCE_PLUS;

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
  | "riding_alerts"
  | "get_home_safe"
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
  riding_alerts: "plus",
  // Safety stays free for everyone, forever.
  get_home_safe: "guest",
  ask_nalu: "plus",
};

/** Plain names for the upgrade screens. */
export const FEATURE_NAME: Record<Feature, string> = {
  drive_vs_transit_answer: "The drive-or-transit answer",
  nearby_stops: "Nearby stops",
  live_bus_times: "Live bus times",
  saved_places: "Saved places on all your phones",
  arrive_by: "Arrive-by planning",
  leave_alert_one: "A time-to-leave alert",
  leave_alerts_all: "More time-to-leave alerts",
  turn_by_turn: "Turn-by-turn voice directions",
  traffic_rescue_tips: "Live traffic updates while you drive",
  riding_alerts: "“Get off in 2 stops” alerts",
  get_home_safe: "Get home safe",
  ask_nalu: "Ask Nalu",
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
  const needs = FEATURE_TIER[feature];
  if (RANK[tier] >= RANK[needs]) return true;
  if (previewing) return false;
  return needs === "plus" ? !ENFORCE_PLUS : !ENFORCE_GUEST_LIMITS;
}

export function asTier(value: unknown): Tier {
  return value === "plus" || value === "free" ? value : "guest";
}

const TRIP_COUNT_KEY = "nalu-trip-checks-v1";

/**
 * Counts a "Where to?" trip check on this device for today (Honolulu date) and
 * says whether it's allowed. A soft limit for guests; signing up removes it.
 */
export function consumeTripCheck(
  tier: Tier,
  now = new Date(),
  previewing = false,
): { allowed: boolean; remaining: number | null } {
  const limit = DAILY_TRIP_LIMIT[tier];
  if ((!ENFORCE_GUEST_LIMITS && !previewing) || limit === null) return { allowed: true, remaining: null };
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
