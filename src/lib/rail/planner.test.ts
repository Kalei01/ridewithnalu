import { describe, expect, it } from "vitest";

import { latestRailArrival } from "./planner";

describe("rail arrive-by planner", () => {
  const options = [
    { leave_by_seconds: 21_600, arrive_seconds: 24_000, id: "early" },
    { leave_by_seconds: 22_200, arrive_seconds: 24_600, id: "latest-feasible" },
    { leave_by_seconds: 22_800, arrive_seconds: 25_200, id: "too-late" },
  ];

  it("selects the latest departure that meets the arrival deadline", () => {
    const pick = latestRailArrival(options, 24_900);
    expect(pick.option?.id).toBe("latest-feasible");
    expect(pick.feasible).toBe(true);
  });

  it("reports the earliest available arrival when none are feasible", () => {
    const pick = latestRailArrival(options, 23_000);
    expect(pick.option).toBeNull();
    expect(pick.earliestOption?.id).toBe("early");
    expect(pick.earliestArriveSeconds).toBe(24_000);
    expect(pick.feasible).toBe(false);
  });

  it("handles an empty service result", () => {
    expect(latestRailArrival([], 24_900)).toEqual({
      option: null,
      earliestOption: null,
      earliestArriveSeconds: null,
      feasible: false,
    });
  });
});
