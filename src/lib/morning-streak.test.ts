import { describe, expect, it } from "vitest";
import { addMorning, morningStreak, streakToCelebrate } from "./morning-streak";

const days = (...d: string[]) => d;

describe("morning streak (device only)", () => {
  it("counts consecutive mornings ending today", () => {
    expect(morningStreak(days("2026-10-12", "2026-10-13", "2026-10-14"), "2026-10-14")).toBe(3);
  });
  it("keeps yesterday's streak alive until today has an answer", () => {
    expect(morningStreak(days("2026-10-12", "2026-10-13"), "2026-10-14")).toBe(2);
  });
  it("breaks on a missed day", () => {
    expect(morningStreak(days("2026-10-10", "2026-10-13", "2026-10-14"), "2026-10-14")).toBe(2);
  });
  it("counts across a month boundary", () => {
    expect(morningStreak(days("2026-09-30", "2026-10-01"), "2026-10-01")).toBe(2);
  });
  it("adds a day once and keeps 30", () => {
    const log = { days: ["2026-10-13"], celebrated: 0 };
    expect(addMorning(log, "2026-10-13")).toBe(log);
    const long = {
      days: Array.from({ length: 30 }, (_, i) => `2026-09-${String(i + 1).padStart(2, "0")}`),
      celebrated: 0,
    };
    const next = addMorning(long, "2026-10-01");
    expect(next.days).toHaveLength(30);
    expect(next.days.at(-1)).toBe("2026-10-01");
  });
  it("celebrates at 5 in a row, once, then again at 10", () => {
    const five = {
      days: days("2026-10-10", "2026-10-11", "2026-10-12", "2026-10-13", "2026-10-14"),
      celebrated: 0,
    };
    expect(streakToCelebrate(five, "2026-10-14")).toBe(5);
    expect(streakToCelebrate({ ...five, celebrated: 5 }, "2026-10-14")).toBeNull();
    const four = { days: five.days.slice(1), celebrated: 0 };
    expect(streakToCelebrate(four, "2026-10-14")).toBeNull();
  });
});
