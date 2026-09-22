import { describe, expect, it } from "vitest";

import { bypassedCorridors, extractCorridor } from "./corridor";

describe("extractCorridor", () => {
  it("names the major roads in travel order with a freeway direction", () => {
    const corridor = extractCorridor(
      [
        { routeOffsetInMeters: 0, street: "Kualakaʻi Pkwy" },
        { routeOffsetInMeters: 4000, roadNumbers: ["Interstate H-1"] },
        { routeOffsetInMeters: 22000, street: "Nimitz Hwy" },
      ],
      26000,
      { fromLon: -158.02, toLon: -157.86 },
    );
    expect(corridor?.label).toBe("Via Kualakaʻi Pkwy → H-1 East → Nimitz Hwy");
  });

  it("uses a westbound suffix for the return trip", () => {
    const corridor = extractCorridor(
      [
        { routeOffsetInMeters: 0, street: "Ala Moana Blvd" },
        { routeOffsetInMeters: 2000, roadNumbers: ["Interstate H-1"] },
      ],
      20000,
      { fromLon: -157.86, toLon: -158.02 },
    );
    expect(corridor?.roads).toEqual(["Ala Moana Blvd", "H-1 West"]);
  });

  it("drops trivial slip roads", () => {
    const corridor = extractCorridor(
      [
        { routeOffsetInMeters: 0, street: "Driveway" },
        { routeOffsetInMeters: 120, roadNumbers: ["Interstate H-2"] },
      ],
      12000,
    );
    expect(corridor?.roads).toEqual(["H-2"]);
  });

  it("returns null without guidance", () => {
    expect(extractCorridor([], 1000)).toBeNull();
  });
});

describe("bypassedCorridors", () => {
  it("keeps congested roads the route avoids", () => {
    expect(bypassedCorridors(["HI-76", "Interstate H-1", null], ["H-1 East", "Nimitz Hwy"])).toEqual([
      "Fort Weaver Rd",
    ]);
  });

  it("deduplicates and limits", () => {
    expect(bypassedCorridors(["HI-76", "Route 76", "HI-93"], [], 2)).toEqual([
      "Fort Weaver Rd",
      "Farrington Hwy",
    ]);
  });
});
