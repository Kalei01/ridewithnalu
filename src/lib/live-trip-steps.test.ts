import { describe, expect, it } from "vitest";
import type { Leg } from "./commute-model";
import { currentLegIndex, liveTripSteps } from "./live-trip-steps";

const leg = (over: Partial<Leg>): Leg => ({
  kind: "access",
  mode: "walk",
  route_short: null,
  route_long: null,
  headsign: null,
  from: null,
  to: null,
  depart_seconds: null,
  arrive_seconds: null,
  minutes: null,
  ...over,
});

const legs: Leg[] = [
  leg({ mode: "walk", to: "LELEPAUA", depart_seconds: 16 * 3600 + 45 * 60, arrive_seconds: 16 * 3600 + 55 * 60 }),
  leg({
    kind: "rail",
    mode: "bus",
    route_short: "W LINE",
    from: "LELEPAUA",
    to: "KUALAKA'I",
    depart_seconds: 17 * 3600,
    arrive_seconds: 17 * 3600 + 20 * 60,
  }),
];

describe("liveTripSteps", () => {
  it("names the walk and the board time from the real legs", () => {
    const steps = liveTripSteps(legs);
    expect(steps[0]).toBe("Walk to Lelepaua · board W Line 5:00 PM");
    expect(steps[1]).toBe("Ride W Line to Kualakaʻi · arrive 5:20 PM");
  });
});

describe("currentLegIndex", () => {
  it("picks the first leg that has not finished", () => {
    expect(currentLegIndex(legs, 16 * 3600 + 50 * 60)).toBe(0);
    expect(currentLegIndex(legs, 17 * 3600 + 5 * 60)).toBe(1);
    expect(currentLegIndex(legs, 18 * 3600)).toBe(1);
  });
});
