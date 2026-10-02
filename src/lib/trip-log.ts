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
  minutesSaved: number;
  averageMinutes: number;
};

export function weeklyDigest(now = Date.now()): WeeklyDigest | null {
  const week = read().filter((t) => t.endedAt > now - 7 * 86_400_000);
  if (!week.length) return null;
  let saved = 0;
  for (const t of week) {
    if (t.chosenMinutes != null && t.otherMinutes != null)
      saved += Math.max(0, t.otherMinutes - t.chosenMinutes);
  }
  const total = week.reduce((sum, t) => sum + (t.endedAt - t.startedAt) / 60_000, 0);
  return {
    trips: week.length,
    driveTrips: week.filter((t) => t.mode === "drive").length,
    transitTrips: week.filter((t) => t.mode === "transit").length,
    minutesSaved: Math.round(saved),
    averageMinutes: Math.round(total / week.length),
  };
}
