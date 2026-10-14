import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  mergeTransitOptions,
  mergeTransitOptionsWith,
  type Leg,
  type Option,
} from "./commute-model";
import { transitChoices } from "./trip-choices";
import { collectArriveByOptions } from "./rail/arrive-by-search";

/**
 * Skyline "no trip" alert (docs/maintenance/alerts.md, Oct 7–13): the 8-option
 * cap kept 7 plain bus trips and one bus → bus transfer, so every drive +
 * Skyline trip fell off and the Skyline row said "No Skyline trip" when there
 * was one. Real database answers, Kapolei → downtown at 4:30 PM.
 */
const replay = JSON.parse(
  readFileSync(new URL("./fixtures/skyline-cap-kapolei-1630.json", import.meta.url), "utf8"),
) as { dropOffStops: string[]; groups: Option[][] };
const rides = (o: Option) => o.legs.some((leg) => leg.mode === "rail");
const leg = (mode: Leg["mode"], a: number, b: number, route: string | null = null): Leg => ({
  kind: mode === "rail" ? "rail" : mode === "walk" ? "access" : "connect",
  mode,
  route_short: route,
  route_long: null,
  headsign: null,
  from: "A",
  to: "B",
  depart_seconds: a,
  arrive_seconds: b,
  minutes: Math.round((b - a) / 60),
});
const trip = (legs: Leg[]): Option => ({
  leave_by_seconds: legs[0]!.depart_seconds!,
  depart_seconds: legs[0]!.depart_seconds!,
  arrive_seconds: legs.at(-1)!.arrive_seconds!,
  total_minutes: Math.round((legs.at(-1)!.arrive_seconds! - legs[0]!.depart_seconds!) / 60),
  legs,
});
const merged = () =>
  mergeTransitOptionsWith({ dropOffStops: new Set(replay.dropOffStops) }, ...replay.groups);

describe("every row keeps its best trip through the option cap", () => {
  it("Kapolei → downtown 4:30 PM: the Skyline row gets a trip", () => {
    const options = merged();
    expect(options.some(rides)).toBe(true);
    const { skyline, bus } = transitChoices(options, null);
    expect(skyline.option).not.toBeNull();
    // The best Skyline trip in the planner's own order: drive + Skyline + Bus 1L, arriving 5:46 PM.
    expect(skyline.option?.legs.map((leg) => leg.route_short || leg.mode)).toEqual([
      "drive",
      "rail",
      "1L",
      "walk",
    ]);
    expect(skyline.option?.arrive_seconds).toBe(17 * 3600 + 46 * 60);
    expect(skyline.option?.extraTransfers).toBe(true);
    // The bus row and the pick are unchanged: still the 5:36 PM Bus C.
    expect(bus.option?.legs.map((leg) => leg.route_short || leg.mode)).toEqual([
      "walk",
      "C",
      "walk",
    ]);
    expect(options[0]).toBe(bus.option);
  });

  it("nothing kept before is dropped: the slot is added on top of the 8", () => {
    const options = merged();
    const busOnly = mergeTransitOptionsWith(
      { dropOffStops: new Set(replay.dropOffStops) },
      ...replay.groups.map((group) => group.filter((o) => !rides(o))),
    );
    expect(options).toHaveLength(9);
    expect(options.filter((o) => !rides(o))).toEqual(busOnly);
  });

  it("merging the result again keeps the Skyline trip", () => {
    const again = mergeTransitOptions(merged(), []);
    expect(again.some(rides)).toBe(true);
  });

  it("the bus row is not starved by many Skyline trips either", () => {
    const t = 25200;
    const skylineTrips = Array.from({ length: 9 }, (_, i) =>
      trip([
        leg("walk", t + i * 600, t + i * 600 + 300),
        leg("rail", t + i * 600 + 300, t + i * 600 + 2400),
      ]),
    );
    const slowBus = trip([leg("walk", t, t + 300), leg("bus", t + 300, t + 9000, "C")]);
    const options = mergeTransitOptions(skylineTrips, [slowBus]);
    expect(transitChoices(options, null).bus.option?.legs[1]?.route_short).toBe("C");
    expect(transitChoices(options, null).skyline.option).toBe(options[0]);
  });

  it("Arrive By keeps paging past a row's extra trip and finds the latest bus that makes it", async () => {
    // A bus every 10 min (5 min walk, 1 hr ride) and one walk + Skyline trip at 7:20 → 8:05; arrive by 8:00.
    const target = 8 * 3600;
    const buses = Array.from({ length: 30 }, (_, i) => {
      const go = 4 * 3600 + i * 600;
      return trip([leg("walk", go, go + 300), leg("bus", go + 300, go + 3900, "C")]);
    });
    const skyline = trip([
      leg("walk", 7 * 3600 + 1200, 7 * 3600 + 1500),
      leg("rail", 7 * 3600 + 1500, 8 * 3600 + 300),
    ]);
    const result = await collectArriveByOptions({
      nowSeconds: 4 * 3600,
      targetSeconds: target,
      fetchPage: async (after) =>
        mergeTransitOptions(
          buses.filter((o) => o.depart_seconds >= after),
          skyline.depart_seconds >= after ? [skyline] : [],
        ),
    });
    expect(result.complete).toBe(true);
    const { bus } = transitChoices(result.options, target);
    expect(bus.makesIt).toBe(true);
    // The 6:50 bus (arrives 7:55), not one hours earlier.
    expect(bus.option?.depart_seconds).toBe(6 * 3600 + 50 * 60);
  });
});
