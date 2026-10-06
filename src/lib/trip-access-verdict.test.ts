import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { decideTrip } from "./decision/commute-decision";
import { driveEstimate, transitEstimate, type TripEstimate } from "./decision/trip-estimate";
import { accessResources, carTripAvailable, type TripAccess } from "./trip-access";
import { transitChoices, usesSkyline } from "./trip-choices";
import type { Option } from "./commute-model";

/**
 * The trip question only tells Nalu whether a car may be considered. It must
 * never decide the winner: the same trips are compared either way, and only
 * the car's availability differs.
 */
const nowMs = Date.parse("2026-09-28T16:00:00-10:00");
beforeAll(() => {
  vi.useFakeTimers();
  vi.setSystemTime(nowMs);
});
afterAll(() => vi.useRealTimers());

const at = (minute: number) => 6 * 3600 + minute * 60;
const none = { label: "parking not included", lowMin: 0, typicalMin: 0, highMin: 0 };

/** The drive estimate exactly as the trip screen builds it from the answer. */
function driveFor(access: TripAccess, minutes: number): TripEstimate {
  return driveEstimate({
    drive: {
      trafficMinutes: minutes,
      lowMinutes: minutes,
      highMinutes: minutes,
      delayMinutes: 0,
      fetchedAt: nowMs,
      trafficBasis: "live",
    },
    access: none,
    nowSeconds: at(0),
    nowMs,
    carAvailable: carTripAvailable(accessResources(access)),
  });
}

type Mode = "walk" | "bus" | "rail";
const leg = (mode: Mode, from: number, to: number, route: string | null = null) => ({
  kind: mode === "rail" ? ("rail" as const) : ("connect" as const),
  mode,
  route_short: route,
  route_long: null,
  headsign: null,
  from: "A",
  to: "B",
  depart_seconds: at(from),
  arrive_seconds: at(to),
  minutes: to - from,
});
const trip = (arrive: number, legs: ReturnType<typeof leg>[]): Option => ({
  leave_by_seconds: at(0),
  depart_seconds: at(2),
  arrive_seconds: at(arrive),
  total_minutes: arrive,
  legs,
});

// Three real kinds of car-free trip the planner supports.
const directBus = (arrive: number) =>
  trip(arrive, [leg("walk", 0, 4), leg("bus", 5, arrive - 3, "W")]);
const skyline = (arrive: number) =>
  trip(arrive, [leg("walk", 0, 8), leg("rail", 9, arrive - 4), leg("walk", arrive - 4, arrive)]);
const busThenSkyline = (arrive: number) =>
  trip(arrive, [
    leg("walk", 0, 3),
    leg("bus", 4, 20, "52"),
    leg("rail", 24, arrive - 6),
    leg("bus", arrive - 5, arrive, "42"),
  ]);

const transit = (option: Option) =>
  transitEstimate({ option, nowSeconds: at(0), nowMs, scheduleFetchedAt: nowMs });
const verdict = (access: TripAccess, driveMinutes: number, option: Option) =>
  decideTrip(driveFor(access, driveMinutes), transit(option)).state;

describe("Include driving or drop-off: a constraint, not a result", () => {
  it("Drive wins when driving is best", () => {
    expect(verdict("vehicle", 30, skyline(60))).toBe("drive");
    expect(verdict("vehicle", 30, directBus(70))).toBe("drive");
  });

  it("Skyline still wins when it is better than driving", () => {
    const best = skyline(40);
    expect(verdict("vehicle", 70, best)).toBe("transit");
    expect(usesSkyline(best)).toBe(true);
    expect(transitChoices([best, directBus(90)], null).skyline.option).toBe(best);
  });

  it("Bus still wins when it is better than driving", () => {
    const best = directBus(38);
    expect(verdict("vehicle", 70, best)).toBe("transit");
    expect(usesSkyline(best)).toBe(false);
    expect(transitChoices([best], null).bus.option).toBe(best);
  });

  it("a Bus → Skyline combination can win too", () => {
    expect(verdict("vehicle", 90, busThenSkyline(50))).toBe("transit");
  });

  it("keeps both car-free kinds in the comparison alongside driving", () => {
    expect(driveFor("vehicle", 30).availability).toBe("available");
    const rows = transitChoices([skyline(45), directBus(50)], null);
    expect(rows.skyline.option).not.toBeNull();
    expect(rows.bus.option).not.toBeNull();
  });
});

describe("No driving — bus, rail & walking: the car is out, nothing else is", () => {
  it("Drive can never be the verdict, however fast driving would be", () => {
    expect(driveFor("bus", 10).availability).toBe("car-unavailable");
    for (const option of [directBus(80), skyline(80), busThenSkyline(80)])
      expect(verdict("bus", 10, option)).toBe("transit");
  });

  it("direct Bus, Skyline and Bus → Skyline can each be the best itinerary", () => {
    // Which one is best is the planner's call; each is a valid result.
    expect(
      transitChoices([directBus(40), skyline(60), busThenSkyline(70)], null).bus.option
        ?.arrive_seconds,
    ).toBe(at(40));
    expect(
      transitChoices([skyline(40), directBus(60), busThenSkyline(70)], null).skyline.option
        ?.arrive_seconds,
    ).toBe(at(40));
    const combo = busThenSkyline(40);
    expect(transitChoices([combo, directBus(60)], null).skyline.option).toBe(combo);
  });

  it("with no transit trip at all, the answer is 'no trip', never Drive", () => {
    const noTransit = transitEstimate({
      option: null,
      nowSeconds: at(0),
      nowMs,
      scheduleFetchedAt: nowMs,
    });
    expect(decideTrip(driveFor("bus", 10), noTransit).state).toBe("none");
  });
});

describe("the answer changes only whether a car is allowed", () => {
  it("gives the same verdict for the same trips when driving would lose either way", () => {
    for (const option of [directBus(40), skyline(40), busThenSkyline(45)]) {
      expect(verdict("vehicle", 90, option)).toBe("transit");
      expect(verdict("bus", 90, option)).toBe("transit");
    }
  });

  it("only the car's availability differs between the two answers", () => {
    expect(driveFor("vehicle", 25).availability).toBe("available");
    expect(driveFor("bus", 25).availability).toBe("car-unavailable");
  });
});
