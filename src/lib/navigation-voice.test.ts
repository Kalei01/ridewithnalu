import { describe, expect, it } from "vitest";
import {
  announcementFor,
  isUsableNavigationFix,
  matchRoutePoint,
  nextManeuver,
  routeDeviation,
  smoothBearing,
  trimRoutePath,
  turnGlyph,
  type Maneuver,
} from "./navigation-voice";
import { arrivalRange, destinationAccess } from "./destination-access";

const turn: Maneuver = {
  lat: 21.3,
  lon: -157.86,
  maneuver: "TURN_LEFT",
  instruction: "Turn left onto Bishop St",
  road: "Bishop St",
};

describe("turn-by-turn voice", () => {
  it("speaks far then near once each, across refreshes", () => {
    const spoken = new Set<string>();
    expect(announcementFor({ maneuver: turn, distanceM: 700 }, spoken)).toMatch(/half a mile/);
    expect(announcementFor({ maneuver: { ...turn }, distanceM: 650 }, spoken)).toBeNull();
    expect(announcementFor({ maneuver: turn, distanceM: 80 }, spoken)).toMatch(
      /300 feet, turn left/,
    );
    expect(announcementFor({ maneuver: turn, distanceM: 60 }, spoken)).toBeNull();
  });
  it("skips passed maneuvers", () => {
    const passed = new Set<string>();
    const next = nextManeuver(
      { lat: 21.3, lon: -157.86 },
      [turn, { ...turn, lat: 21.31, maneuver: "ARRIVE" }],
      passed,
    );
    expect(next?.maneuver.maneuver).toBe("ARRIVE");
  });
  it("maps glyphs", () => {
    expect(turnGlyph("TURN_RIGHT")).toBe("right");
    expect(turnGlyph("MOTORWAY_EXIT_LEFT")).toBe("slight-left");
  });
  it("holds bearing while stopped", () => {
    expect(
      smoothBearing(90, {
        gpsHeading: 270,
        speedMps: 0,
        from: { lat: 21.3, lon: -157.86 },
        to: { lat: 21.3, lon: -157.86 },
      }),
    ).toBe(90);
  });
  it("snaps a noisy fix to the forward route without jumping to an opposing segment", () => {
    const path = [
      { lat: 21.3, lon: -157.9 },
      { lat: 21.3, lon: -157.89 },
      { lat: 21.3002, lon: -157.89 },
      { lat: 21.3002, lon: -157.9 },
    ];
    const match = matchRoutePoint({ lat: 21.30015, lon: -157.895 }, path, 0, 90);
    expect(match?.segmentIndex).toBe(0);
    expect(match?.point.lat).toBeCloseTo(21.3, 5);
  });
  it("rejects inaccurate fixes and impossible jumps", () => {
    const previous = { point: { lat: 21.3, lon: -157.9 }, timestamp: 1_000 };
    expect(
      isUsableNavigationFix(previous, {
        point: { lat: 21.3, lon: -157.8999 },
        timestamp: 2_000,
        accuracy: 80,
      }),
    ).toBe(false);
    expect(
      isUsableNavigationFix(previous, {
        point: { lat: 21.4, lon: -157.8 },
        timestamp: 2_000,
        accuracy: 5,
      }),
    ).toBe(false);
    expect(
      isUsableNavigationFix(previous, {
        point: { lat: 21.3001, lon: -157.9 },
        timestamp: 2_000,
        accuracy: 8,
      }),
    ).toBe(true);
  });
  it("flags distance immediately and heading divergence after two fixes", () => {
    const match = {
      point: { lat: 21.3, lon: -157.9 },
      segmentIndex: 1,
      distanceM: 20,
      bearing: 90,
    };
    const first = routeDeviation(match, 170, 0);
    expect(first.offRoute).toBe(false);
    expect(first.divergentFixes).toBe(1);
    expect(routeDeviation(match, 170, first.divergentFixes).offRoute).toBe(true);
    expect(routeDeviation({ ...match, distanceM: 46 }, 90, 0).offRoute).toBe(true);
  });
  it("trims the traveled route behind the matched vehicle point", () => {
    const path = [
      { lat: 21.3, lon: -158 },
      { lat: 21.31, lon: -157.99 },
      { lat: 21.32, lon: -157.98 },
      { lat: 21.33, lon: -157.97 },
    ];
    const match = {
      point: { lat: 21.315, lon: -157.985 },
      segmentIndex: 1,
      distanceM: 5,
      bearing: 45,
    };
    expect(trimRoutePath(path, match)).toEqual([match.point, path[2], path[3]]);
  });
  it("replays a work-to-home deviation and keeps only the forward route", () => {
    const workToHome = [
      { lat: 21.307, lon: -157.86 },
      { lat: 21.32, lon: -157.9 },
      { lat: 21.35, lon: -157.95 },
      { lat: 21.39, lon: -158.0 },
    ];
    const onRoute = matchRoutePoint({ lat: 21.335, lon: -157.925 }, workToHome, 0, 300);
    expect(routeDeviation(onRoute, 300).offRoute).toBe(false);
    expect(trimRoutePath(workToHome, onRoute)[0]).toEqual(onRoute?.point);

    const deviated = matchRoutePoint({ lat: 21.337, lon: -157.924 }, workToHome, 1, 300);
    expect(routeDeviation(deviated, 300).offRoute).toBe(true);
  });
});

describe("destination access", () => {
  it("gives downtown a larger buffer than home", () => {
    expect(destinationAccess({ lat: 21.309, lon: -157.862 }).zone).toBe("downtown");
    expect(destinationAccess({ lat: 21.35, lon: -158.0 }, "home").typicalMin).toBe(1);
  });
  it("builds a door-to-door window", () => {
    const access = destinationAccess({ lat: 21.309, lon: -157.862 });
    const range = arrivalRange(0, { low: 30, expected: 33, high: 38 }, access);
    expect(range.earliestSeconds).toBe((30 + 7) * 60);
    expect(range.latestSeconds).toBe((38 + 14) * 60);
  });
});
