import { describe, expect, it } from "vitest";
import type { Option } from "./commute-model";
import { honoluluDaysBetween, shiftOptionDays } from "./service-day";

// A late bus boarded before midnight: leave 11:55 PM, arrive 1:12 AM ("25:12").
const lateBus = {
  leave_by_seconds: 23 * 3600 + 55 * 60,
  depart_seconds: 23 * 3600 + 58 * 60,
  arrive_seconds: 25 * 3600 + 12 * 60,
  total_minutes: 77,
  legs: [
    { mode: "walk", depart_seconds: null, arrive_seconds: null },
    { mode: "bus", depart_seconds: 23 * 3600 + 58 * 60, arrive_seconds: 25 * 3600 + 5 * 60 },
  ],
} as unknown as Option;

describe("a trip that runs past midnight", () => {
  it("shows the real time left after midnight, not about 25 hours", () => {
    const fiveAfterMidnight = 5 * 60;
    const onClock = shiftOptionDays(lateBus, -1);
    expect(Math.round((onClock.arrive_seconds - fiveAfterMidnight) / 60)).toBe(67);
  });

  it("moves every time, legs included, and leaves missing times alone", () => {
    const moved = shiftOptionDays(lateBus, -1);
    expect(moved.leave_by_seconds).toBe(-5 * 60);
    expect(moved.legs[1]).toMatchObject({ depart_seconds: -2 * 60, arrive_seconds: 65 * 60 });
    expect(moved.legs[0]).toMatchObject({ depart_seconds: null, arrive_seconds: null });
  });

  it("is untouched on the day it was boarded", () => {
    expect(shiftOptionDays(lateBus, 0)).toBe(lateBus);
  });
});

describe("Honolulu calendar days", () => {
  it("counts midnight in Honolulu, not on the phone's own clock", () => {
    // 11:55 PM and 12:05 AM Honolulu time (UTC−10).
    const before = new Date("2026-10-06T09:55:00Z");
    const after = new Date("2026-10-06T10:05:00Z");
    expect(honoluluDaysBetween(before, after)).toBe(1);
    expect(honoluluDaysBetween(before, before)).toBe(0);
    expect(honoluluDaysBetween(after, before)).toBe(-1);
  });
});
