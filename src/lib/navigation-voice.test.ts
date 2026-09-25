import { describe, expect, it } from "vitest";
import { announcementFor, nextManeuver, smoothBearing, turnGlyph, type Maneuver } from "./navigation-voice";
import { arrivalRange, destinationAccess } from "./destination-access";

const turn: Maneuver = { lat: 21.3, lon: -157.86, maneuver: "TURN_LEFT", instruction: "Turn left onto Bishop St", road: "Bishop St" };

describe("turn-by-turn voice", () => {
  it("speaks far then near once each, across refreshes", () => {
    const spoken = new Set<string>();
    expect(announcementFor({ maneuver: turn, distanceM: 700 }, spoken)).toMatch(/half a mile/);
    expect(announcementFor({ maneuver: { ...turn }, distanceM: 650 }, spoken)).toBeNull();
    expect(announcementFor({ maneuver: turn, distanceM: 80 }, spoken)).toMatch(/300 feet, turn left/);
    expect(announcementFor({ maneuver: turn, distanceM: 60 }, spoken)).toBeNull();
  });
  it("skips passed maneuvers", () => {
    const passed = new Set<string>();
    const next = nextManeuver({ lat: 21.3, lon: -157.86 }, [turn, { ...turn, lat: 21.31, maneuver: "ARRIVE" }], passed);
    expect(next?.maneuver.maneuver).toBe("ARRIVE");
  });
  it("maps glyphs", () => {
    expect(turnGlyph("TURN_RIGHT")).toBe("right");
    expect(turnGlyph("MOTORWAY_EXIT_LEFT")).toBe("slight-left");
  });
  it("holds bearing while stopped", () => {
    expect(smoothBearing(90, { gpsHeading: 270, speedMps: 0, from: { lat: 21.3, lon: -157.86 }, to: { lat: 21.3, lon: -157.86 } })).toBe(90);
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
