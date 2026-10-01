import { describe, expect, it } from "vitest";

import {
  incidentAffectsTrip,
  incidentImpactText,
  incidentText,
  isFreewayMainline,
  localRoadName,
  mainlineClearNote,
  trafficDelayText,
  standaloneIncidentCause,
  standaloneIncidentCondition,
  standaloneIncidentImpact,
  standaloneIncidentLocation,
} from "./traffic-incidents";

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

  it("does not invent a road type when the provider omits the road name", () => {
    expect(incidentText({ description: "Closed", road: null, delayMinutes: null })).toBe(
      "Reported closure near your calculated route",
    );
  });

  it("adds the route delay in one compact line", () => {
    expect(trafficDelayText({ description: "Queuing traffic", road: "N Nimitz Highway", delayMinutes: 7 }))
      .toBe("Queuing traffic on Nimitz Hwy · +7 min");
  });

  it("states whether a correlated incident affects this trip", () => {
    expect(incidentImpactText({ description: "Closed", road: "HI-92", delayMinutes: 6 }))
      .toBe("Expected to add about 6 min to this trip.");
    expect(incidentImpactText({ description: "Closed", road: null, delayMinutes: null }))
      .toBe("Your drive time is not slower right now.");
    expect(incidentImpactText({ description: "Closed", road: "HI-92", delayMinutes: 0 }))
      .toBe("Lanes are blocked on Nimitz Hwy, but your drive time is not slower yet. Expect possible backups.");
  });

  it("only surfaces alerts that add time or block an identified road", () => {
    expect(incidentAffectsTrip({ description: "Closed", road: "HI-92", delayMinutes: 0 })).toBe(true);
    expect(incidentAffectsTrip({ description: "Jam", road: "HI-92", delayMinutes: 4 })).toBe(true);
    expect(incidentAffectsTrip({ description: "Jam", road: "HI-92", delayMinutes: 0 })).toBe(false);
    expect(incidentAffectsTrip({ description: "Closed", road: null, delayMinutes: null })).toBe(false);
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
      "H-1 mainline is clear; TomTom did not identify the nearby road.",
    );
  });

  it("stays silent on the mainline or when the freeway is slow", () => {
    expect(mainlineClearNote({ description: "Jam", road: "Interstate H-1", delayMinutes: 6 }, 0)).toBeNull();
    expect(mainlineClearNote({ description: "Closed", road: "HI-92", delayMinutes: 12 }, 14)).toBeNull();
    expect(mainlineClearNote(undefined, 0)).toBeNull();
  });
});

describe("local road names across feed formats", () => {
  it.each([
    ["HI-78", "Moanalua Fwy"],
    ["HI-78 W", "Moanalua Fwy West"],
    ["HI-78 West", "Moanalua Fwy West"],
    ["Route 78 E", "Moanalua Fwy East"],
    ["H-201", "Moanalua Fwy"],
    ["H201", "Moanalua Fwy"],
    ["H201 E", "Moanalua Fwy East"],
    ["Interstate Hwy H201 E", "Moanalua Fwy East"],
    ["Interstate Highway H201 Westbound", "Moanalua Fwy West"],
    ["State Rte 78 W", "Moanalua Fwy West"],
    ["Route 92 E", "Nimitz Hwy East"],
    ["HI-92 W", "Nimitz Hwy West"],
    ["State Hwy 61 N", "Pali Hwy"],
    ["HI-63 S", "Likelike Hwy"],
    ["Route 72 E", "Kalanianaʻole Hwy"],
    ["HI-99 N", "Kamehameha Hwy"],
    ["Route 83", "Kamehameha Hwy"],
    ["HI-93 W", "Farrington Hwy"],
    ["HI-76 S", "Fort Weaver Rd"],
    ["HI-750 N", "Kunia Rd"],
    ["Route 750", "Kunia Rd"],
    ["Interstate Hwy H1 E", "H-1 East"],
    ["H1 W", "H-1 West"],
    ["Interstate Hwy H2 N", "H-2 North"],
    ["H2 S", "H-2 South"],
    ["Interstate Hwy H3 E", "H-3 East"],
    ["H3 Westbound", "H-3 West"],
  ])("normalizes %s to %s", (road, expected) => {
    expect(localRoadName(road)).toBe(expected);
  });

  it("reads naturally inside a traffic alert", () => {
    expect(trafficDelayText({ description: "Stationary traffic", road: "Interstate Hwy H201 W", delayMinutes: 3 }))
      .toBe("Stationary traffic on Moanalua Fwy West · +3 min");
  });

  it("leaves ordinary street names alone", () => {
    expect(localRoadName("Kualakaʻi Pkwy")).toBe("Kualakaʻi Pkwy");
    expect(localRoadName("Kamehameha Highway")).toBe("Kamehameha Hwy");
  });
});


describe("standalone traffic alerts", () => {
  it("uses the structured condition instead of generic traffic wording", () => {
    expect(standaloneIncidentCondition({
      description: "Closed",
      road: "Nimitz Hwy",
      category: "8",
      delayMinutes: 0,
    })).toBe("Road closure");
  });

  it("does not invent a closure cause", () => {
    expect(standaloneIncidentCause({
      description: "Closed",
      road: "Nimitz Hwy",
      delayMinutes: 0,
    })).toBe("Cause not reported");
  });

  it("shows the provider-reported cause when one exists", () => {
    expect(standaloneIncidentCause({
      description: "Accident",
      road: "Nimitz Hwy",
      delayMinutes: 0,
    })).toBe("Accident");
  });

  it("uses the affected stretch without implying a selected trip", () => {
    expect(standaloneIncidentLocation({
      description: "Closed",
      road: "Nimitz Hwy",
      from: "Puʻuhale Road",
      to: "Libby Street",
      delayMinutes: 0,
    })).toBe("Puʻuhale Road → Libby Street");
  });

  it("does not say 'your drive time' in a general road alert", () => {
    expect(standaloneIncidentImpact({
      description: "Closed",
      road: "Nimitz Hwy",
      delayMinutes: 0,
    }, 0)).toBe("No slowdown is showing on the H-1 mainline yet. Possible backups on the connecting road.");
  });
});
