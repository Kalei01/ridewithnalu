import { describe, expect, it } from "vitest";
import { preferFewerTransfers, preferLessWalking } from "./walk-preference";

const ride = (mode: string, route: string) => ({ mode, route_short: route, minutes: 20, depart_seconds: 0, arrive_seconds: 0 });
const trip = (arriveMin: number, rides: string[]) => ({
  arrive_seconds: arriveMin * 60,
  leave_by_seconds: 0,
  legs: rides.map((r) => ride(r === "Skyline" ? "rail" : "bus", r)),
});

describe("extra transfers must earn their keep", () => {
  it("keeps bus → Skyline → bus when it saves 20+ minutes over one bus", () => {
    const combo = trip(100, ["52", "Skyline", "42"]);
    const oneBus = trip(130, ["42"]);
    expect(preferFewerTransfers([combo, oneBus])).toEqual([combo, oneBus]);
  });

  it("drops it when it saves only 5 minutes, since a missed connection costs far more", () => {
    const combo = trip(100, ["52", "Skyline", "42"]);
    const oneBus = trip(105, ["E"]);
    expect(preferFewerTransfers([combo, oneBus])).toEqual([oneBus]);
  });

  it("asks 10 minutes per extra transfer", () => {
    const twoRides = trip(100, ["2", "42"]);
    expect(preferFewerTransfers([twoRides, trip(109, ["42"])])).toHaveLength(1);
    expect(preferFewerTransfers([twoRides, trip(110, ["42"])])).toHaveLength(2);
  });

  it("never drops the simpler trip, and leaves walking-only trips alone", () => {
    const oneBus = trip(105, ["E"]);
    expect(preferFewerTransfers([oneBus, trip(60, [])])).toContain(oneBus);
  });
});

describe("a trip that needs a car never pushes out one that doesn't", () => {
  const walk = (minutes: number) => ({ mode: "walk", route_short: null, minutes, depart_seconds: 0, arrive_seconds: 0 });
  const drive = (minutes: number) => ({ mode: "drive", route_short: null, minutes, depart_seconds: 0, arrive_seconds: 0 });
  const bus = (route: string) => ({ mode: "bus", route_short: route, minutes: 40, depart_seconds: 1, arrive_seconds: 2 });

  it("keeps a walk-and-bus trip even when a drive + rail trip walks much less", () => {
    const carFree = { arrive_seconds: 100 * 60, leave_by_seconds: 0, legs: [walk(12), bus("91"), walk(2)] };
    const withCar = { arrive_seconds: 104 * 60, leave_by_seconds: 0, legs: [drive(8), ride("rail", "Skyline"), bus("42"), walk(2)] };
    expect(preferLessWalking([carFree, withCar])).toContain(carFree);
  });

  it("keeps the car-free trip even if a car trip has fewer transfers", () => {
    const carFree = { arrive_seconds: 100 * 60, leave_by_seconds: 0, legs: [walk(5), bus("52"), ride("rail", "Skyline"), bus("42")] };
    const withCar = { arrive_seconds: 105 * 60, leave_by_seconds: 0, legs: [drive(8), bus("C")] };
    expect(preferFewerTransfers([carFree, withCar])).toContain(carFree);
  });
});
