import { expect, it } from "vitest";
import { dropDeparted } from "./departed";
import { throttledPlanMinute, IDLE_TRANSIT_REPLAN_MS } from "../route-commitment";

it("drops trips that already left, keeps ones leaving now, within the grace", () => {
  const options = [
    { leave_by_seconds: 36_000 },
    { leave_by_seconds: 36_100 },
    { leave_by_seconds: 36_500 },
    { leave_by_seconds: null },
  ];
  expect(dropDeparted(options, 36_120).map((o) => o.leave_by_seconds)).toEqual([
    36_100,
    36_500,
    null,
  ]);
});

it("an idle trip screen never holds the planner minute longer than 60 seconds", () => {
  expect(IDLE_TRANSIT_REPLAN_MS).toBeLessThanOrEqual(60_000);
  const held = throttledPlanMinute(null, 36_000, 0, false, { hidden: false });
  expect(throttledPlanMinute(held, 36_030, 30_000, false, { hidden: false })).toBe(held);
  expect(throttledPlanMinute(held, 36_060, 60_000, false, { hidden: false }).value).toBe(36_060);
});
