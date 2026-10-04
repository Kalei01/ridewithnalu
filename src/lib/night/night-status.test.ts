import { describe, expect, it } from "vitest";
import { isNightTime, nightStatus, rideshareLinks } from "./night-status";

const h = (hour: number, minute = 0) => hour * 3600 + minute * 60;
const trip = (leave: number, ride = 30 * 60) => ({ leave_by_seconds: leave, depart_seconds: leave + 300, arrive_seconds: leave + ride });

describe("night mode", () => {
  it("is quiet during the day", () => {
    expect(isNightTime(h(14))).toBe(false);
    expect(nightStatus(h(14), [trip(h(14, 10))], true).kind).toBe("day");
  });

  it("flags the last trip tonight when the next one is in the morning", () => {
    const status = nightStatus(h(23), [trip(h(23, 20)), trip(h(28, 50))], true);
    expect(status).toMatchObject({ kind: "last", leaveBy: h(23, 20) });
  });

  it("does not call it the last one when another leaves soon after", () => {
    expect(nightStatus(h(22), [trip(h(22, 10)), trip(h(22, 40))], true).kind).toBe("day");
  });

  it("says nothing runs tonight when the first trip is hours away", () => {
    const status = nightStatus(h(1, 30), [trip(h(3, 26))], true);
    expect(status).toMatchObject({ kind: "none_tonight" });
    expect(status.kind === "none_tonight" && status.first?.leave_by_seconds).toBe(h(3, 26));
  });

  it("says nothing runs tonight when the planner found no trip at all", () => {
    expect(nightStatus(h(2), [], true)).toEqual({ kind: "none_tonight", first: null });
  });

  it("stays quiet when the planner hasn't answered (still loading or failed)", () => {
    expect(nightStatus(h(2), [], false).kind).toBe("day");
  });

  it("builds rideshare links with the trip's own destination", () => {
    const links = rideshareLinks({ lat: 21.3098, lon: -157.8628, name: "55 Merchant Street" });
    expect(links.uber).toContain("dropoff%5Blatitude%5D=21.309800");
    expect(links.uber).toContain("pickup=my_location");
    expect(links.lyft).toContain("destination%5Blongitude%5D=-157.862800");
  });
});
