import { describe, expect, it } from "vitest";
import { VoiceGuide, startRoutePhrase } from "./navigation-voice";

const m = (instruction: string, maneuver = "TURN_RIGHT") => ({
  lat: 21.3,
  lon: -157.85,
  maneuver,
  instruction,
  road: null,
});

describe("startRoutePhrase", () => {
  it("says where it's going and the first direction", () => {
    expect(startRoutePhrase("Ala Moana Center, Honolulu", { maneuver: m("Turn right onto Kapiolani Blvd"), distanceM: 400 }))
      .toBe("Starting route to Ala Moana Center. In a quarter mile, turn right onto Kapiolani Boulevard.");
  });
  it("skips the distance for a first step right where you are", () => {
    expect(startRoutePhrase("Home", { maneuver: m("Head east on Moanalua Rd", "DEPART"), distanceM: 10 }))
      .toBe("Starting route home. Head east on Moanalua Road.");
  });
  it("still confirms the voice with no direction yet", () => {
    expect(startRoutePhrase("", null)).toBe("Starting route.");
  });
});

describe("markStartAnnounced", () => {
  it("doesn't repeat the same direction seconds later", () => {
    const guide = new VoiceGuide({ stabilizeMs: 0 });
    const turn = m("Turn right onto Kapiolani Blvd");
    guide.sync([turn]);
    const next = { maneuver: turn, distanceM: 700 };
    guide.markStartAnnounced(next, 0);
    expect(guide.next(next, 5_000, { speedMps: 10 })).toBeNull();
    expect(guide.next({ maneuver: turn, distanceM: 80 }, 60_000, { speedMps: 10 })).toMatch(/turn right/i);
  });
});
