import { describe, expect, it } from "vitest";
import { compareCommute } from "./commute-decision";

describe("compareCommute", () => {
  it("keeps drive reasoning free of transit transfer details", () => {
    expect(
      compareCommute({
        railMinutes: 65,
        driveMinutes: 42,
        driveAvailable: true,
        railWaitMinutes: 4,
      }).explanation,
    ).toBe("Driving is about 23 min faster than rail and bus");
  });

  it("uses incidents only to explain a rail recommendation", () => {
    expect(
      compareCommute({
        railMinutes: 45,
        driveMinutes: 62,
        driveAvailable: true,
        hasMajorIncident: true,
      }).explanation,
    ).toBe("Rail avoids a reported traffic incident");
  });

  it("does not compare an unavailable car", () => {
    expect(
      compareCommute({ railMinutes: 50, driveMinutes: 30, driveAvailable: false }).recommendation,
    ).toBe("rail");
  });

  it("names driving as the comparison baseline for a rail win", () => {
    expect(
      compareCommute({ railMinutes: 41, driveMinutes: 55, driveAvailable: true }).explanation,
    ).toBe("Rail and bus are about 14 min faster than driving");
  });

  it("distinguishes a traffic lookup failure from an unavailable car", () => {
    expect(
      compareCommute({ railMinutes: 50, driveMinutes: null, driveAvailable: true }).explanation,
    ).toBe("A current drive time could not be calculated");
  });
});
