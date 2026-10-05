import { describe, expect, it } from "vitest";
import {
  alternativeOptions,
  mergeTransitOptions,
  moreTransfersLabel,
  type Leg,
  type Option,
} from "./commute-model";

const ride = (mode: "bus" | "rail", route: string, a: number, b: number): Leg => ({
  kind: mode === "rail" ? "rail" : "connect",
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
const walk = (a: number, b: number): Leg => ({
  kind: "access",
  mode: "walk",
  route_short: null,
  route_long: null,
  headsign: null,
  from: "Your location",
  to: "Stop",
  depart_seconds: a,
  arrive_seconds: b,
  minutes: Math.round((b - a) / 60),
});
const busTrip = (leave: number, arrive: number, route: string): Option => ({
  leave_by_seconds: leave,
  depart_seconds: leave + 300,
  arrive_seconds: arrive,
  total_minutes: Math.round((arrive - leave) / 60),
  legs: [walk(leave, leave + 300), ride("bus", route, leave + 300, arrive)],
});
// Bus → Skyline → bus that arrives 6 minutes before a one-bus trip: two extra rides, not worth it.
const combo = (leave: number, arrive: number): Option => ({
  leave_by_seconds: leave,
  depart_seconds: leave + 300,
  arrive_seconds: arrive,
  total_minutes: Math.round((arrive - leave) / 60),
  legs: [
    walk(leave, leave + 300),
    ride("bus", "52", leave + 300, leave + 1500),
    ride("rail", "", leave + 1800, leave + 3600),
    ride("bus", "42", leave + 3900, arrive),
  ],
});

describe("trips whose extra transfers save too little", () => {
  it("are listed after the simpler trips, still inside the list, even when many buses come back", () => {
    const buses = Array.from({ length: 9 }, (_, i) =>
      busTrip(25000 + i * 600, 29000 + i * 600, `B${i}`),
    );
    const fast = combo(24000, 28640); // 6 min before the first bus
    const merged = mergeTransitOptions(buses, [fast]);
    expect(merged).toHaveLength(8);
    expect(merged[0]?.arrive_seconds).toBe(29000); // the simpler trip is the pick
    expect(merged.at(-1)?.arrive_seconds).toBe(28640);
    expect(merged.at(-1)?.extraTransfers).toBe(true);
  });

  it("get a place among the three alternatives on screen, with how many more transfers", () => {
    const buses = Array.from({ length: 5 }, (_, i) =>
      busTrip(25000 + i * 600, 29000 + i * 600, `B${i}`),
    );
    const merged = mergeTransitOptions(buses, [combo(24000, 28640)]);
    const shown = alternativeOptions(merged, merged[0]);
    expect(shown).toHaveLength(3);
    expect(shown.some((o) => o.extraTransfers)).toBe(true);
    const tagged = shown.find((o) => o.extraTransfers)!;
    expect(moreTransfersLabel(tagged, merged[0]!)).toBe("2 more transfers");
  });

  it("a tag is recomputed when results are merged again", () => {
    const first = mergeTransitOptions([busTrip(25000, 29000, "91")], [combo(24000, 28640)]);
    // Merged again without the simpler trip, the combo is no longer an extra-transfer alternative.
    const again = mergeTransitOptions(first.filter((o) => o.extraTransfers));
    expect(again[0]?.extraTransfers).toBeUndefined();
  });
});
