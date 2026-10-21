import { describe, expect, it } from "vitest";
import type { DriveIncident, DriveTime } from "./drive.functions";
import { matchRoutePoint, metersBetween, speakableRoad, type Maneuver } from "./navigation-voice";
import {
  CommitmentMemory,
  ExitDeclineWatcher,
  NAV_TRANSIT_REPLAN_MS,
  REPROPOSE_AFTER_MS,
  comparePaths,
  differentCorridor,
  isExitLike,
  roadAheadFromHistory,
  spokenMinutes,
  minutesText,
  proposalMessage,
  requiredSavingMinutes,
  resolveLiveRoute,
  stayingMessage,
  throttledPlanMinute,
} from "./route-commitment";

// Flat test world near Honolulu: x metres east, y metres north.
const LAT0 = 21.38;
const LON0 = -157.9;
const pt = (x: number, y: number) => ({
  lat: LAT0 + y / 111_320,
  lon: LON0 + x / (111_320 * Math.cos((LAT0 * Math.PI) / 180)),
});
const line = (pts: Array<[number, number]>) => pts.map(([x, y]) => pt(x, y));
/** H-1 West: from x=0 heading west (x decreasing) along y=0. */
const h1 = (toX = -12_000) => {
  const out: Array<[number, number]> = [];
  for (let x = 0; x >= toX; x -= 100) out.push([x, 0]);
  return line(out);
};
/** Leaves H-1 at x=-2000 on a ramp (8 degrees), runs 300 m south of it, rejoins at x=-8000. */
const detour = () => {
  const pts: Array<[number, number]> = [];
  for (let x = 0; x > -2000; x -= 100) pts.push([x, 0]);
  for (let k = 0; k <= 6; k += 1) pts.push([-2000 - 100 * k, -(300 / 6) * k]);
  for (let x = -2700; x > -7400; x -= 100) pts.push([x, -300]);
  for (let k = 0; k <= 6; k += 1) pts.push([-7400 - 100 * k, -300 + 50 * k]);
  for (let x = -8100; x >= -12_000; x -= 100) pts.push([x, 0]);
  return line(pts);
};

function man(
  x: number,
  y: number,
  maneuver: string,
  road: string | null,
  instruction = "",
): Maneuver {
  return { ...pt(x, y), maneuver, road, instruction: instruction || `${maneuver} ${road ?? ""}` };
}

function drive(
  over: Partial<DriveTime> & { path: DriveTime["path"]; trafficMinutes: number },
): DriveTime {
  return {
    typicalMinutes: over.trafficMinutes,
    delayMinutes: 0,
    lowMinutes: over.trafficMinutes,
    highMinutes: over.trafficMinutes,
    meters: 12_000,
    trafficSections: [],
    incidents: [],
    corridorLabel: null,
    corridorRoads: [],
    bypassedRoads: [],
    maneuvers: [],
    fetchedAt: 0,
    trafficBasis: "live",
    ...over,
  } as DriveTime;
}

const onH1 = () =>
  drive({
    path: h1(),
    trafficMinutes: 30,
    corridorLabel: "Via H-1 West",
    corridorRoads: ["H-1 West"],
    maneuvers: [man(-12_000, 0, "ARRIVE", null)],
  });
const viaKamehameha = (minutes: number, road = "Kamehameha Hwy") =>
  drive({
    path: detour(),
    trafficMinutes: minutes,
    corridorLabel: `Via ${road}`,
    corridorRoads: [road],
    maneuvers: [
      man(
        -2000,
        0,
        "EXIT_MOTORWAY_RIGHT",
        "Kamehameha Hwy",
        "Take the exit on the right onto Kamehameha Hwy",
      ),
      man(-12_000, 0, "ARRIVE", null),
    ],
  });
const stayPriced = (minutes: number, over: Partial<DriveTime> = {}) =>
  drive({ ...onH1(), trafficMinutes: minutes, ...over });

const rider = pt(0, 0);

function resolve(
  committed: DriveTime | null,
  fresh: DriveTime,
  stay: DriveTime | null,
  extra: Partial<Parameters<typeof resolveLiveRoute>[0]> = {},
) {
  const calls: Array<Array<{ lat: number; lon: number }>> = [];
  const memory = extra.memory ?? new CommitmentMemory();
  const promise = resolveLiveRoute({
    fresh,
    committed,
    rider,
    bearing: 270,
    memory,
    now: 1_000_000,
    declined: null,
    reroute: false,
    fetchVia: async (via) => {
      calls.push(via);
      return stay;
    },
    ...extra,
  });
  return promise.then((r) => ({ ...r, calls, memory }));
}

const NB = " ";
const history = [h1()];

describe("saving bar", () => {
  it("is 5 minutes, or 15% of the time left when that is more", () => {
    expect(requiredSavingMinutes(20)).toBe(5);
    expect(requiredSavingMinutes(33)).toBe(5);
    expect(requiredSavingMinutes(60)).toBeCloseTo(9);
    expect(requiredSavingMinutes(100)).toBeCloseTo(15);
  });
});

describe("corridor comparison", () => {
  it("treats the same road as the same corridor", () => {
    expect(differentCorridor(comparePaths(h1(), h1()))).toBe(false);
  });
  it("finds where a detour leaves the road, and where it rejoins", () => {
    const cmp = comparePaths(h1(), detour());
    expect(differentCorridor(cmp)).toBe(true);
    expect(cmp.apartFromAlongM).toBeGreaterThan(1900);
    expect(cmp.apartFromAlongM).toBeLessThan(2500);
    expect(cmp.apartToAlongM).toBeGreaterThan(7500);
    expect(cmp.apartToAlongM).toBeLessThan(9200);
  });
});

describe("route stickiness", () => {
  it("takes the first route and any refresh that stays on the same road", async () => {
    expect((await resolve(null, viaKamehameha(20), null)).meta.outcome).toBe("accept");
    const same = await resolve(onH1(), stayPriced(28), null);
    expect(same.meta.outcome).toBe("accept");
    expect(same.calls).toHaveLength(0);
  });

  it("keeps the current road when the other way saves under 5 minutes, using the live stay route", async () => {
    const stay = stayPriced(30);
    const r = await resolve(onH1(), viaKamehameha(26), stay);
    expect(r.meta).toMatchObject({ outcome: "keep", savesMin: 4, why: "below-bar" });
    // the refreshed route for her own road, not the stale one on screen
    expect(r.route).toMatchObject({ trafficMinutes: 30, corridorLabel: stay.corridorLabel });
  });

  it("carries the committed route's delay onto a priced stay route (no zero delay, no false spike)", async () => {
    const committed = drive({
      ...onH1(),
      delayMinutes: 8,
      typicalMinutes: 22,
      typicalChecked: true,
    });
    const stay = stayPriced(30, { delayMinutes: 0, typicalMinutes: 30, typicalChecked: false });
    const r = await resolve(committed, viaKamehameha(27), stay);
    expect(r.meta.outcome).toBe("keep");
    expect(r.route).toMatchObject({
      trafficMinutes: 30,
      delayMinutes: 8,
      typicalMinutes: 22,
      typicalChecked: true,
    });
  });

  it("needs 15% of the time left on a long trip (10 of 80 is not enough, 12 is)", async () => {
    const stay = stayPriced(80);
    expect((await resolve(onH1(), viaKamehameha(70), stay)).meta.outcome).toBe("keep");
    const r = await resolve(onH1(), viaKamehameha(68), stay);
    expect(r.meta.outcome).toBe("propose");
  });

  it("compares like with like: prices the whole current road, sent as the path to follow", async () => {
    const r = await resolve(onH1(), viaKamehameha(20), stayPriced(30));
    expect(r.calls).toHaveLength(1);
    const via = r.calls[0]!;
    expect(via.length).toBeGreaterThan(20);
    expect(via.length).toBeLessThanOrEqual(380);
    for (const p of via) expect(matchRoutePoint(p, h1())!.distanceM).toBeLessThan(5);
    // from near the rider all the way to the end of the road
    expect(metersBetween(via[0]!, pt(0, 0))).toBeLessThan(400);
    expect(metersBetween(via[via.length - 1]!, pt(-12_000, 0))).toBeLessThan(400);
  });

  it("proposes with the reason from the differing stretch and a natural spoken line", async () => {
    const incident: DriveIncident = {
      description: "Accident",
      road: "H-1 West",
      delayMinutes: 9,
      category: "accident",
      from: "ʻAiea",
      to: null,
      points: [pt(-4000, 0)],
    };
    const r = await resolve(onH1(), viaKamehameha(23), stayPriced(30, { incidents: [incident] }));
    expect(r.meta.outcome).toBe("propose");
    if (r.meta.outcome !== "propose") return;
    expect(r.meta.savesMin).toBe(7);
    expect(r.meta.hud).toBe(`Via Kamehameha Hwy — saves 7${NB}min. Accident on H-1 near ʻAiea.`);
    expect(r.meta.spoken).toBe(
      `Faster via Kamehameha Highway, saves 7 minutes. ${speakableRoad("Accident on H-1 near ʻAiea")}.`,
    );
    expect(r.meta.spoken).not.toContain("—");
    expect(r.route.corridorLabel).toBe("Via Kamehameha Hwy");
  });

  it("ignores an incident on road both routes share", async () => {
    const shared: DriveIncident = {
      description: "Accident",
      road: "H-1 West",
      delayMinutes: 9,
      category: "accident",
      points: [pt(-500, 0)],
    };
    const r = await resolve(onH1(), viaKamehameha(22), stayPriced(30, { incidents: [shared] }));
    expect(r.meta.outcome === "propose" && r.meta.reason).toBeNull();
  });

  it("names a delayed stretch when there is no incident, and never invents a reason", async () => {
    const slow = stayPriced(30, {
      trafficSections: [
        { severity: "heavy", delayMinutes: 8, points: [pt(-3000, 0), pt(-3400, 0)] },
      ],
      maneuvers: [man(-100, 0, "KEEP_LEFT", "H-1 West"), man(-12_000, 0, "ARRIVE", null)],
    });
    const r = await resolve(onH1(), viaKamehameha(22), slow);
    expect(r.meta.outcome === "propose" && r.meta.reason).toBe("Heavy traffic on H-1");
    const sharedJam = stayPriced(30, {
      trafficSections: [{ severity: "heavy", delayMinutes: 8, points: [pt(-500, 0), pt(-900, 0)] }],
      maneuvers: [man(-100, 0, "KEEP_LEFT", "H-1 West"), man(-12_000, 0, "ARRIVE", null)],
    });
    const none = await resolve(onH1(), viaKamehameha(22), sharedJam);
    expect(none.meta.outcome === "propose" && none.meta.reason).toBeNull();
    expect(none.meta.outcome === "propose" && none.meta.hud).toBe(
      `Via Kamehameha Hwy — saves 8${NB}min.`,
    );
  });

  it("uses 'hr' once a time passes an hour", () => {
    expect(minutesText(61)).toBe(`1${NB}hr${NB}1${NB}min`);
    expect(spokenMinutes(61)).toBe("1 hour 1 minute");
    expect(spokenMinutes(1)).toBe("1 minute");
  });

  it("fails toward the fresh route when staying cannot be priced (a closure ahead must reroute her)", async () => {
    const closure: DriveIncident = {
      description: "Road closed",
      road: "H-1 West",
      category: "roadClosed",
      delayMinutes: null,
      points: [pt(-4000, 0)],
    };
    // the committed road has a closure; staying can't be priced; fresh goes around it
    const committed = drive({ ...onH1(), incidents: [closure] });
    const r = await resolve(committed, viaKamehameha(35), null);
    expect(r.meta).toMatchObject({ outcome: "accept", unpriced: true });
    expect(r.route.corridorLabel).toBe("Via Kamehameha Hwy");
  });

  it("fails toward the fresh route when the priced 'stay' route wandered off the road", async () => {
    const r = await resolve(onH1(), viaKamehameha(20), viaKamehameha(40));
    expect(r.meta).toMatchObject({ outcome: "accept", unpriced: true });
    expect(r.route.corridorLabel).toBe("Via Kamehameha Hwy");
  });

  it("does not ask again for a detour whose staying price just failed, and never more than once per gap", async () => {
    const memory = new CommitmentMemory();
    const first = await resolve(onH1(), viaKamehameha(20), null, { memory, now: 1_000_000 });
    expect(first.calls).toHaveLength(1);
    expect(first.meta.outcome).toBe("accept");
    const again = await resolve(onH1(), viaKamehameha(20), null, { memory, now: 1_030_000 });
    expect(again.calls).toHaveLength(0);
    expect(again.meta.outcome).toBe("accept");
    // a different detour inside the gap waits for the next refresh and leaves the route alone
    const other = await resolve(onH1(), viaKamehameha(20, "Farrington Hwy"), null, {
      memory,
      now: 1_040_000,
    });
    expect(other.calls).toHaveLength(0);
    expect(other.meta).toMatchObject({ outcome: "keep", why: "rate-limited" });
  });

  it("follows a real reroute without comparing", async () => {
    const r = await resolve(onH1(), viaKamehameha(20), null, { reroute: true });
    expect(r.meta.outcome).toBe("accept");
    expect(r.calls).toHaveLength(0);
  });

  it("does not compare when she is nowhere near the route on screen", async () => {
    const r = await resolve(onH1(), viaKamehameha(20), null, { rider: pt(0, 800) });
    expect(r.meta.outcome).toBe("accept");
  });
});

describe("respecting a declined detour", () => {
  it("does not re-propose the same detour for 10 minutes, then may again", async () => {
    const memory = new CommitmentMemory();
    memory.recordProposal("Kamehameha Hwy", 7);
    memory.recordDecline("Kamehameha Hwy", 1_000_000);
    const soon = await resolve(onH1(), viaKamehameha(23), stayPriced(30), {
      memory,
      now: 1_000_000 + 60_000,
    });
    expect(soon.meta).toMatchObject({ outcome: "keep", why: "declined" });
    const later = await resolve(onH1(), viaKamehameha(23), stayPriced(30), {
      memory,
      now: 1_000_000 + REPROPOSE_AFTER_MS + 1,
    });
    expect(later.meta.outcome).toBe("propose");
  });

  it("re-proposes early only when the saving grew by 5+ minutes", async () => {
    const memory = new CommitmentMemory();
    memory.recordProposal("Kamehameha Hwy", 7);
    memory.recordDecline("Kamehameha Hwy", 1_000_000);
    const grew4 = await resolve(onH1(), viaKamehameha(19), stayPriced(30), {
      memory,
      now: 1_060_000,
    });
    expect(grew4.meta).toMatchObject({ outcome: "keep", why: "declined", savesMin: 11 });
    const grew5 = await resolve(onH1(), viaKamehameha(18), stayPriced(30), {
      memory,
      now: 1_200_000,
    });
    expect(grew5.meta.outcome).toBe("propose");
  });

  it("switches to her own road, taken from a route she was already given, not her heading", async () => {
    const stay = stayPriced(34);
    const r = await resolve(null, viaKamehameha(30), stay, {
      declined: { road: "Kamehameha Hwy", onRoad: "H-1 West", remainingMin: 30 },
      roadHistory: history,
    });
    expect(r.route).toBe(stay);
    expect(r.meta).toMatchObject({ outcome: "declined-stay", road: "H-1", plusMin: 4 });
    if (r.meta.outcome !== "declined-stay") return;
    expect(r.meta.hud).toBe(`Staying on H-1 — about +4${NB}min.`);
    expect(r.meta.spoken).toBe("Staying on H 1. About 4 minutes longer.");
    // waypoints lie on the history route, ahead of her
    for (const p of r.calls[0]!) expect(matchRoutePoint(p, h1())!.distanceM).toBeLessThan(5);
    expect(r.memory.quietRoads(1_000_001)).toContain("kamehameha hwy");
  });

  it("never invents her road from her heading: with no known road ahead it follows the fresh route", async () => {
    const r = await resolve(null, viaKamehameha(30), stayPriced(34), {
      declined: { road: "Kamehameha Hwy", onRoad: "H-1 West", remainingMin: 30 },
      roadHistory: [detour()],
    });
    expect(r.calls).toHaveLength(0);
    expect(r.meta.outcome).toBe("declined-fallback");
    expect(r.route.corridorLabel).toBe("Via Kamehameha Hwy");
  });

  it("uses the fresh route when it already continues on her road, without a second request", async () => {
    const r = await resolve(null, onH1(), null, {
      declined: { road: "Kamehameha Hwy", onRoad: null, remainingMin: 30 },
    });
    expect(r.calls).toHaveLength(0);
    expect(r.meta).toMatchObject({ outcome: "declined-stay", road: "H-1", plusMin: 0 });
    if (r.meta.outcome === "declined-stay") expect(r.meta.hud).toBe("Staying on H-1.");
  });

  it("falls back to the fresh route when a 'stay' price is not usable", async () => {
    const r = await resolve(null, viaKamehameha(30), viaKamehameha(31), {
      declined: { road: "Kamehameha Hwy", onRoad: "H-1", remainingMin: 30 },
      roadHistory: history,
    });
    expect(r.meta.outcome).toBe("declined-fallback");
  });

  it("history route that goes down the declined exit is not her road", () => {
    const rampPoint = pt(-2400, -200);
    expect(roadAheadFromHistory([detour()], pt(0, 0), 270, rampPoint)).toBeNull();
    expect(roadAheadFromHistory([h1()], pt(0, 0), 270, rampPoint)).not.toBeNull();
    // wrong way / far away routes are not her road either
    expect(roadAheadFromHistory([h1()], pt(0, 0), 90, rampPoint)).toBeNull();
    expect(roadAheadFromHistory([h1()], pt(0, 400), 270, rampPoint)).toBeNull();
  });

  it("keeps pricing her road when a later refresh pushes the declined exit again", async () => {
    const memory = new CommitmentMemory();
    memory.recordDecline("Kamehameha Hwy", 1_000_000);
    const stay = stayPriced(31);
    const r = await resolve(stay, viaKamehameha(27), stay, {
      memory,
      now: 1_120_000,
      roadHistory: history,
    });
    expect(r.meta).toMatchObject({ outcome: "keep", why: "below-bar" });
    expect(r.calls[0]!.length).toBeGreaterThan(0);
  });
});

describe("wording", () => {
  it("formats the proposal and the stay line", () => {
    expect(proposalMessage({ via: null, savesMin: 6, reason: null }).hud).toBe(`Saves 6${NB}min.`);
    expect(stayingMessage(null, 3).hud).toBe(`Staying on your road — about +3${NB}min.`);
    expect(stayingMessage("H-1", 61).hud).toBe(`Staying on H-1 — about +1${NB}hr${NB}1${NB}min.`);
  });
});

// ---- Declined-exit detection with real-looking ramps -------------------------

/** Ramp geometry at 12 m spacing: heading turns from `from` to `to` degrees over `lengthM`, right-hand. */
function ramp(start: [number, number], fromDeg: number, toDeg: number, lengthM: number) {
  const pts: Array<[number, number]> = [];
  let [x, y] = start;
  const steps = Math.round(lengthM / 12);
  for (let i = 1; i <= steps; i += 1) {
    const heading = ((fromDeg + ((toDeg - fromDeg) * i) / steps) * Math.PI) / 180;
    x += 12 * Math.sin(heading);
    y += 12 * Math.cos(heading);
    pts.push([x, y]);
  }
  return pts;
}

describe("noticing a declined exit", () => {
  const exitAt: [number, number] = [-2000, 0];
  // Her route: H-1 West to x=-2000, then a right-hand ramp that curves from 285 to 345 degrees.
  const curved = ramp(exitAt, 285, 345, 500);
  const loop = ramp(exitAt, 285, 285 + 270, 380);
  const mainline: Array<[number, number]> = [];
  for (let x = 0; x > -2000; x -= 100) mainline.push([x, 0]);

  function setup(rampPts: Array<[number, number]>) {
    const exit: Maneuver = {
      ...man(-2000, 0, "EXIT_MOTORWAY_RIGHT", "Kamehameha Hwy"),
      ahead: line(rampPts),
    };
    const thin = line([...mainline, exitAt, ...rampPts.filter((_, i) => i % 8 === 7)]);
    return { exit, path: thin, maneuvers: [exit, man(-6000, -300, "ARRIVE", null)] };
  }

  function run(
    rampPts: Array<[number, number]>,
    track: (distM: number) => [number, number],
    speed: number,
    heading: (distM: number) => number,
    accuracyM = 8,
  ) {
    const { path, maneuvers } = setup(rampPts);
    const watcher = new ExitDeclineWatcher();
    let previous: number | null = null;
    const stepM = Math.max(4, speed * 1.5);
    for (let d = -400; d <= 900; d += stepM) {
      const [x, y] = track(d);
      const at = pt(x, y);
      const match = matchRoutePoint(at, path, previous);
      previous = match ? match.segmentIndex : null;
      const hit = watcher.observe({
        maneuvers,
        path,
        match,
        rider: at,
        accuracyM,
        speedMps: speed,
        heading: heading(d),
      });
      if (hit) return d;
    }
    return null;
  }

  // d = metres driven relative to the exit point (negative: before it)
  const straight = (d: number): [number, number] => [-2000 - d, 0];
  const onRamp =
    (pts: Array<[number, number]>, offsetM = 0) =>
    (d: number): [number, number] => {
      if (d <= 0) return [-2000 - d, offsetM];
      const i = Math.min(pts.length - 1, Math.max(0, Math.round(d / 12) - 1));
      const p = pts[i]!;
      return [p[0], p[1] + offsetM];
    };

  it("recognises exit-like maneuvers only", () => {
    expect(isExitLike({ maneuver: "EXIT_MOTORWAY_RIGHT" })).toBe(true);
    expect(isExitLike({ maneuver: "MOTORWAY_EXIT_LEFT" })).toBe(true);
    expect(isExitLike({ maneuver: "TURN_RIGHT" })).toBe(false);
    expect(isExitLike({ maneuver: "ARRIVE" })).toBe(false);
  });

  it("flags a rider who stays on the freeway past a curving ramp, crawling at 2 m/s", () => {
    const d = run(curved, straight, 2, () => 270);
    expect(d).not.toBeNull();
    expect(d!).toBeLessThan(700);
  });

  it("flags it at freeway speed (apart AND heading away)", () => {
    const d = run(curved, straight, 20, () => 270);
    expect(d).not.toBeNull();
  });

  it("does not flag a slow rider who takes the curving ramp, even with 15 m of GPS drift", () => {
    expect(run(curved, onRamp(curved, 15), 2, () => 310, 12)).toBeNull();
    expect(run(curved, onRamp(curved, -15), 2, () => 310, 12)).toBeNull();
  });

  it("does not flag a rider who takes a tight looping ramp, slow or fast", () => {
    expect(run(loop, onRamp(loop, 10), 3, () => 330)).toBeNull();
    expect(run(loop, onRamp(loop, -10), 12, () => 330)).toBeNull();
  });

  it("flags a rider who ignores a looping ramp and stays on the road", () => {
    expect(run(loop, straight, 15, () => 270)).not.toBeNull();
  });

  it("needs three clear fixes, not one stray reading", () => {
    const { path, maneuvers } = setup(curved);
    const watcher = new ExitDeclineWatcher();
    let previous: number | null = null;
    const hits: boolean[] = [];
    const track = onRamp(curved);
    for (let d = 100; d < 400; d += 12) {
      const [x, y] = track(d);
      const at = d === 244 ? pt(x, y - 90) : pt(x, y); // one wild fix
      const match = matchRoutePoint(at, path, previous);
      previous = match ? match.segmentIndex : null;
      hits.push(
        Boolean(
          watcher.observe({
            maneuvers,
            path,
            match,
            rider: at,
            accuracyM: 8,
            speedMps: 10,
            heading: 330,
          }),
        ),
      );
    }
    expect(hits.some(Boolean)).toBe(false);
  });

  it("does not flag a rider still before the exit, even in an offset lane", () => {
    expect(
      run(
        curved,
        (d) => [-2000 - Math.min(d, 60), 30],
        20,
        () => 270,
      ),
    ).toBeNull();
  });

  it("ignores poor GPS", () => {
    expect(run(curved, straight, 2, () => 270, 60)).toBeNull();
  });

  it("speaks of a declined exit once", () => {
    const { path, maneuvers } = setup(curved);
    const watcher = new ExitDeclineWatcher();
    let previous: number | null = null;
    let hits = 0;
    for (let d = -200; d < 900; d += 15) {
      const at = pt(...straight(d));
      const match = matchRoutePoint(at, path, previous);
      previous = match ? match.segmentIndex : null;
      if (
        watcher.observe({
          maneuvers,
          path,
          match,
          rider: at,
          accuracyM: 8,
          speedMps: 10,
          heading: 270,
        })
      )
        hits += 1;
    }
    expect(hits).toBe(1);
  });

  it("still works on an older route with no ramp points (coarse line)", () => {
    const { path, exit } = setup(curved);
    const bare: Maneuver = { ...exit };
    delete bare.ahead;
    const watcher = new ExitDeclineWatcher();
    let previous: number | null = null;
    let hit = false;
    for (let d = -200; d < 900; d += 15) {
      const at = pt(...straight(d));
      const match = matchRoutePoint(at, path, previous);
      previous = match ? match.segmentIndex : null;
      if (
        watcher.observe({
          maneuvers: [bare],
          path,
          match,
          rider: at,
          accuracyM: 8,
          speedMps: 3,
          heading: 270,
        })
      )
        hit = true;
    }
    expect(hit).toBe(true);
  });
});

describe("background transit re-planning while navigating", () => {
  it("follows the live minute when not navigating", () => {
    const a = throttledPlanMinute(null, 36_000, 0, false);
    expect(throttledPlanMinute(a, 36_060, 60_000, false).value).toBe(36_060);
  });
  it("moves at most every 5 minutes while navigating", () => {
    let s = throttledPlanMinute(null, 36_000, 0, true);
    for (let min = 1; min < 5; min += 1) {
      s = throttledPlanMinute(s, 36_000 + 60 * min, min * 60_000, true);
      expect(s.value).toBe(36_000);
    }
    s = throttledPlanMinute(s, 36_300, NAV_TRANSIT_REPLAN_MS, true);
    expect(s.value).toBe(36_300);
  });
  it("catches up immediately when navigation ends and survives midnight", () => {
    const held = { value: 36_000, at: 0 };
    expect(throttledPlanMinute(held, 36_120, 120_000, false).value).toBe(36_120);
    expect(throttledPlanMinute({ value: 86_300, at: 0 }, 60, 120_000, true).value).toBe(60);
  });
});
