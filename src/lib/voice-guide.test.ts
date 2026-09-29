import { describe, expect, it } from "vitest";
import { VoiceGuide, speakableRoad, type Maneuver } from "./navigation-voice";

const m = (lat: number, code = "TURN_LEFT", instruction = "Turn left onto Ft Weaver Rd"): Maneuver => ({
  lat, lon: -158, maneuver: code, instruction, road: null,
});

describe("speakableRoad", () => {
  it("expands Oʻahu abbreviations", () => {
    expect(speakableRoad("Ft Weaver Rd")).toBe("Fort Weaver Road");
    expect(speakableRoad("Take HI-76")).toBe("Take Hawaii 76");
    expect(speakableRoad("Merge onto H-201 W")).toBe("Merge onto Moanalua Freeway West");
  });
});

describe("VoiceGuide", () => {
  it("speaks far then near once, with pacing and safety bypass", () => {
    const g = new VoiceGuide({ stabilizeMs: 0 });
    const turn = m(21.3);
    g.sync([turn]);
    expect(g.next({ maneuver: turn, distanceM: 700 }, 0)).toMatch(/half a mile.*Fort Weaver Road/);
    expect(g.next({ maneuver: turn, distanceM: 600 }, 1000)).toBeNull();
    expect(g.next({ maneuver: turn, distanceM: 80 }, 2000)).toBeNull(); // cooldown
    expect(g.next({ maneuver: turn, distanceM: 40 }, 3000)).toMatch(/300 feet/); // safety
    expect(g.next({ maneuver: turn, distanceM: 30 }, 20000)).toBeNull();
  });
  it("waits for GPS to settle, stays silent while rerouting, uses freeway tiers", () => {
    const g = new VoiceGuide();
    const turn = m(21.3, "MOTORWAY_EXIT_RIGHT", "Take exit onto H-1 E (7110)");
    g.sync([turn]);
    expect(g.next({ maneuver: turn, distanceM: 1100 }, 0, { speedMps: 27 })).toBeNull();
    expect(g.next({ maneuver: turn, distanceM: 1100 }, 3500, { speedMps: 27, rerouting: true })).toBeNull();
    expect(g.next({ maneuver: turn, distanceM: 1100 }, 3600, { speedMps: 27 })).toBe(
      "In three quarters of a mile, take exit onto H 1 East.",
    );
    expect(g.next({ maneuver: turn, distanceM: 1000 }, 30000, { speedMps: 27 })).toBeNull();
    expect(g.next({ maneuver: turn, distanceM: 550 }, 9000, { speedMps: 27 })).toBeNull(); // cooldown
    expect(g.next({ maneuver: turn, distanceM: 550 }, 16000, { speedMps: 27 })).toMatch(/third of a mile/);
    expect(g.next({ maneuver: turn, distanceM: 500 }, 40000, { speedMps: 27 })).toBeNull();
  });
  it("resets on reroute so new turns are not skipped", () => {
    const g = new VoiceGuide({ stabilizeMs: 0 });
    const a = m(21.3);
    g.sync([a]);
    g.next({ maneuver: a, distanceM: 80 }, 0);
    expect(g.sync([m(21.4, "TURN_RIGHT", "Turn right")])).toBe(true);
    expect(g.next({ maneuver: m(21.4, "TURN_RIGHT", "Turn right"), distanceM: 80 }, 13000)).toMatch(/300 feet/);
  });
});
