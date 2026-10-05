import { describe, expect, it } from "vitest";
import { summarizeWeek, type TripLogEntry } from "./trip-log";

const now = Date.UTC(2026, 9, 9, 20);
const trip = (chosen: number | null, other: number | null, mode: TripLogEntry["mode"] = "drive"): TripLogEntry => ({
  mode,
  startedAt: now - 3_600_000,
  endedAt: now - 3_600_000 + 30 * 60_000,
  chosenMinutes: chosen,
  otherMinutes: other,
});

describe("weekly time saved", () => {
  it("counts the difference when both options were realistic", () => {
    const week = summarizeWeek([trip(30, 45), trip(40, 50, "transit")], now)!;
    expect(week.minutesSaved).toBe(25);
    expect(week.comparedTrips).toBe(2);
    expect(week.transitTrips).toBe(1);
  });

  it("gives no credit for skipping an option more than twice as long", () => {
    const week = summarizeWeek([trip(30, 95)], now)!;
    expect(week.minutesSaved).toBe(0);
    expect(week.comparedTrips).toBe(0);
  });

  it("never counts picking the slower option as a saving", () => {
    const week = summarizeWeek([trip(45, 30)], now)!;
    expect(week.minutesSaved).toBe(0);
    expect(week.comparedTrips).toBe(1);
  });

  it("ignores trips older than a week and missing estimates", () => {
    const old = { ...trip(30, 45), endedAt: now - 8 * 86_400_000 };
    expect(summarizeWeek([old], now)).toBeNull();
    expect(summarizeWeek([trip(null, 40)], now)!.comparedTrips).toBe(0);
  });
});

describe("Honolulu week", () => {
  it("starts on Monday at midnight Honolulu time", async () => {
    const { honoluluWeekStart } = await import("./trip-log");
    // Sunday Oct 11, 2026, 6 p.m. in Honolulu is Monday 04:00 UTC.
    const start = honoluluWeekStart(Date.UTC(2026, 9, 12, 4));
    expect(start.key).toBe("2026-10-05");
    expect(start.ms).toBe(Date.UTC(2026, 9, 5, 10));
  });
});
