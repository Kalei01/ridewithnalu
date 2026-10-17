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
import { speakableRoad, startRoutePhrase, type Maneuver } from "./navigation-voice";

const EAST = 95;
const WEST = 275;

describe("local directions wording", () => {
  it("says H-1, not I-H1 or the I-H1", () => {
    expect(tidyFreewayName("Merge onto the I-H1 East")).toBe("Merge onto H-1 East");
    expect(tidyFreewayName("Take I-H201 West")).toBe("Take H-201 West");
    expect(localizeInstruction("Keep left onto Interstate Highway H1 E", EAST)).toBe(
      "Keep left onto H-1 E",
    );
  });

  it("drops a direction that contradicts the route bearing (Moanalua Fwy West while eastbound)", () => {
    expect(dropContradictingDirection("Take the ramp to Moanalua Fwy West", EAST)).toBe(
      "Take the ramp to Moanalua Fwy",
    );
    expect(dropContradictingDirection("Keep right onto H-1 W", EAST)).toBe("Keep right onto H-1");
    expect(localizeRoadLabel("Moanalua Fwy West", EAST)).toBe("Moanalua Fwy");
  });

  it("keeps a direction that matches, or when there is no bearing to check", () => {
    expect(dropContradictingDirection("Take the ramp to Moanalua Fwy East", EAST)).toBe(
      "Take the ramp to Moanalua Fwy East",
    );
    expect(dropContradictingDirection("Moanalua Fwy West", WEST)).toBe("Moanalua Fwy West");
    expect(dropContradictingDirection("Moanalua Fwy West", null)).toBe("Moanalua Fwy West");
  });

  it("does not touch 'Head east on' style directions or H-1 itself", () => {
    expect(dropContradictingDirection("Head west on Bishop St", EAST)).toBe(
      "Head west on Bishop St",
    );
    expect(dropContradictingDirection("Merge onto H-1", EAST)).toBe("Merge onto H-1");
  });

  it("keeps Nimitz the same in speech and on the HUD", () => {
    expect(localizeInstruction("Turn right onto North Nimitz Hwy", EAST)).toBe(
      "Turn right onto Nimitz Hwy",
    );
    expect(localizeRoadLabel("N Nimitz Hwy", EAST)).toBe("Nimitz Hwy");
    // Even an old, unlocalized route speaks plain Nimitz.
    expect(speakableRoad("Turn right onto N Nimitz Hwy")).toBe("Turn right onto Nimitz Highway");
    expect(speakableRoad("Merge onto the I-H1 East")).toBe("Merge onto H 1 East");
  });

  it("adds landmark wording for known exits and streets only", () => {
    expect(localizeInstruction("Take exit 18A on the right", EAST)).toBe(
      "Take exit 18A on the right toward Nimitz Highway and Waikīkī",
    );
    expect(localizeInstruction("Turn left onto Salt Lake Blvd", EAST)).toBe(
      "Turn left onto Salt Lake Blvd toward Aloha Stadium and Salt Lake",
    );
    expect(landmarkTowardFor("Take exit 18B")).toBe("Nimitz Highway");
    expect(localizeInstruction("Take exit 7 on the right", EAST)).toBe("Take exit 7 on the right");
    expect(localizeInstruction("Take exit 18A toward the airport", EAST)).toBe(
      "Take exit 18A toward the airport",
    );
  });

  it("speaks Waikīkī without the macron", () => {
    expect(speakableRoad("Exit toward Waikīkī")).toBe("Exit toward Waikiki");
  });

  it("HUD label shows the road with its landmark", () => {
    expect(
      hudRoadLabel({ road: "Salt Lake Blvd", instruction: "Turn left onto Salt Lake Blvd" }),
    ).toBe("Salt Lake Blvd · toward Aloha Stadium and Salt Lake");
    expect(hudRoadLabel({ road: null, instruction: "Turn left" })).toBe("Turn left");
  });

  it("start phrase uses the same local wording", () => {
    const m: Maneuver = {
      lat: 21.3,
      lon: -157.9,
      maneuver: "MOTORWAY_EXIT_RIGHT",
      instruction: localizeInstruction("Take exit 18A", EAST),
      road: null,
    };
    expect(startRoutePhrase("Work", { maneuver: m, distanceM: 900 })).toContain(
      "toward Nimitz Highway and Waikiki",
    );
  });
});

describe("buildManeuvers applies the local layer using the route heading", () => {
  // Eastbound straight line, ~110 m per step.
  const path = Array.from({ length: 30 }, (_, i) => ({ lat: 21.34, lon: -157.95 + i * 0.001 }));
  it("fixes 'Moanalua Fwy West' on an eastbound route and I-H1 in the same step", () => {
    const steps = buildManeuvers(
      [
        {
          maneuver: "MOTORWAY_EXIT_RIGHT",
          instructionMessage: "Take the exit on the right onto Moanalua Fwy West",
          maneuverPoint: { latitude: 21.34, longitude: -157.93 },
          nextRoadInformation: { streetName: { text: "Moanalua Fwy West" } },
        },
        {
          maneuver: "KEEP_LEFT",
          instructionMessage: "Keep left onto the I-H1 East",
          maneuverPoint: { latitude: 21.34, longitude: -157.92 },
          nextRoadInformation: { streetName: { text: "I-H1 East" } },
        },
      ] as never,
      path,
    );
    expect(steps[0]?.instruction).toBe("Take the exit on the right onto Moanalua Fwy");
    expect(steps[0]?.road).toBe("Moanalua Fwy");
    expect(steps[1]?.instruction).toBe("Keep left onto H-1 East");
    expect(steps[1]?.road).toBe("H-1 East");
  });
  it("routeBearingAfter reads the heading ahead of a point", () => {
    const b = routeBearingAfter(path, { lat: 21.34, lon: -157.93 });
    expect(b).not.toBeNull();
    expect(Math.abs((b as number) - 90)).toBeLessThan(5);
  });
});
