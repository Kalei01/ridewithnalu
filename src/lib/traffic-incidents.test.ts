import { describe, expect, it } from "vitest";

import { incidentText, isFreewayMainline, localRoadName, mainlineClearNote, trafficDelayText } from "./traffic-incidents";

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
    ["Interstate H-1", "H-1"],
    ["Interstate Highway H1 E", "H-1 East"],
    ["Interstate Highway H1 W", "H-1 West"],
    ["Interstate H-2", "H-2"],
    ["Interstate H-3", "H-3"],
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

  it("says a road-less alert is on a connecting road, not the freeway", () => {
    expect(incidentText({ description: "Closed", road: null, delayMinutes: null })).toBe(
      "Reported closure on a connecting road on your route",
    );
  });

  it("adds the route delay in one compact line", () => {
    expect(trafficDelayText({ description: "Queuing traffic", road: "N Nimitz Highway", delayMinutes: 7 }))
      .toBe("Queuing traffic on Nimitz Hwy · +7 min");
  });
});
describe("incident place context", () => {
  it("treats the freeway mainline as the mainline", () => {
    expect(isFreewayMainline("Interstate Highway H1 E")).toBe(true);
    expect(isFreewayMainline("HI-92")).toBe(false);
    expect(isFreewayMainline(null)).toBe(false);
  });

  it("names a ramp explicitly", () => {
    expect(incidentText({ description: "Closed", road: "H-1 East Off-Ramp", delayMinutes: null })).toBe(
      "Reported closure on the H-1 East Off-Ramp",
    );
  });

  it("clarifies a connecting-road alert while the mainline runs clear", () => {
    expect(mainlineClearNote({ description: "Closed", road: "HI-92", delayMinutes: 4 }, 0)).toBe(
      "H-1 mainline is clear; this alert is on Nimitz Hwy, a connecting road.",
    );
  });

  it("clarifies an unnamed connecting-road alert", () => {
    expect(mainlineClearNote({ description: "Closed", road: null, delayMinutes: null }, 2)).toBe(
      "H-1 mainline is clear; this alert is on a connecting road, not the freeway.",
    );
  });

  it("stays silent on the mainline or when the freeway is slow", () => {
    expect(mainlineClearNote({ description: "Jam", road: "Interstate H-1", delayMinutes: 6 }, 0)).toBeNull();
    expect(mainlineClearNote({ description: "Closed", road: "HI-92", delayMinutes: 12 }, 14)).toBeNull();
    expect(mainlineClearNote(undefined, 0)).toBeNull();
  });
});
