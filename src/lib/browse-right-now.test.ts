import { describe, expect, it } from "vitest";
import type { DriveTime } from "./drive.functions";
import type { HdotScheduledClosure } from "./hdot-lane-closures.functions";
import {
  buildRightNow,
  calmLine,
  closureState,
  closureWhere,
  closureWindow,
  type RoadCheck,
} from "./browse-right-now";

// Honolulu is UTC-10, no daylight saving.
const hst = (hour: number, minute = 0) => new Date(Date.UTC(2026, 9, 21, hour + 10, minute));

function drive(over: Partial<DriveTime> = {}): DriveTime {
  return {
    trafficMinutes: 30,
    typicalMinutes: 30,
    typicalChecked: true,
    delayMinutes: 0,
    lowMinutes: 28,
    highMinutes: 33,
    meters: 30000,
    path: [
      { lat: 21.33, lon: -158.08 },
      { lat: 21.31, lon: -157.86 },
    ],
    trafficSections: [],
    incidents: [],
    corridorLabel: null,
    corridorRoads: ["Fort Weaver Rd", "H-1 East", "Nimitz Hwy"],
    bypassedRoads: [],
    maneuvers: [],
    fetchedAt: 0,
    trafficBasis: "live",
    ...over,
  } as DriveTime;
}

const check = (over: Partial<RoadCheck> = {}): RoadCheck => ({
  id: "kapolei-town",
  area: "Kapolei ↔ town",
  forward: drive(),
  back: drive({ corridorRoads: ["Nimitz Hwy", "H-1 West"] }),
  loading: false,
  failed: false,
  ...over,
});

const closure = (over: Partial<HdotScheduledClosure> = {}): HdotScheduledClosure => ({
  route: "H-1",
  direction: "westbound",
  location: "Westbound Kalaeloa to Kunia, closure of two lanes",
  laneSummary: "2 lanes closed",
  schedule: "nightly from 8 p.m. to 5 a.m.",
  work: null,
  ...over,
});

describe("closure windows", () => {
  it("reads the nightly window and wraps past midnight", () => {
    expect(closureWindow(closure())).toEqual({ startMin: 20 * 60, endMin: 5 * 60 });
    expect(closureState(closure(), hst(21).getTime())).toBe("now");
    expect(closureState(closure(), hst(2).getTime())).toBe("now");
    expect(closureState(closure(), hst(16).getTime())).toBe("tonight");
    expect(closureState(closure(), hst(7).getTime())).toBe("tonight");
  });
  it("treats 24/7 as now and an unstated time as unknown", () => {
    expect(
      closureState(
        closure({ schedule: "from Kamehameha Highway 24-hours a day, 7-days a week" }),
        hst(9).getTime(),
      ),
    ).toBe("now");
    expect(closureState(closure({ schedule: "See HDOT weekly schedule" }), hst(9).getTime())).toBe(
      "unknown",
    );
  });
  it("does not call a closure that has not started yet active", () => {
    const later = closure({
      schedule: "from Monday, Oct. 26 through Friday, Oct. 30, nightly from 8 p.m. to 5 a.m.",
    });
    expect(closureState(later, hst(21).getTime())).toBe("later");
  });
  it("finds a plain place in HDOT wording", () => {
    expect(closureWhere("Westbound Kalaeloa to Kunia, closure of two lanes")).toBe(
      "Kalaeloa to Kunia",
    );
    expect(closureWhere("Westbound closure of one to two lanes near Red Hill")).toBe(
      "near Red Hill",
    );
    expect(
      closureWhere("Eastbound full closure of the Kinau Street off-ramp (Exit 24)"),
    ).toBeNull();
  });
});

describe("buildRightNow", () => {
  it("keeps the morning calm line when only tonight's closure is coming", () => {
    expect(buildRightNow({ checks: [check()], closures: [closure()], now: hst(7) }).status).toBe(
      "calm",
    );
  });

  it("says one calm line when everything checked is clear", () => {
    const result = buildRightNow({ checks: [check()], closures: [], now: hst(7) });
    expect(result.status).toBe("calm");
    expect(result.line).toBe("H-1 and Nimitz Hwy clear both ways");
  });

  it("only names roads that were checked and never claims unchecked roads", () => {
    const line = buildRightNow({
      checks: [
        check({
          forward: drive({ corridorRoads: ["Kamehameha Hwy"] }),
          back: drive({ corridorRoads: ["Kamehameha Hwy"] }),
        }),
      ],
      closures: [],
      now: hst(7),
    }).line;
    expect(line).toBe("Kamehameha Hwy clear both ways");
    expect(line).not.toMatch(/H-1|H-2|Moanalua/);
  });

  it("reports a failed check plainly and a missing baseline honestly", () => {
    expect(
      buildRightNow({
        checks: [check({ forward: undefined, back: undefined, failed: true })],
        closures: [],
        now: hst(7),
      }).line,
    ).toBe("Can’t check traffic right now");
    const noBase = check({
      forward: drive({ typicalChecked: false }),
      back: drive({ typicalChecked: false }),
    });
    expect(calmLine([noBase])).toMatch(/no usual-time comparison/);
  });

  it("puts a live accident first even in the evening, with road, place, age and delay", () => {
    const accident = drive({
      incidents: [
        {
          description: "Accident",
          road: "H-1",
          category: "1",
          from: "Aiea",
          to: "Pearl City",
          delayMinutes: 9,
          points: [{ lat: 21.38, lon: -157.93 }],
        },
      ],
    });
    const result = buildRightNow({
      checks: [check({ forward: accident })],
      closures: [closure()],
      now: hst(18),
    });
    expect(result.items[0]?.title).toBe("Accident on H-1");
    expect(result.items[0]?.detail).toBe("Aiea to Pearl City · live · +9 min");
    expect(result.items[0]?.focus?.kind).toBe("point");
    expect(result.items[1]?.kind).toBe("closure");
  });

  it("shows tonight's closure ahead of a mild slowdown in the evening, behind it in the morning", () => {
    const slow = drive({ delayMinutes: 6 });
    const evening = buildRightNow({
      checks: [check({ forward: slow })],
      closures: [closure()],
      now: hst(17),
    });
    expect(evening.items.map((i) => i.kind)).toEqual(["closure", "slowdown"]);
    expect(evening.items[0]?.title).toBe("H-1 westbound: 2 lanes closed");
    expect(evening.items[0]?.detail).toBe("Tonight 8 PM–5 AM · Kalaeloa to Kunia");
    const morning = buildRightNow({
      checks: [check({ forward: slow })],
      closures: [closure()],
      now: hst(8),
    });
    expect(morning.items.map((i) => i.kind)).toEqual(["slowdown"]);
  });

  it("lists only closures on the rider's roads and at most three items", () => {
    const result = buildRightNow({
      checks: [check()],
      closures: [
        closure({ route: "H-2" }),
        closure({ location: "a" }),
        closure({ location: "b" }),
        closure({ location: "c" }),
        closure({ location: "d" }),
      ],
      now: hst(21),
    });
    expect(result.items).toHaveLength(3);
    expect(result.items.every((i) => /^H-1/.test(i.title))).toBe(true);
    expect(result.items[0]?.detail.startsWith("Now, until 5 AM")).toBe(true);
  });

  it("drops police reports older than 90 minutes", () => {
    const old = drive({
      nearbyIncidents: [
        {
          description: "Collision",
          road: "H-1",
          delayMinutes: null,
          category: "1",
          source: "hpd",
          reportedAt: new Date(hst(7).getTime() - 3 * 3600_000).toISOString(),
          points: [{ lat: 21.3, lon: -157.9 }],
        },
      ],
    });
    expect(
      buildRightNow({ checks: [check({ forward: old })], closures: [], now: hst(7) }).status,
    ).toBe("calm");
  });
});
