import type { Option } from "@/lib/commute-model";
import { honoluluDateKey } from "@/lib/commute-formatting";

const DAY_SECONDS = 86400;

/**
 * Moves every time in a trip by whole days (negative moves it earlier). Trip
 * times count from midnight of the day they were planned, so a late bus planned
 * at 11:55 PM arrives at "25:12"; after midnight the clock reads 0:05, and the
 * trip has to move back a day to be compared with it.
 */
export function shiftOptionDays(option: Option, days: number): Option {
  if (days === 0) return option;
  const by = days * DAY_SECONDS;
  return {
    ...option,
    leave_by_seconds: option.leave_by_seconds + by,
    depart_seconds: option.depart_seconds + by,
    arrive_seconds: option.arrive_seconds + by,
    legs: option.legs.map((leg) => ({
      ...leg,
      depart_seconds: leg.depart_seconds === null ? null : leg.depart_seconds + by,
      arrive_seconds: leg.arrive_seconds === null ? null : leg.arrive_seconds + by,
    })),
  };
}

/** Whole Honolulu calendar days from `from` to `to` (0 on the same day). */
export function honoluluDaysBetween(from: Date, to: Date): number {
  const day = (date: Date) => {
    const [year = 0, month = 1, dayOfMonth = 1] = honoluluDateKey(date).split("-").map(Number);
    return Date.UTC(year, month - 1, dayOfMonth);
  };
  return Math.round((day(to) - day(from)) / (DAY_SECONDS * 1000));
}
