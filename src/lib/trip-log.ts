/** On-device commute log for the weekly digest. Stores durations only — never GPS. */
export type TripLogEntry = {
  mode: "drive" | "transit";
  startedAt: number;
  endedAt: number;
  /** Predicted minutes for the chosen mode at start. */
  chosenMinutes: number | null;
  /** Predicted minutes for the other mode at start. */
  otherMinutes: number | null;
};

const KEY = "nalu-trip-log-v1";
const PENDING = "nalu-trip-pending-v1";

function read(): TripLogEntry[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as Array<Omit<TripLogEntry, "mode"> & { mode?: "drive" | "rail" | "transit" }>) : [];
    return Array.isArray(list)
      ? list.map((entry) => {
          const mode = entry.mode === "rail" ? "transit" : entry.mode;
          return { ...entry, mode } as TripLogEntry;
        })
      : [];
  } catch {
    return [];
  }
}

export function startTripLog(entry: Omit<TripLogEntry, "endedAt">) {
  try {
    window.localStorage.setItem(PENDING, JSON.stringify(entry));
  } catch {
    /* ignore */
  }
}

export function finishTripLog() {
  try {
    const raw = window.localStorage.getItem(PENDING);
    window.localStorage.removeItem(PENDING);
    if (!raw) return;
    const pending = JSON.parse(raw) as Omit<TripLogEntry, "endedAt">;
    const endedAt = Date.now();
    if (endedAt - pending.startedAt < 60_000) return; // ignore accidental starts
    const cutoff = endedAt - 60 * 86_400_000;
    const list = [...read().filter((t) => t.endedAt > cutoff), { ...pending, endedAt }];
    window.localStorage.setItem(KEY, JSON.stringify(list.slice(-200)));
  } catch {
    /* ignore */
  }
}

export type WeeklyDigest = {
  trips: number;
  driveTrips: number;
  transitTrips: number;
  /** Trips where both options were realistic, so a saving can be claimed. */
  comparedTrips: number;
  minutesSaved: number;
  averageMinutes: number;
};

/**
 * A saving only counts when the other option was a real choice: no more than
 * twice as long as the one taken. Otherwise a rider who always drives would
 * be credited every week for skipping a 90-minute bus they'd never take.
 */
export const REALISTIC_RATIO = 2;

export function summarizeWeek(entries: TripLogEntry[], now = Date.now()): WeeklyDigest | null {
  return summarizeSince(entries, now - 7 * 86_400_000);
}

/** Trips that ended after `since`, summarized the same way as the weekly card. */
export function summarizeSince(entries: TripLogEntry[], since: number): WeeklyDigest | null {
  const week = entries.filter((t) => t.endedAt > since);
  if (!week.length) return null;
  let saved = 0;
  let compared = 0;
  for (const t of week) {
    if (t.chosenMinutes == null || t.otherMinutes == null || t.chosenMinutes <= 0) continue;
    const faster = Math.min(t.chosenMinutes, t.otherMinutes);
    const slower = Math.max(t.chosenMinutes, t.otherMinutes);
    if (slower > faster * REALISTIC_RATIO) continue;
    compared += 1;
    saved += Math.max(0, t.otherMinutes - t.chosenMinutes);
  }
  const total = week.reduce((sum, t) => sum + (t.endedAt - t.startedAt) / 60_000, 0);
  return {
    trips: week.length,
    driveTrips: week.filter((t) => t.mode === "drive").length,
    transitTrips: week.filter((t) => t.mode === "transit").length,
    comparedTrips: compared,
    minutesSaved: Math.round(saved),
    averageMinutes: Math.round(total / week.length),
  };
}

export function weeklyDigest(now = Date.now()): WeeklyDigest | null {
  return summarizeWeek(read(), now);
}

const HONOLULU_OFFSET_MS = 10 * 3_600_000; // Hawaiʻi has no daylight saving time.

/** Monday 12:00 a.m. in Honolulu for the week containing `now`. */
export function honoluluWeekStart(now = Date.now()): { ms: number; key: string } {
  const local = new Date(now - HONOLULU_OFFSET_MS);
  const daysSinceMonday = (local.getUTCDay() + 6) % 7;
  const mondayLocal = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() - daysSinceMonday);
  return { ms: mondayLocal + HONOLULU_OFFSET_MS, key: new Date(mondayLocal).toISOString().slice(0, 10) };
}

/** This Honolulu week so far (Monday on), for the Sunday email. */
export function thisWeekSoFar(now = Date.now()): { key: string; digest: WeeklyDigest | null } {
  const start = honoluluWeekStart(now);
  return { key: start.key, digest: summarizeSince(read(), start.ms) };
}
