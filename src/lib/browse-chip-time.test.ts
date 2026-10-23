import { describe, expect, it } from "vitest";
import {
  chipDriveTime,
  knownFromCorridors,
  knownFromDriveCache,
  type KnownDrive,
} from "./browse-chip-time";

const HOME = { id: "home", lat: 21.3358, lon: -158.0798 };
const WORK = { id: "work", lat: 21.3099, lon: -157.8644 };
const SCHOOL = { id: "school", lat: 21.4, lon: -157.8 };
const lookup = new Set(["home", "work"]);
const RIDER_AT_HOME = { lat: 21.3359, lon: -158.0797 };
const RIDER_MID = { lat: 21.3822, lon: -158.0092 };

describe("chipDriveTime", () => {
  it("hides until the rider's position is known", () => {
    expect(chipDriveTime({ rider: null, place: WORK, lookupIds: lookup, known: [] })).toEqual({
      status: "hidden",
    });
  });
  it("hides when the rider is basically at the place (< 300 m)", () => {
    const known: KnownDrive[] = [{ from: HOME, to: WORK, minutes: 40 }];
    expect(chipDriveTime({ rider: RIDER_AT_HOME, place: HOME, lookupIds: lookup, known })).toEqual({
      status: "hidden",
    });
  });
  it("reuses a known trip from the rider to the place with no lookup", () => {
    const known: KnownDrive[] = [{ from: HOME, to: WORK, minutes: 41 }];
    expect(chipDriveTime({ rider: RIDER_AT_HOME, place: WORK, lookupIds: lookup, known })).toEqual({
      status: "known",
      minutes: 41,
    });
  });
  it("does not reuse a trip that starts somewhere else", () => {
    const known: KnownDrive[] = [{ from: HOME, to: WORK, minutes: 41 }];
    expect(chipDriveTime({ rider: RIDER_MID, place: WORK, lookupIds: lookup, known })).toEqual({
      status: "fetch",
    });
  });
  it("asks for a lookup only for Home or Work", () => {
    expect(chipDriveTime({ rider: RIDER_MID, place: HOME, lookupIds: lookup, known: [] })).toEqual({
      status: "fetch",
    });
    expect(
      chipDriveTime({ rider: RIDER_MID, place: SCHOOL, lookupIds: lookup, known: [] }),
    ).toEqual({ status: "hidden" });
  });
  it("still reuses a held time for another saved place", () => {
    const known: KnownDrive[] = [{ from: RIDER_MID, to: SCHOOL, minutes: 25 }];
    expect(chipDriveTime({ rider: RIDER_MID, place: SCHOOL, lookupIds: lookup, known })).toEqual({
      status: "known",
      minutes: 25,
    });
  });
  it("ignores zero or invalid minutes", () => {
    const known: KnownDrive[] = [{ from: RIDER_MID, to: SCHOOL, minutes: 0 }];
    expect(chipDriveTime({ rider: RIDER_MID, place: SCHOOL, lookupIds: lookup, known })).toEqual({
      status: "hidden",
    });
  });
});

describe("sources of known drive times", () => {
  it("reads both ways of the corridor checks", () => {
    const known = knownFromCorridors(
      [{ a: HOME, b: WORK }],
      [{ forward: { trafficMinutes: 41 }, back: { trafficMinutes: 38 } }],
    );
    expect(known).toEqual([
      { from: HOME, to: WORK, minutes: 41 },
      { from: WORK, to: HOME, minutes: 38 },
    ]);
    expect(knownFromCorridors(null, [])).toEqual([]);
  });
  it("reads the main screen's drive cache keys", () => {
    const known = knownFromDriveCache([
      [["drive", 1, 2, 3, 4], { trafficMinutes: 12 }],
      [["drive", null, 2, 3, 4], { trafficMinutes: 12 }],
      [["drive", 1, 2, 3, 4], undefined],
    ]);
    expect(known).toEqual([{ from: { lat: 1, lon: 2 }, to: { lat: 3, lon: 4 }, minutes: 12 }]);
  });
});
