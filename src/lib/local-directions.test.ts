import { describe, expect, it } from "vitest";
import {
  dropContradictingDirection,
  hudRoadLabel,
  landmarkTowardFor,
  localizeInstruction,
  localizeRoadLabel,
  routeBearingAfter,
  tidyFreewayName,
} from "./local-directions";
import { buildManeuvers } from "./drive.functions";
import { speakableRoad } from "./navigation-voice";

const EAST = 95;
const WEST = 275;

describe("local directions wording", () => {
  it("says H-1, not I-H1 or the I-H1", () => {
    expect(tidyFreewayName("Merge onto the I-H1 East")).toBe("Merge onto H-1 East");
    expect(tidyFreewayName("Take I-H201 West")).toBe("Take H-201 West");
    expect(localizeInstruction("Keep left onto Interstate Highway H1 E")).toBe(
      "Keep left onto H-1 E",
    );
  });

  it("never removes a direction word from the spoken instruction", () => {
    expect(localizeInstruction("Take the ramp onto H-1 West")).toBe("Take the ramp onto H-1 West");
    expect(localizeInstruction("Take the ramp to Moanalua Fwy West")).toBe(
      "Take the ramp to Moanalua Fwy West",
    );
  });

  it("HUD label drops a direction only when it contradicts the heading", () => {
    expect(localizeRoadLabel("Moanalua Fwy West", EAST)).toBe("Moanalua Fwy");
    expect(localizeRoadLabel("H-1 West", EAST)).toBe("H-1");
    expect(localizeRoadLabel("Moanalua Fwy East", EAST)).toBe("Moanalua Fwy East");
    expect(localizeRoadLabel("Moanalua Fwy West", WEST)).toBe("Moanalua Fwy West");
    expect(localizeRoadLabel("Moanalua Fwy West", null)).toBe("Moanalua Fwy West");
  });

  it("keeps a direction that matches, or when there is no bearing to check", () => {
    expect(dropContradictingDirection("Moanalua Fwy West", null)).toBe("Moanalua Fwy West");
    expect(dropContradictingDirection("Head west on Bishop St", EAST)).toBe(
      "Head west on Bishop St",
    );
    expect(dropContradictingDirection("Merge onto H-1", EAST)).toBe("Merge onto H-1");
  });

  it("keeps Nimitz the same in speech and on the HUD", () => {
    expect(localizeInstruction("Turn right onto North Nimitz Hwy")).toBe(
      "Turn right onto Nimitz Hwy",
    );
    expect(localizeRoadLabel("N Nimitz Hwy", EAST)).toBe("Nimitz Hwy");
    expect(speakableRoad("Turn right onto N Nimitz Hwy")).toBe("Turn right onto Nimitz Highway");
    expect(speakableRoad("Merge onto the I-H1 East")).toBe("Merge onto H 1 East");
  });

  it("landmark hints are label-only and skipped when the road is already named", () => {
    expect(localizeInstruction("Take exit 18A on the right")).toBe("Take exit 18A on the right");
    expect(landmarkTowardFor("Take exit 18A on the right")).toBeNull();
    expect(landmarkTowardFor("Turn left onto Salt Lake Blvd")).toBe("Aloha Stadium and Salt Lake");
    expect(landmarkTowardFor("Take exit 18B")).toBe("Nimitz Highway");
    expect(landmarkTowardFor("Take exit 18B onto Nimitz Hwy", "Nimitz Hwy")).toBeNull();
    expect(landmarkTowardFor("Salt Lake Blvd toward Aloha Stadium")).toBeNull();
    expect(
      hudRoadLabel({ road: "Salt Lake Blvd", instruction: "Turn left onto Salt Lake Blvd" }),
    ).toEqual({ road: "Salt Lake Blvd", toward: "Aloha Stadium and Salt Lake" });
    expect(hudRoadLabel({ road: null, instruction: "Turn left" })).toEqual({
      road: "Turn left",
      toward: null,
    });
  });

  it("speaks Waikīkī without the macron", () => {
    expect(speakableRoad("Exit toward Waikīkī")).toBe("Exit toward Waikiki");
  });
});

describe("buildManeuvers: spoken text keeps directions; HUD label checks the real heading", () => {
  // East for ~3 km, then a loop: the ramp first heads north-east, then the road runs WEST.
  const eastLeg = Array.from({ length: 30 }, (_, i) => ({ lat: 21.34, lon: -157.95 + i * 0.001 }));
  const loopRamp = [
    { lat: 21.3405, lon: -157.9205 },
    { lat: 21.3412, lon: -157.9215 },
    { lat: 21.341, lon: -157.9235 },
  ];
  const westLeg = Array.from({ length: 40 }, (_, i) => ({
    lat: 21.341,
    lon: -157.9245 - i * 0.001,
  }));
  const loopPath = [...eastLeg, ...loopRamp, ...westLeg];

  it("loop ramp: 'onto H-1 West' stays spoken and on the label even though the ramp starts heading east", () => {
    const steps = buildManeuvers(
      [
        {
          maneuver: "MOTORWAY_EXIT_RIGHT",
          instructionMessage: "Take the ramp on the right onto H-1 West",
          maneuverPoint: { latitude: 21.34, longitude: -157.922 },
          nextRoadInformation: { streetName: { text: "I-H1 West" } },
        },
      ] as never,
      loopPath,
    );
    expect(steps[0]?.instruction).toBe("Take the ramp on the right onto H-1 West");
    expect(steps[0]?.road).toBe("H-1 West");
  });

  it("drops 'West' from the label only when the road really runs east", () => {
    const eastOnly = Array.from({ length: 60 }, (_, i) => ({
      lat: 21.34,
      lon: -157.95 + i * 0.001,
    }));
    const steps = buildManeuvers(
      [
        {
          maneuver: "MOTORWAY_EXIT_RIGHT",
          instructionMessage: "Take the ramp to Moanalua Fwy West",
          maneuverPoint: { latitude: 21.34, longitude: -157.93 },
          nextRoadInformation: { streetName: { text: "Moanalua Fwy West" } },
        },
      ] as never,
      eastOnly,
    );
    expect(steps[0]?.instruction).toBe("Take the ramp to Moanalua Fwy West");
    expect(steps[0]?.road).toBe("Moanalua Fwy");
  });

  it("keeps the provider's label when the next maneuver comes before 800 m of that road", () => {
    const eastOnly = Array.from({ length: 60 }, (_, i) => ({
      lat: 21.34,
      lon: -157.95 + i * 0.001,
    }));
    const steps = buildManeuvers(
      [
        {
          maneuver: "MOTORWAY_EXIT_RIGHT",
          instructionMessage: "Take the ramp to Moanalua Fwy West",
          maneuverPoint: { latitude: 21.34, longitude: -157.93 },
          nextRoadInformation: { streetName: { text: "Moanalua Fwy West" } },
        },
        {
          maneuver: "TURN_RIGHT",
          instructionMessage: "Turn right",
          maneuverPoint: { latitude: 21.34, longitude: -157.927 },
          nextRoadInformation: { streetName: { text: "Side St" } },
        },
      ] as never,
      eastOnly,
    );
    expect(steps[0]?.road).toBe("Moanalua Fwy West");
  });

  it("keeps the provider's label when too little route remains to judge", () => {
    const short = Array.from({ length: 10 }, (_, i) => ({ lat: 21.34, lon: -157.95 + i * 0.001 }));
    const steps = buildManeuvers(
      [
        {
          maneuver: "TURN_RIGHT",
          instructionMessage: "Turn right onto Moanalua Fwy West",
          maneuverPoint: { latitude: 21.34, longitude: -157.943 },
          nextRoadInformation: { streetName: { text: "Moanalua Fwy West" } },
        },
      ] as never,
      short,
    );
    expect(steps[0]?.road).toBe("Moanalua Fwy West");
  });

  it("routeBearingAfter reads the heading ahead of a point, and null without enough route", () => {
    const b = routeBearingAfter(eastLeg, { lat: 21.34, lon: -157.93 });
    expect(Math.abs((b as number) - 90)).toBeLessThan(5);
    expect(routeBearingAfter(eastLeg, { lat: 21.34, lon: -157.925 }, 2000, 1500)).toBeNull();
  });
});
