/**
 * Mornings in a row a rider checked a trip, counted on this device only (no server
 * data). A "morning" is a Honolulu calendar day with an answer before noon.
 */
export const MORNING_STREAK_MILESTONE = 5;

const DAY_MS = 86_400_000;
const KEEP_DAYS = 30;

export type MorningLog = { days: string[]; celebrated: number };

function dayNumber(iso: string): number {
  return Math.round(Date.parse(`${iso}T00:00:00Z`) / DAY_MS);
}

/** Adds today (an ISO date, YYYY-MM-DD) to the log; keeps the last 30 days. */
export function addMorning(log: MorningLog, today: string): MorningLog {
  if (log.days.includes(today)) return log;
  const days = [...log.days, today].sort().slice(-KEEP_DAYS);
  return { ...log, days };
}

/** Consecutive mornings ending today (or yesterday, if today has no answer yet). */
export function morningStreak(days: string[], today: string): number {
  const set = new Set(days.map(dayNumber));
  let day = dayNumber(today);
  if (!set.has(day)) day -= 1;
  let streak = 0;
  while (set.has(day)) {
    streak += 1;
    day -= 1;
  }
  return streak;
}

/** True once per milestone: at 5, 10, 15... and not again until the next one. */
export function streakToCelebrate(log: MorningLog, today: string): number | null {
  const streak = morningStreak(log.days, today);
  if (streak < MORNING_STREAK_MILESTONE) return null;
  const milestone = streak - (streak % MORNING_STREAK_MILESTONE);
  return milestone > log.celebrated ? milestone : null;
}
