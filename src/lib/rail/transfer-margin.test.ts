import { describe, expect, it } from "vitest";
import { preferFewerTransfers } from "./walk-preference";

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
