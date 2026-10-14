import { describe, expect, it } from "vitest";
import { raceProgress, raceSegments, raceSpan } from "./race-timeline";
import type { HomeRaceEntrant, HomeRaceLeg } from "./home-types";

const leg = (
  mode: HomeRaceLeg["mode"],
  depart: number | null,
  arrive: number | null,
): HomeRaceLeg => ({
  mode,
  route: null,
  headsign: null,
  from: { stopId: null, lat: null, lon: null },
  to: { stopId: null, lat: null, lon: null },
  departSeconds: depart,
  arriveSeconds: arrive,
});

const skyline: HomeRaceEntrant = {
  kind: "skyline",
  steps: "Walk → Bus 46 → Skyline → Bus C",
  startSeconds: 1000,
  finishSeconds: 4000,
  legs: [
    leg("walk", 700, 1000),
    leg("bus", 1000, 1600),
    leg("walk", 1600, 1660),
    leg("rail", 1800, 3000),
    leg("bus", 3100, 4000),
    leg("walk", 4000, 4200),
  ],
};

describe("race timeline", () => {
  it("times only buses, trains and drives; walks are hops", () => {
    expect(raceSegments(skyline).map((s) => s.legIndex)).toEqual([1, 3, 4]);
  });
  it("waits at the first stop until the bus leaves", () => {
    expect(raceProgress(raceSegments(skyline), 500)).toEqual({
      segment: 0,
      fraction: 0,
      finished: false,
    });
  });
  it("moves along a leg by its scheduled times", () => {
    expect(raceProgress(raceSegments(skyline), 2400)).toEqual({
      segment: 1,
      fraction: 0.5,
      finished: false,
    });
  });
  it("waits at the transfer until the next departure", () => {
    expect(raceProgress(raceSegments(skyline), 3050)).toEqual({
      segment: 1,
      fraction: 1,
      finished: false,
    });
  });
  it("finishes when the last bus reaches its stop", () => {
    expect(raceProgress(raceSegments(skyline), 4000).finished).toBe(true);
  });
  it("drives door to door from now", () => {
    const car: HomeRaceEntrant = {
      kind: "drive",
      steps: "H-1 East",
      startSeconds: 900,
      finishSeconds: 3720,
      legs: [],
    };
    expect(raceProgress(raceSegments(car), 2310).fraction).toBeCloseTo(0.5);
    expect(raceSpan([car, skyline], 900)).toEqual({ start: 900, end: 4000 });
  });
});
