import { describe, expect, it } from "vitest";

import { incidentText, localRoadName, trafficDelayText } from "./traffic-incidents";

describe("localRoadName", () => {
  it.each([
    ["HI-92", "Nimitz Hwy"],
    ["Route 92", "Nimitz Hwy"],
    ["Hwy 92", "Nimitz Hwy"],
    ["HI-78", "Moanalua Fwy"],
    ["Route 78", "Moanalua Fwy"],
    ["H-201", "Moanalua Fwy"],
    ["HI-61", "Pali Hwy"],
    ["Route 63", "Likelike Hwy"],
    ["HI-72", "Kalanianaʻole Hwy"],
    ["Route 83", "Kamehameha Hwy"],
    ["HI-99", "Kamehameha Hwy"],
    ["Route 750", "Kunia Rd"],
    ["HI-76", "Fort Weaver Rd"],
    ["Route 93", "Farrington Hwy"],
    ["Interstate H-1", "H-1 East"],
    ["Interstate Highway H1 E", "H-1 East"],
    ["Interstate Highway H1 W", "H-1 West"],
    ["Interstate H-2", "H-2 North"],
    ["Interstate H-3", "H-3 East"],
    ["N Nimitz Highway", "Nimitz Hwy"],
  ])("maps %s to %s", (road, expected) => {
    expect(localRoadName(road)).toBe(expected);
  });

  it("keeps an unknown road's formatted name", () => {
    expect(localRoadName("  Ala Moana Blvd  ")).toBe("Ala Moana Blvd");
  });
});

describe("incidentText", () => {
  it.each([
    ["Closed", "HI-92", "Reported closure on Nimitz Hwy"],
    ["Accident", "Route 61", "Reported accident on Pali Hwy"],
    ["Roadworks", "HI-63", "Roadwork on Likelike Hwy"],
    ["Jam", "HI-72", "Heavy traffic on Kalanianaʻole Hwy"],
    ["Slow traffic", "HI-83", "Heavy traffic on Kamehameha Hwy"],
    ["Queuing traffic", "HI-76", "Queuing traffic on Fort Weaver Rd"],
  ])("formats %s on %s", (description, road, expected) => {
    expect(incidentText({ description, road, delayMinutes: null })).toBe(expected);
  });

  it("uses route context when TomTom omits the road", () => {
    expect(incidentText({ description: "Closed", road: null, delayMinutes: null })).toBe(
      "Reported closure on your route",
    );
  });

  it("adds the route delay in one compact line", () => {
    expect(trafficDelayText({ description: "Queuing traffic", road: "N Nimitz Highway", delayMinutes: 7 }))
      .toBe("Queuing traffic on Nimitz Hwy · +7 min");
  });
});