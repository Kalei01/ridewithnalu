import { describe, expect, it } from "vitest";
import { compareArriveBy, driveArriveBy, latestRailArrival, DRIVE_BUFFER_MIN } from "./leave-by";

const at = (hours: number, minutes = 0) => hours * 3600 + minutes * 60;

describe("driveArriveBy", () => {
  it("works backwards from the target, including the destination buffer", () => {
    const plan = driveArriveBy(at(7, 30), 30, at(6, 0));
    expect(plan.feasible).toBe(true);
    expect(plan.leaveBySeconds).toBe(at(7, 30) - (30 + DRIVE_BUFFER_MIN) * 60);
    expect(plan.arriveSeconds).toBe(at(7, 30));
  });

  it("flags an impossible target and reports the earliest arrival", () => {
    const plan = driveArriveBy(at(7, 0), 45, at(6, 45));
    expect(plan.feasible).toBe(false);
    expect(plan.leaveBySeconds).toBe(at(6, 45));
    expect(plan.earliestArriveSeconds).toBe(at(6, 45) + (45 + DRIVE_BUFFER_MIN) * 60);
  });
});

describe("latestRailArrival", () => {
  const options = [
    { leave_by_seconds: at(6, 0), arrive_seconds: at(7, 0) },
    { leave_by_seconds: at(6, 20), arrive_seconds: at(7, 20) },
    { leave_by_seconds: at(6, 50), arrive_seconds: at(7, 50) },
  ];

  it("chooses the latest itinerary that still arrives in time", () => {
    const pick = latestRailArrival(options, at(7, 30));
    expect(pick.feasible).toBe(true);
    expect(pick.option?.leave_by_seconds).toBe(at(6, 20));
  });

  it("reports the earliest arrival when nothing makes the target", () => {
    const pick = latestRailArrival(options, at(6, 30));
    expect(pick.feasible).toBe(false);
    expect(pick.option).toBeNull();
    expect(pick.earliestArriveSeconds).toBe(at(7, 0));
  });

  it("handles an empty schedule", () => {
    expect(latestRailArrival([], at(7, 0))).toEqual({
      option: null,
      earliestArriveSeconds: null,
      feasible: false,
    });
  });
});

describe("compareArriveBy", () => {
  it("prefers the mode that lets the rider leave later", () => {
    const result = compareArriveBy({
      railLeaveBySeconds: at(6, 20),
      railArriveSeconds: at(7, 20),
      driveLeaveBySeconds: at(6, 41),
      driveArriveSeconds: at(7, 24),
    });
    expect(result.winner).toBe("drive");
    expect(result.laterMinutes).toBe(21);
  });

  it("calls a close race a wash", () => {
    const result = compareArriveBy({
      railLeaveBySeconds: at(6, 20),
      railArriveSeconds: at(7, 20),
      driveLeaveBySeconds: at(6, 23),
      driveArriveSeconds: at(7, 25),
    });
    expect(result.winner).toBe("same");
  });

  it("falls back to whichever mode exists", () => {
    expect(
      compareArriveBy({
        railLeaveBySeconds: at(6, 0),
        railArriveSeconds: at(7, 0),
        driveLeaveBySeconds: null,
        driveArriveSeconds: null,
      }).winner,
    ).toBe("rail");
    expect(
      compareArriveBy({
        railLeaveBySeconds: null,
        railArriveSeconds: null,
        driveLeaveBySeconds: null,
        driveArriveSeconds: null,
      }).winner,
    ).toBe("none");
  });
});
