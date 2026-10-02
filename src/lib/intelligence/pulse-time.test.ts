import { describe, expect, it } from "vitest";
import {
  formatLocalTime,
  isWithinLocalWindow,
  localPulseClock,
  minutesSinceMidnight,
} from "./pulse-time";

describe("pulse time", () => {
  it("uses Hawaii local time for the Hawaii timezone", () => {
    const clock = localPulseClock(new Date("2026-10-01T16:30:00.000Z"), "Pacific/Honolulu");
    expect(clock.weekday).toBe("Thu");
    expect(clock.hour).toBe(6);
    expect(clock.minute).toBe(30);
  });

  it("uses the destination timezone instead of UTC", () => {
    const clock = localPulseClock(new Date("2026-10-01T13:30:00.000Z"), "America/New_York");
    expect(clock.hour).toBe(9);
    expect(clock.minute).toBe(30);
  });

  it("recognizes weekday schedule windows from local minutes", () => {
    const clock = localPulseClock(new Date("2026-10-01T16:30:00.000Z"), "Pacific/Honolulu");
    expect(minutesSinceMidnight(clock)).toBe(390);
    expect(isWithinLocalWindow(clock, 360, 480)).toBe(true);
    expect(isWithinLocalWindow(clock, 840, 1140)).toBe(false);
  });

  it("formats a leave-by time in the commute timezone", () => {
    expect(formatLocalTime(new Date("2026-10-01T16:40:00.000Z"), "Pacific/Honolulu")).toBe("6:40 AM");
  });
});
