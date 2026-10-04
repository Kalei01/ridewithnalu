import { describe, expect, it } from "vitest";
import { predictSlot } from "./trip-habits";

// 2026-10-05 is a Monday. Honolulu is UTC-10.
const hst = (day: number, hour: number, minute = 0) => Date.UTC(2026, 9, day, hour + 10, minute);

describe("predictSlot", () => {
  const mornings = [hst(5, 7), hst(6, 7, 10), hst(7, 6, 50)].map((at) => ({ slot: "work", at }));

  it("predicts a place opened three times around this time on weekdays", () => {
    expect(predictSlot(mornings, hst(8, 7, 5))).toBe("work");
  });

  it("needs at least three trips", () => {
    expect(predictSlot(mornings.slice(0, 2), hst(8, 7))).toBeNull();
  });

  it("ignores trips at a different time of day", () => {
    expect(predictSlot(mornings, hst(8, 17))).toBeNull();
  });

  it("keeps weekdays and weekends apart", () => {
    expect(predictSlot(mornings, hst(10, 7))).toBeNull(); // Saturday
  });

  it("forgets trips older than 30 days", () => {
    const old = [hst(5, 7), hst(6, 7), hst(7, 7)].map((at) => ({ slot: "work", at: at - 40 * 86_400_000 }));
    expect(predictSlot(old, hst(8, 7))).toBeNull();
  });

  it("picks the most frequent place when there are two", () => {
    const gym = [hst(5, 7, 30), hst(6, 7, 30), hst(7, 7, 30), hst(1, 7, 30)].map((at) => ({ slot: "gym", at }));
    expect(predictSlot([...mornings, ...gym], hst(8, 7, 20))).toBe("gym");
  });
});
