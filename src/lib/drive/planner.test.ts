import { describe, expect, it } from "vitest";
import { honoluluSecondsToIso, planDriveArrival } from "./planner";

describe("drive planner", () => {
  it("works backward with a realistic destination buffer", () => {
    const plan = planDriveArrival(7 * 3600 + 30 * 60, 40, 6 * 3600);
    expect(plan.leaveBySeconds).toBe(6 * 3600 + 50 * 60);
    expect(plan.feasible).toBe(true);
    expect(plan.bufferMinutes).toBe(0);
  });

  it("creates a Hawaii-time future routing instant", () => {
    expect(honoluluSecondsToIso(7 * 3600 + 30 * 60, new Date("2026-09-22T12:00:00Z"))).toBe(
      "2026-09-22T07:30:00-10:00",
    );
  });
});
