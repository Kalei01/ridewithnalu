import { describe, expect, it } from "vitest";
import {
  honoluluSecondsToIso,
  planDriveArrival,
  planDriveArrivalWithRange,
  solveFutureDrive,
} from "./planner";

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

  it("plans arrival at the destination door with a range", () => {
    const plan = planDriveArrivalWithRange(
      7 * 3600 + 30 * 60,
      { lowMinutes: 40, trafficMinutes: 42, highMinutes: 48 },
      { lowMin: 7, typicalMin: 10, highMin: 14 },
      6 * 3600,
    );
    expect(plan.leaveBySeconds).toBe(6 * 3600 + 28 * 60);
    expect(plan.arriveSeconds).toBe(7 * 3600 + 20 * 60);
    expect(plan.latestArrivalSeconds).toBe(7 * 3600 + 30 * 60);
    expect(plan.feasible).toBe(true);
  });

  it("marks a target already passed as infeasible", () => {
    const plan = planDriveArrivalWithRange(
      6 * 3600,
      { lowMinutes: 30, trafficMinutes: 32, highMinutes: 36 },
      { lowMin: 1, typicalMin: 2, highMin: 4 },
      7 * 3600,
    );
    expect(plan.feasible).toBe(false);
    expect(plan.leaveBySeconds).toBe(7 * 3600);
  });

  it("iterates future traffic until departure stabilizes", async () => {
    const calls: number[] = [];
    const solved = await solveFutureDrive({
      targetSeconds: 7 * 3600 + 30 * 60,
      nowSeconds: 6 * 3600,
      initial: { lowMinutes: 38, trafficMinutes: 42, highMinutes: 45 },
      access: { lowMin: 1, typicalMin: 2, highMin: 4 },
      fetchAt: async (departure) => {
        calls.push(departure);
        return calls.length === 1
          ? { lowMinutes: 45, trafficMinutes: 48, highMinutes: 51 }
          : { lowMinutes: 43, trafficMinutes: 46, highMinutes: 49 };
      },
    });
    expect(solved.iterations).toBeGreaterThan(1);
    expect(solved.converged).toBe(true);
    expect(solved.candidateSeconds).toBe(6 * 3600 + 37 * 60);
  });

  it("stops at the hard iteration limit and falls back on provider failure", async () => {
    let calls = 0;
    const input = {
      targetSeconds: 9 * 3600,
      nowSeconds: 6 * 3600,
      initial: { lowMinutes: 30, trafficMinutes: 32, highMinutes: 35 },
      access: { lowMin: 1, typicalMin: 2, highMin: 4 },
    };
    const bounded = await solveFutureDrive({
      ...input,
      maxIterations: 2,
      fetchAt: async () => {
        calls += 1;
        return {
          lowMinutes: 30 + calls * 8,
          trafficMinutes: 32 + calls * 8,
          highMinutes: 35 + calls * 8,
        };
      },
    });
    expect(bounded.iterations).toBe(2);
    expect(bounded.converged).toBe(false);
    const failed = await solveFutureDrive({
      ...input,
      fetchAt: async () => {
        throw new Error("provider");
      },
    });
    expect(failed.futureFailed).toBe(true);
    expect(failed.sample).toEqual(input.initial);
  });
});
