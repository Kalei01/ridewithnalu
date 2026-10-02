import { describe, expect, it } from "vitest";
import { isRailGeographicallyRelevant } from "./pulse-geography";

describe("isRailGeographicallyRelevant", () => {
  it("allows rail when both trip ends are within the practical station radius", () => {
    expect(
      isRailGeographicallyRelevant({ distanceMiles: 2.1 }, { distanceMiles: 3.4 }),
    ).toBe(true);
  });

  it("rejects rail when the origin is too far from Skyline", () => {
    expect(
      isRailGeographicallyRelevant({ distanceMiles: 7.2 }, { distanceMiles: 1.5 }),
    ).toBe(false);
  });

  it("rejects rail when the destination is too far from Skyline", () => {
    expect(
      isRailGeographicallyRelevant({ distanceMiles: 1.2 }, { distanceMiles: 6.1 }),
    ).toBe(false);
  });

  it("rejects missing or invalid station proximity", () => {
    expect(isRailGeographicallyRelevant(null, { distanceMiles: 2 })).toBe(false);
    expect(
      isRailGeographicallyRelevant({ distanceMiles: null }, { distanceMiles: 2 }),
    ).toBe(false);
    expect(
      isRailGeographicallyRelevant({ distanceMiles: Number.NaN }, { distanceMiles: 2 }),
    ).toBe(false);
  });
});
