/** Browser side of "Time to leave" alerts: which ones this device has on. */
export type LocalLeaveAlert = {
  placeKey: string;
  placeLabel: string;
  arriveMin: number;
  days: number[];
};

export const LEAVE_ALERTS_KEY = "nalu-leave-alerts-v1";
export const LEAVE_OFFER_DISMISSED_KEY = "nalu-leave-offer-dismissed-v1";
export const WEEKDAYS = [1, 2, 3, 4, 5];
export const DAY_LETTERS: Record<number, string> = { 1: "M", 2: "T", 3: "W", 4: "T", 5: "F", 6: "S", 7: "S" };
export const DAY_NAMES: Record<number, string> = {
  1: "Monday", 2: "Tuesday", 3: "Wednesday", 4: "Thursday", 5: "Friday", 6: "Saturday", 7: "Sunday",
};

export function readLeaveAlerts(): LocalLeaveAlert[] {
  try {
    const raw = window.localStorage.getItem(LEAVE_ALERTS_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? (parsed as LocalLeaveAlert[]) : [];
  } catch {
    return [];
  }
}

export function writeLeaveAlerts(list: LocalLeaveAlert[]) {
  try {
    window.localStorage.setItem(LEAVE_ALERTS_KEY, JSON.stringify(list));
  } catch {
    /* private mode */
  }
}

/** "weekdays", "every day", or "Mon, Wed, Fri". */
export function describeDays(days: number[]) {
  const set = new Set(days);
  if (set.size === 7) return "every day";
  if (set.size === 5 && WEEKDAYS.every((day) => set.has(day))) return "weekdays";
  if (set.size === 2 && set.has(6) && set.has(7)) return "weekends";
  return [...set].sort().map((day) => DAY_NAMES[day]!.slice(0, 3)).join(", ");
}

export function minutesClock(minutes: number) {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return `${hour % 12 || 12}:${String(minute).padStart(2, "0")} ${hour < 12 ? "AM" : "PM"}`;
}
