import { describe, expect, it } from "vitest";

import { bypassedCorridors, extractCorridor, stepRoadName } from "./corridor";

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

  it("prefers the direction stated in the guidance over the trip geometry", () => {
    const corridor = extractCorridor(
      [
        { routeOffsetInMeters: 0, street: "Fort Weaver Rd" },
        { routeOffsetInMeters: 3000, roadNumbers: ["Interstate H-1 W"], street: "Ramp" },
      ],
      20000,
      // Geometry alone would say East; the feed says westbound.
      { fromLon: -158.02, toLon: -157.86 },
    );
    expect(corridor?.roads).toEqual(["Fort Weaver Rd", "H-1 West"]);
  });

  it("uses the named freeway instead of a different highway shown on its destination sign", () => {
    const corridor = extractCorridor(
      [
        { routeOffsetInMeters: 0, street: "Fort Weaver Rd", roadNumbers: ["HI-76"] },
        {
          routeOffsetInMeters: 5000,
          street: "Interstate Highway H1 E",
          roadNumbers: ["H1 E", "H3 E", "HI-78 E"],
        },
        { routeOffsetInMeters: 27000, street: "N Nimitz Hwy", roadNumbers: ["HI-92"] },
      ],
      33000,
      { fromLon: -158.02, toLon: -157.86 },
    );
    expect(corridor?.label).toBe("Via Fort Weaver Rd → H-1 East → Nimitz Hwy");
  });

  it("keeps actual major highways and drops a brief signposted freeway", () => {
    const corridor = extractCorridor(
      [
        { routeOffsetInMeters: 0, street: "Renton Rd" },
        { routeOffsetInMeters: 2600, street: "Interstate Highway H1 E", roadNumbers: ["H1 E"] },
        { routeOffsetInMeters: 22000, street: "H-3 East", roadNumbers: ["H3 E"] },
        { routeOffsetInMeters: 22500, street: "Moanalua Fwy East", roadNumbers: ["HI-78 E"] },
        { routeOffsetInMeters: 26000, street: "Nimitz Hwy", roadNumbers: ["HI-92"], exitNumber: "18B" },
      ],
      28000,
      { fromLon: -158.02, toLon: -157.86 },
    );
    expect(corridor?.label).toBe(
      "Via Renton Rd → H-1 East → Moanalua Fwy East → Nimitz Hwy",
    );
  });

  it("includes Moanalua Freeway and the final cutoff on a town-bound route", () => {
    const corridor = extractCorridor(
      [
        { routeOffsetInMeters: 0, street: "Fort Weaver Rd", roadNumbers: ["HI-76"] },
        { routeOffsetInMeters: 5000, street: "Interstate Highway H1 E", roadNumbers: ["H1 E"] },
        { routeOffsetInMeters: 23000, street: "Moanalua Fwy E", roadNumbers: ["HI-78 E"] },
        { routeOffsetInMeters: 29000, street: "Nimitz Hwy", roadNumbers: ["HI-92"], exitNumber: "18B" },
      ],
      34000,
      { fromLon: -158.02, toLon: -157.86 },
    );
    expect(corridor?.label).toBe(
      "Via Fort Weaver Rd → H-1 East → Moanalua Fwy East → Nimitz Hwy",
    );
  });

  it("replaces TomTom's exit ID with the familiar road named immediately after it", () => {
    const corridor = extractCorridor(
      [
        { routeOffsetInMeters: 0, street: "Interstate Highway H1 W", roadNumbers: ["H1 W"] },
        { routeOffsetInMeters: 21000, street: "Exit 5", exitNumber: "5" },
        { routeOffsetInMeters: 21400, street: "Fort Weaver Rd", roadNumbers: ["HI-76"] },
        { routeOffsetInMeters: 29000, street: "Farrington Hwy", roadNumbers: ["HI-93"] },
      ],
      31000,
      { fromLon: -157.86, toLon: -158.02 },
    );
    expect(corridor?.label).toBe("Via H-1 West → Farrington Hwy");
    expect(corridor?.allRoads).not.toContain("Exit 5");
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

  it("never claims to skip a road the route travels on", () => {
    expect(
      bypassedCorridors(["HI-76"], ["Renton Rd", "Fort Weaver Road", "H-1 East"]),
    ).toEqual([]);
  });

  it("deduplicates and limits", () => {
    expect(bypassedCorridors(["HI-76", "Route 76", "HI-93"], [], 2)).toEqual([
      "Fort Weaver Rd",
      "Farrington Hwy",
    ]);
  });
});

describe("stepRoadName", () => {
  it("trusts the route code over a mislabelled street name", () => {
    expect(stepRoadName({ street: "Kunia Rd", roadNumbers: ["HI-76", "HI-750"] })).toBe(
      "Fort Weaver Rd",
    );
  });

  it("keeps the freeway number when on a freeway", () => {
    expect(stepRoadName({ street: "Ramp", roadNumbers: ["Interstate H-1"] })).toBe("H-1");
  });

  it("uses the street name when the step has no known code", () => {
    expect(stepRoadName({ street: "Renton Rd" })).toBe("Renton Rd");
  });

  it("never turns a bare number into a freeway", () => {
    expect(stepRoadName({ street: "Exit 3", roadNumbers: ["3"] })).toBe("Exit 3");
  });
});

describe("real Ewa Beach guidance", () => {
  it("names the westbound exit as Fort Weaver Rd, not Kunia Rd", () => {
    const corridor = extractCorridor(
      [
        { routeOffsetInMeters: 373, roadNumbers: ["HI-92"], street: "S Nimitz Hwy" },
        {
          routeOffsetInMeters: 5776,
          roadNumbers: ["H1 W"],
          street: "Interstate Highway H1 W",
        },
        { routeOffsetInMeters: 25849, roadNumbers: ["HI-750"], street: "Kunia Rd" },
        { routeOffsetInMeters: 26769, roadNumbers: ["HI-76", "HI-750"], street: "Kunia Rd" },
        { routeOffsetInMeters: 35419, street: "North Rd" },
      ],
      35898,
      { fromLon: -157.86, toLon: -158.0 },
    );
    expect(corridor?.roads).toEqual(["Nimitz Hwy", "H-1 West", "Fort Weaver Rd"]);
  });

  it("names the outbound trip without inventing H-3", () => {
    const corridor = extractCorridor(
      [
        { routeOffsetInMeters: 0, street: "North Rd" },
        { routeOffsetInMeters: 479, street: "Fort Weaver Rd" },
        {
          routeOffsetInMeters: 8883,
          roadNumbers: ["H1 E"],
          street: "Interstate Highway H1 E",
        },
        { routeOffsetInMeters: 29034, roadNumbers: ["HI-92"], street: "N Nimitz Hwy" },
      ],
      34345,
      { fromLon: -158.0, toLon: -157.86 },
    );
    expect(corridor?.roads).toEqual(["Fort Weaver Rd", "H-1 East", "Nimitz Hwy"]);
  });
});
