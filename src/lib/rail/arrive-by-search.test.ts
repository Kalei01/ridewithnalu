import { describe, expect, it } from "vitest";
import { collectArriveByOptions } from "./arrive-by-search";
import { latestRailArrival } from "./planner";

const at = (h: number, m = 0) => (h * 60 + m) * 60;

describe("Arrive By timetable search", () => {
  const departures = Array.from({ length: 40 }, (_, index) => ({
    depart_seconds: at(6) + index * 15 * 60,
    leave_by_seconds: at(6) + index * 15 * 60 - 20 * 60,
    arrive_seconds: at(7) + index * 15 * 60,
  }));
  const fetchPage = async (after: number) =>
    departures.filter((item) => item.depart_seconds >= after).slice(0, 8);

  it("finds the latest viable afternoon trip beyond the first eight departures", async () => {
    const result = await collectArriveByOptions({
      nowSeconds: at(6),
      targetSeconds: at(14),
      fetchPage,
    });
    expect(result.complete).toBe(true);
    expect(result.pages).toBeGreaterThan(1);
    expect(latestRailArrival(result.options, at(14)).option?.arrive_seconds).toBe(at(14));
  });

  it("reports an incomplete capped search instead of claiming an early train is latest", async () => {
    const result = await collectArriveByOptions({
      nowSeconds: at(6),
      targetSeconds: at(14),
      fetchPage,
      maxPages: 1,
    });
    expect(result.complete).toBe(false);
  });
  it("does not skip a departure shortly after a sparse page", async () => {
    const sparse = [
      { depart_seconds: at(7), arrive_seconds: at(8) },
      { depart_seconds: at(7, 5), arrive_seconds: at(8, 5) },
    ];
    const result = await collectArriveByOptions({
      nowSeconds: at(6),
      targetSeconds: at(8, 5),
      fetchPage: async (after) => sparse.filter((item) => item.depart_seconds >= after).slice(0, 1),
    });
    expect(result.options).toHaveLength(2);
  });
});
