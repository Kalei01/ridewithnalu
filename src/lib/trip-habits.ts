/**
 * Learns which saved place someone usually heads to at this time of day, on
 * this phone only. Used to open their usual trip straight away, and only when
 * the habit is real: three or more trips to that place at about this time on
 * the same kind of day (weekday or weekend) in the last 30 days.
 */
export type TripOpen = { slot: string; at: number };

const KEY = "nalu-trip-habits-v1";
const IGNORED_KEY = "nalu-autoopen-ignored-v1";
const MIN_TRIPS = 3;
const WINDOW_MINUTES = 75;
const LOOKBACK_DAYS = 30;
/** After this many "not now"s in a row, stop opening trips automatically. */
export const MAX_IGNORES = 3;

function honolulu(at: number) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Pacific/Honolulu",
    weekday: "short",
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h23",
  }).formatToParts(new Date(at));
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  const weekend = get("weekday") === "Sat" || get("weekday") === "Sun";
  return { weekend, minutes: Number(get("hour")) * 60 + Number(get("minute")) };
}

export function readHabits(): TripOpen[] {
  try {
    const list = JSON.parse(window.localStorage.getItem(KEY) ?? "[]") as unknown;
    return Array.isArray(list) ? (list as TripOpen[]) : [];
  } catch {
    return [];
  }
}

export function recordTripOpen(slot: string, at = Date.now()) {
  const cutoff = at - LOOKBACK_DAYS * 86_400_000;
  try {
    const list = [...readHabits().filter((item) => item.at > cutoff), { slot, at }].slice(-150);
    window.localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* private mode */
  }
}

/** The saved-place slot this person usually opens now, or null. Pure, for tests. */
export function predictSlot(history: TripOpen[], now: number): string | null {
  const here = honolulu(now);
  const cutoff = now - LOOKBACK_DAYS * 86_400_000;
  const counts = new Map<string, number>();
  for (const item of history) {
    if (item.at <= cutoff || item.at > now) continue;
    const then = honolulu(item.at);
    const gap = Math.abs(then.minutes - here.minutes);
    if (then.weekend !== here.weekend || Math.min(gap, 1440 - gap) > WINDOW_MINUTES) continue;
    counts.set(item.slot, (counts.get(item.slot) ?? 0) + 1);
  }
  let best: string | null = null;
  let bestCount = 0;
  for (const [slot, count] of counts) {
    if (count > bestCount) [best, bestCount] = [slot, count];
  }
  return bestCount >= MIN_TRIPS ? best : null;
}

export function autoOpenAllowed() {
  try {
    return Number(window.localStorage.getItem(IGNORED_KEY) ?? "0") < MAX_IGNORES;
  } catch {
    return false;
  }
}

/** "Not now" on an auto-opened trip; enough in a row turns the feature off. */
export function noteIgnored() {
  try {
    const n = Number(window.localStorage.getItem(IGNORED_KEY) ?? "0") + 1;
    window.localStorage.setItem(IGNORED_KEY, String(n));
  } catch {
    /* private mode */
  }
}

/** They used the auto-opened trip: the habit is right, reset the count. */
export function noteUsed() {
  try {
    window.localStorage.removeItem(IGNORED_KEY);
  } catch {
    /* private mode */
  }
}
