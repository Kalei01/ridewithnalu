import { describe, expect, it } from "vitest";
import {
  spokenDistance,
  announcementFor,
  announcementTiers,
  FAR_ANNOUNCE_M,
  navigationRoadType,
  NEAR_ANNOUNCE_M,
  isUsableNavigationFix,
  matchRoutePoint,
  nextManeuver,
  routeDeviation,
  smoothBearing,
  trimRoutePath,
  VoiceGuide,
  turnGlyph,
  type Maneuver,
} from "./navigation-voice";
import { arrivalRange, destinationAccess } from "./destination-access";

const turn: Maneuver = {
  lat: 21.3,
  lon: -157.86,
  maneuver: "TURN_LEFT",
  instruction: "Turn left onto Bishop St",
  road: "Bishop St",
};

describe("turn-by-turn voice", () => {
  it("speaks far then near once each, across refreshes", () => {
    const spoken = new Set<string>();
    expect(announcementFor({ maneuver: turn, distanceM: 700 }, spoken)).toMatch(/half a mile/);
    expect(announcementFor({ maneuver: { ...turn }, distanceM: 650 }, spoken)).toBeNull();
    expect(announcementFor({ maneuver: turn, distanceM: 80 }, spoken)).toMatch(
      /300 feet, turn left/,
    );
    expect(announcementFor({ maneuver: turn, distanceM: 60 }, spoken)).toBeNull();
  });
  it("skips passed maneuvers", () => {
    const passed = new Set<string>();
    const next = nextManeuver(
      { lat: 21.3, lon: -157.86 },
      [turn, { ...turn, lat: 21.31, maneuver: "ARRIVE" }],
      passed,
    );
    expect(next?.maneuver.maneuver).toBe("ARRIVE");
  });
  it("maps glyphs", () => {
    expect(turnGlyph("TURN_RIGHT")).toBe("right");
    expect(turnGlyph("MOTORWAY_EXIT_LEFT")).toBe("slight-left");
  });
  it("holds bearing while stopped", () => {
    expect(
      smoothBearing(90, {
        gpsHeading: 270,
        speedMps: 0,
        from: { lat: 21.3, lon: -157.86 },
        to: { lat: 21.3, lon: -157.86 },
      }),
    ).toBe(90);
  });
  it("snaps a noisy fix to the forward route without jumping to an opposing segment", () => {
    const path = [
      { lat: 21.3, lon: -157.9 },
      { lat: 21.3, lon: -157.89 },
      { lat: 21.3002, lon: -157.89 },
      { lat: 21.3002, lon: -157.9 },
    ];
    const match = matchRoutePoint({ lat: 21.30015, lon: -157.895 }, path, 0, 90);
    expect(match?.segmentIndex).toBe(0);
    expect(match?.point.lat).toBeCloseTo(21.3, 5);
  });
  it("rejects inaccurate fixes and impossible jumps", () => {
    const previous = { point: { lat: 21.3, lon: -157.9 }, timestamp: 1_000 };
    expect(
      isUsableNavigationFix(previous, {
        point: { lat: 21.3, lon: -157.8999 },
        timestamp: 2_000,
        accuracy: 80,
      }),
    ).toBe(false);
    expect(
      isUsableNavigationFix(previous, {
        point: { lat: 21.4, lon: -157.8 },
        timestamp: 2_000,
        accuracy: 5,
      }),
    ).toBe(false);
    expect(
      isUsableNavigationFix(previous, {
        point: { lat: 21.3001, lon: -157.9 },
        timestamp: 2_000,
        accuracy: 8,
      }),
    ).toBe(true);
  });
  it("flags distance immediately and heading divergence after two fixes", () => {
    const match = {
      point: { lat: 21.3, lon: -157.9 },
      segmentIndex: 1,
      distanceM: 20,
      bearing: 90,
    };
    const first = routeDeviation(match, 170, 0);
    expect(first.offRoute).toBe(false);
    expect(first.divergentFixes).toBe(1);
    expect(routeDeviation(match, 170, first.divergentFixes).offRoute).toBe(true);
    expect(routeDeviation({ ...match, distanceM: 46 }, 90, 0).offRoute).toBe(true);
  });
  it("trims the traveled route behind the matched vehicle point", () => {
    const path = [
      { lat: 21.3, lon: -158 },
      { lat: 21.31, lon: -157.99 },
      { lat: 21.32, lon: -157.98 },
      { lat: 21.33, lon: -157.97 },
    ];
    const match = {
      point: { lat: 21.315, lon: -157.985 },
      segmentIndex: 1,
      distanceM: 5,
      bearing: 45,
    };
    expect(trimRoutePath(path, match)).toEqual([match.point, path[2], path[3]]);
  });
  it("replays a work-to-home deviation and keeps only the forward route", () => {
    const workToHome = [
      { lat: 21.307, lon: -157.86 },
      { lat: 21.32, lon: -157.9 },
      { lat: 21.35, lon: -157.95 },
      { lat: 21.39, lon: -158.0 },
    ];
    const onRoute = matchRoutePoint({ lat: 21.335, lon: -157.925 }, workToHome, 0, 300);
    expect(routeDeviation(onRoute, 300).offRoute).toBe(false);
    expect(trimRoutePath(workToHome, onRoute)[0]).toEqual(onRoute?.point);

    const deviated = matchRoutePoint({ lat: 21.337, lon: -157.924 }, workToHome, 1, 300);
    expect(routeDeviation(deviated, 300).offRoute).toBe(true);
  });
});

describe("destination access", () => {
  it("gives downtown a larger buffer than home", () => {
    expect(destinationAccess({ lat: 21.309, lon: -157.862 }).zone).toBe("downtown");
    expect(destinationAccess({ lat: 21.35, lon: -158.0 }, "home").typicalMin).toBe(0);
  });
  it("shortens downtown parking at night and on Sundays, not in Waikiki", () => {
    const weekdayMorning = new Date("2026-10-06T18:30:00Z"); // Tue 8:30 AM HST
    const weekdayNight = new Date("2026-10-07T06:00:00Z"); // Tue 8:00 PM HST
    const sundayNoon = new Date("2026-10-04T22:00:00Z"); // Sun 12:00 PM HST
    const downtown = { lat: 21.309, lon: -157.862 };
    expect(destinationAccess(downtown, null, weekdayMorning).typicalMin).toBe(10);
    expect(destinationAccess(downtown, null, weekdayNight).typicalMin).toBe(4);
    expect(destinationAccess(downtown, null, sundayNoon).typicalMin).toBe(4);
    expect(destinationAccess({ lat: 21.278, lon: -157.828 }, null, weekdayNight).typicalMin).toBe(
      10,
    );
    expect(destinationAccess({ lat: 21.4, lon: -158.0 }, null, weekdayMorning).typicalMin).toBe(0);
  });
  it("adds nothing for a home in Mānoa: the drive time is the driving time", () => {
    // 3380 Mānoa Road, a weekday morning.
    const manoa = destinationAccess(
      { lat: 21.3213, lon: -157.80498 },
      null,
      new Date("2026-10-06T18:00:00Z"),
    );
    expect([manoa.lowMin, manoa.typicalMin, manoa.highMin]).toEqual([0, 0, 0]);
  });
  it("builds an arrival window", () => {
    const access = destinationAccess({ lat: 21.309, lon: -157.862 });
    const range = arrivalRange(0, { low: 30, expected: 33, high: 38 }, access);
    expect(range.earliestSeconds).toBe((30 + 7) * 60);
    expect(range.latestSeconds).toBe((38 + 14) * 60);
  });
});

describe("context-aware voice timing", () => {
  it("announces freeway maneuvers earlier at speed", () => {
    const freeway: Maneuver = {
      ...turn,
      road: "H-1",
      maneuver: "MOTORWAY_EXIT_RIGHT",
      instruction: "Take the H-1 exit right",
    };
    const tiers = announcementTiers(25, freeway);
    expect(tiers[0]?.atM).toBe(1350);
    expect(tiers[1]?.atM).toBe(700);
    expect(tiers[2]?.atM).toBe(275);
  });

  it("shortens the freeway window in stop-and-go traffic", () => {
    const freeway: Maneuver = { ...turn, road: "H-1", maneuver: "TURN_LEFT" };
    const tiers = announcementTiers(5, freeway);
    expect(tiers[0]?.atM).toBe(900);
    expect(tiers[1]?.atM).toBe(450);
    expect(tiers[2]?.atM).toBe(220);
  });

  it("keeps ordinary local turns in the normal window", () => {
    const tiers = announcementTiers(12, { ...turn, road: "Kapiolani Blvd" });
    expect(tiers[0]?.atM).toBe(FAR_ANNOUNCE_M);
    expect(tiers[1]?.atM).toBe(NEAR_ANNOUNCE_M);
  });

  it("gives complex local maneuvers extra lead time", () => {
    const complex: Maneuver = {
      ...turn,
      road: "Punahou St",
      maneuver: "ROUNDABOUT_RIGHT",
    };
    const tiers = announcementTiers(10, complex);
    expect(tiers[0]?.atM).toBe(900);
    expect(tiers[1]?.atM).toBe(120);
  });

  it("identifies freeway context from the road instead of requiring freeway speed", () => {
    expect(navigationRoadType({ ...turn, road: "H-1" }, 3)).toBe("freeway");
    expect(navigationRoadType({ ...turn, road: "Bishop St" }, 3)).toBe("local");
  });

  it("does not speak while stopped and resumes when moving", () => {
    const guide = new VoiceGuide({ stabilizeMs: 0, cooldownMs: 0 });
    guide.sync([turn]);
    const next = { maneuver: turn, distanceM: 80 };
    expect(guide.next(next, 1_000, { speedMps: 0 })).toBeNull();
    expect(guide.next(next, 2_000, { speedMps: 8 })).toMatch(/300 feet/);
  });
});

describe("voice suppression", () => {
  it("stays silent while GPS accuracy is poor", () => {
    const guide = new VoiceGuide({ stabilizeMs: 0, cooldownMs: 0 });
    guide.sync([turn]);
    expect(guide.next({ maneuver: turn, distanceM: 200 }, 1_000, { gpsAccuracyM: 41 })).toBeNull();
    expect(guide.next({ maneuver: turn, distanceM: 200 }, 2_000, { gpsAccuracyM: 20 })).toMatch(
      /700 feet/,
    );
  });

  it("stays silent when the accepted GPS fix is stale", () => {
    const guide = new VoiceGuide({ stabilizeMs: 0, cooldownMs: 0 });
    guide.sync([turn]);
    expect(guide.next({ maneuver: turn, distanceM: 200 }, 10_000, { fixAgeMs: 5_001 })).toBeNull();
    expect(guide.next({ maneuver: turn, distanceM: 200 }, 11_000, { fixAgeMs: 1_000 })).toMatch(
      /700 feet/,
    );
  });

  it("stays silent while rerouting", () => {
    const guide = new VoiceGuide({ stabilizeMs: 0, cooldownMs: 0 });
    guide.sync([turn]);
    expect(guide.next({ maneuver: turn, distanceM: 200 }, 1_000, { rerouting: true })).toBeNull();
  });
});

describe("spoken distance matches the real distance", () => {
  it("says the distance a driver would, from where the car actually is", () => {
    expect(spokenDistance(83)).toBe("In 300 feet");
    expect(spokenDistance(259)).toBe("In 800 feet");
    expect(spokenDistance(326)).toBe("In a quarter mile");
    expect(spokenDistance(691)).toBe("In half a mile");
    expect(spokenDistance(1339)).toBe("In three quarters of a mile");
    expect(spokenDistance(3300)).toBe("In 2 miles");
  });

  it("never says half a mile for a turn that is close after the previous one", () => {
    const guide = new VoiceGuide({ stabilizeMs: 0, cooldownMs: 0 });
    guide.sync([turn]);
    const phrase = guide.next({ maneuver: turn, distanceM: 326 }, 1_000, { speedMps: 13 });
    expect(phrase).toMatch(/^In a quarter mile, /);
  });

  it("announces an upcoming arrival naturally", () => {
    const arrive = { ...turn, maneuver: "ARRIVE", instruction: "You have arrived" };
    const guide = new VoiceGuide({ stabilizeMs: 0, cooldownMs: 0 });
    guide.sync([arrive]);
    expect(guide.next({ maneuver: arrive, distanceM: 800 }, 1_000, { speedMps: 9 })).toBe(
      "In half a mile, you'll arrive at your destination.",
    );
    expect(guide.next({ maneuver: arrive, distanceM: 85 }, 2_000, { speedMps: 9 })).toBe(
      "You have arrived at your destination.",
    );
  });
});
