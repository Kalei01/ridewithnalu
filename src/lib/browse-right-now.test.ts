import { describe, expect, it } from "vitest";
import type { DriveTime } from "./drive.functions";
import type { HdotScheduledClosure } from "./hdot-lane-closures.functions";
import {
  buildRightNow,
  calmLine,
  closureState,
  closureWhere,
  closureWindow,
  incidentPins,
  roadLines,
  trafficCard,
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

/** A check whose route the server confirmed carries these closures. */
const carrying = (...items: HdotScheduledClosure[]) =>
  check({ forward: drive({ hdotScheduledClosures: items }) });

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
    expect(result.items[0]?.detail).toBe("ʻAiea to Pearl City · live · +9 min");
    expect(result.items[0]?.focus?.kind).toBe("point");
    // The weekly closure is not up here: it waits in the closures list.
    expect(result.items).toHaveLength(1);
    expect(result.closures.map((c) => c.kind)).toEqual(["closure"]);
  });

  it("keeps live traffic at the top at every hour; tonight's closure waits in the closures list", () => {
    const slow = drive({ delayMinutes: 6, hdotScheduledClosures: [closure()] });
    for (const hour of [8, 17]) {
      const result = buildRightNow({
        checks: [check({ forward: slow })],
        closures: [closure()],
        now: hst(hour),
      });
      expect(result.items.map((i) => i.kind)).toEqual(["slowdown"]);
      expect(result.closures).toHaveLength(1);
    }
    const evening = buildRightNow({
      checks: [check({ forward: slow })],
      closures: [closure()],
      now: hst(17),
    });
    expect(evening.closures[0]?.title).toBe("H-1 westbound · 2 lanes closed");
    expect(evening.closures[0]?.detail).toBe("Heads-up: tonight 8 PM–5 AM · Kalaeloa to Kunia");
  });

  it("lists only closures on the rider's roads; one confirmed and active now may stay in Right now", () => {
    const four = ["a", "b", "c", "d"].map((location) => closure({ location }));
    const result = buildRightNow({
      checks: [carrying(...four)],
      closures: [closure({ route: "H-2" }), ...four],
      now: hst(21),
    });
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.kind).toBe("closure");
    expect(result.items[0]?.detail.startsWith("Now, until 5 AM")).toBe(true);
    expect(result.closures).toHaveLength(4);
    expect(result.closures.every((i) => /^H-1/.test(i.title))).toBe(true);
  });

  it("does not keep a closure up top when it is only tonight or not confirmed on the route", () => {
    const early = buildRightNow({
      checks: [carrying(closure())],
      closures: [closure()],
      now: hst(16),
    });
    expect(early.items).toHaveLength(0);
    expect(early.status).toBe("calm");
    const unconfirmed = buildRightNow({ checks: [check()], closures: [closure()], now: hst(21) });
    expect(unconfirmed.items).toHaveLength(0);
    expect(unconfirmed.closures).toHaveLength(1);
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

describe("closure dates and weekdays", () => {
  const range = (schedule: string) => closure({ schedule });
  // Wed Oct 21, 2026 (HST)
  it("never says now before the start date, and not after the last date", () => {
    const monday = range("from 8 p.m. to 5 a.m., Monday, Oct. 26, through Friday, Oct. 30");
    expect(closureState(monday, hst(21).getTime())).toBe("later");
    const over = range("from 8 p.m. to 5 a.m., Monday, Oct. 12, through Friday, Oct. 16");
    expect(closureState(over, hst(21).getTime())).toBe("later");
    const running = range("from 8 p.m. to 5 a.m., Monday, Oct. 19, through Friday, Oct. 23");
    expect(closureState(running, hst(21).getTime())).toBe("now");
  });
  it("keeps the last night active until its morning end", () => {
    const last = range("from 8 p.m. to 5 a.m., Monday, Oct. 19, through Wednesday, Oct. 21");
    // 2 AM Thursday Oct 22 is still Wednesday night's shift.
    const thursday2am = new Date(Date.UTC(2026, 9, 22, 12));
    expect(closureState(last, thursday2am.getTime())).toBe("now");
    expect(closureState(last, new Date(Date.UTC(2026, 9, 22, 20)).getTime())).toBe("later");
  });
  it("reads weekday spans: Sunday night through Thursday night", () => {
    const span = range("from 9 p.m. to 4 a.m., Sunday night through Thursday night");
    expect(closureState(span, hst(22).getTime())).toBe("now"); // Wednesday
    expect(closureState(span, hst(22).getTime() + 2 * 86_400_000)).toBe("later"); // Friday
  });
  it("applies weekdays-only to a dated range", () => {
    const work = range("Oct. 19 – Nov. 6, 8:30 a.m. to 3:30 p.m., weekdays");
    expect(closureState(work, hst(10).getTime())).toBe("now"); // Wednesday
    const saturday = hst(10).getTime() + 3 * 86_400_000;
    expect(closureState(work, saturday)).toBe("later");
    expect(closureState(work, hst(7).getTime() + 3 * 86_400_000)).toBe("later");
  });
  it("does not read day names that only label dates as a weekday run", () => {
    const nights = range(
      "from Monday, Oct. 19 through Friday, Oct. 30, nightly from 8 p.m. to 5 a.m.",
    );
    expect(closureState(nights, hst(21).getTime() + 3 * 86_400_000)).toBe("now"); // Saturday
  });
  it("calls a daytime window that has not started 'today', not tonight", () => {
    const day = range("from 9 a.m. to 3 p.m.");
    expect(closureState(day, hst(7).getTime())).toBe("today");
    expect(closureState(day, hst(10).getTime())).toBe("now");
    const item = buildRightNow({
      checks: [carrying(day)],
      closures: [day],
      now: hst(7),
    }).closures[0];
    expect(item?.detail).toBe("Heads-up: later today 9 AM–3 PM · Kalaeloa to Kunia");
  });
});

describe("rider-facing wording", () => {
  it("names a direction only from the route's own road name", () => {
    const slow = drive({ delayMinutes: 7, corridorRoads: ["H-1 East"] });
    const named = buildRightNow({ checks: [check({ forward: slow })], closures: [], now: hst(8) });
    expect(named.items[0]?.title).toBe("H-1 eastbound: +7 min over typical");
    const plain = drive({ delayMinutes: 7, corridorRoads: ["Likelike Hwy"] });
    const none = buildRightNow({ checks: [check({ forward: plain })], closures: [], now: hst(8) });
    expect(none.items[0]?.title).toBe("Likelike Hwy: +7 min over typical");
  });

  it("shows a closure the server did not place on the route as not confirmed, without a map target", () => {
    const result = buildRightNow({ checks: [check()], closures: [closure()], now: hst(21) });
    expect(result.closures[0]?.title.startsWith("H-1 westbound · ")).toBe(true);
    expect(result.closures[0]?.tone).toBe("info");
    expect(result.closures[0]?.focus).toBeNull();
  });

  it("never says clear when the incident feed is down", () => {
    const blind = check({
      forward: drive({ incidentsAvailable: false }),
      back: drive({ incidentsAvailable: false, corridorRoads: ["Nimitz Hwy", "H-1 West"] }),
    });
    const line = buildRightNow({ checks: [blind], closures: [], now: hst(7) }).line;
    expect(line).toBe("H-1 and Nimitz Hwy: traffic looks normal; crash data limited right now");
    expect(line).not.toMatch(/clear/);
  });
});

describe("map incident kinds and the traffic card", () => {
  const pts = [
    { lat: 21.33, lon: -158.0 },
    { lat: 21.34, lon: -157.95 },
  ];
  const check = (over: Partial<DriveTime>): RoadCheck => ({
    id: "c1",
    area: "Kapolei ↔ town",
    forward: drive({ fetchedAt: hst(7).getTime(), ...over }),
    back: undefined,
    loading: false,
    failed: false,
  });

  it("gives crashes, police reports, closures and roadwork their own pin kind", () => {
    const at = { lat: 21.33, lon: -157.9 };
    const c = check({
      incidents: [
        { id: "a", description: "x", delayMinutes: null, road: "H-1", category: "1", points: [at] },
        {
          id: "b",
          description: "x",
          delayMinutes: null,
          road: null,
          category: "6",
          source: "hpd",
          points: [at],
        },
        { id: "c", description: "x", delayMinutes: null, road: "H-1", category: "8", points: [at] },
        { id: "d", description: "x", delayMinutes: null, road: "H-1", category: "9", points: [at] },
      ],
    });
    expect(incidentPins([c], hst(7).getTime()).map((p) => p.kind)).toEqual([
      "crash",
      "police",
      "closure",
      "roadwork",
    ]);
  });

  it("states only what the provider gave: level, delay, source and age", () => {
    const c = check({
      delayMinutes: 7,
      trafficSections: [{ severity: "heavy", delayMinutes: 6, points: pts }],
    });
    const line = roadLines([c])[0]!;
    const card = trafficCard([c], line, 0, hst(7, 5).getTime())!;
    expect(card.title).toBe("H-1 eastbound");
    expect(card.level).toBe("Heavy traffic");
    expect(card.facts).toEqual(["+6 min on this stretch", "+7 min over usual on the whole route"]);
    expect(card.source).toBe("TomTom · live · updated 5 min ago");
    expect(card.between).toBeNull();
  });

  it("says there is no usual-time comparison instead of inventing a delay", () => {
    const c = check({ typicalChecked: false, provider: "mapbox", delayMinutes: 0 });
    const line = roadLines([c])[0]!;
    const card = trafficCard([c], line, null, hst(7).getTime())!;
    expect(card.facts).toEqual([]);
    expect(card.level).toBeNull();
    expect(card.source).toContain("Mapbox · live, no usual-time comparison");
  });
});
