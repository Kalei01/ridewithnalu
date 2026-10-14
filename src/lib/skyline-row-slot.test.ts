import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  mergeTransitOptions,
  mergeTransitOptionsWith,
  type Leg,
  type Option,
} from "./commute-model";
import { transitChoices } from "./trip-choices";

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
});
