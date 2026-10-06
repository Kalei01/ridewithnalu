import { describe, expect, it } from "vitest";
import type { Leg, Option } from "./commute-model";
import { allowTimeNote, parkingNote, transitChoices, tripSteps } from "./trip-choices";

const leg = (mode: Leg["mode"], a: number, b: number, extra: Partial<Leg> = {}): Leg => ({
  kind: "connect",
  mode,
  route_short: null,
  route_long: null,
  headsign: null,
  from: "A",
  to: "B",
  depart_seconds: a,
  arrive_seconds: b,
  minutes: Math.round((b - a) / 60),
  ...extra,
});
const opt = (legs: Leg[], extra: Partial<Option> = {}): Option => ({
  leave_by_seconds: legs[0]!.depart_seconds!,
  depart_seconds: legs[0]!.depart_seconds!,
  arrive_seconds: legs.at(-1)!.arrive_seconds!,
  total_minutes: 0,
  legs,
  ...extra,
});

// ʻEwa Beach → 55 Merchant St, Monday Oct 5, 2026 (see transit-plan.test.ts).
const parkRide = opt([
  leg("drive", 23340, 24240, { to_stop_id: "10046" }),
  leg("rail", 24240, 26160),
  leg("bus", 26400, 27420, { route_short: "42" }),
  leg("walk", 27420, 27540),
]);
const bus91 = opt([
  leg("walk", 23160, 24360),
  leg("bus", 24360, 28020, { route_short: "91" }),
  leg("walk", 28020, 28140),
]);
const busRailBus = opt(
  [
    leg("walk", 23000, 23300),
    leg("bus", 23300, 24400, { route_short: "52" }),
    leg("rail", 24600, 26600),
    leg("bus", 26800, 27900, { route_short: "42" }),
  ],
  { extraTransfers: true },
);

describe("trip choices", () => {
  it("splits the planner's list into Skyline and Bus, keeping its order", () => {
    const { skyline, bus } = transitChoices([parkRide, bus91, busRailBus], null);
    expect(skyline).toEqual({ option: parkRide, makesIt: true });
    expect(bus.option).toBe(bus91); // the simpler car-free trip, not the extra-transfer one
  });

  it("a trip that walks to a station and rides Skyline is a Skyline trip (the airport)", () => {
    const fromAirport = opt([
      leg("walk", 40000, 40300),
      leg("rail", 40500, 41000),
      leg("bus", 41400, 42600, { route_short: "40" }),
      leg("walk", 42600, 42720),
    ]);
    const { skyline, bus } = transitChoices([fromAirport, bus91], null);
    expect(skyline.option).toBe(fromAirport);
    expect(bus.option).toBe(bus91);
    expect(tripSteps(fromAirport)).toBe("Walk → Skyline → Bus 40");
  });

  it("has no Skyline choice when no trip uses the car", () => {
    expect(transitChoices([bus91], null).skyline.option).toBeNull();
  });

  it("counts a trip home that ends by driving from the station as a Skyline trip", () => {
    const home = opt([
      leg("walk", 61000, 61300),
      leg("bus", 61300, 62300, { route_short: "42" }),
      leg("rail", 62500, 64400),
      leg("drive", 64600, 65500, { from_stop_id: "10046" }),
    ]);
    const { skyline, bus } = transitChoices([home, bus91], null);
    expect(skyline.option).toBe(home);
    expect(bus.option).toBe(bus91);
  });

  it("for Arrive By, picks the latest trip in each group that still makes it", () => {
    const later91 = opt([
      leg("walk", 25000, 26200),
      leg("bus", 26200, 29000, { route_short: "91" }),
    ]);
    expect(transitChoices([bus91, later91], 29100).bus).toEqual({
      option: later91,
      makesIt: true,
    });
    expect(transitChoices([bus91, later91], 28500).bus).toEqual({ option: bus91, makesIt: true });
  });

  it("for Arrive By, shows the earliest arrival marked late when nothing makes it", () => {
    const later91 = opt([
      leg("walk", 25000, 26200),
      leg("bus", 26200, 29000, { route_short: "91" }),
    ]);
    expect(transitChoices([later91, bus91], 27000).bus).toEqual({
      option: bus91,
      makesIt: false,
    });
  });

  it("describes each trip in a few words", () => {
    expect(tripSteps(parkRide)).toBe(
      "Drive to UH West Oʻahu (parking not included) → Skyline → Bus 42",
    );
    expect(tripSteps(bus91)).toBe("Walk → Bus 91");
    expect(tripSteps(busRailBus)).toBe("Walk → Bus 52 → Skyline → Bus 42");
  });

  it("names a car leg by the station: a lot means drive there, no lot means a drop-off", () => {
    const halawa = opt([
      leg("drive", 27000, 27600, { to_stop_id: "10055", to: "HALAWA STATION" }),
      leg("rail", 27600, 28600),
    ]);
    expect(tripSteps(halawa)).toBe("Drive to Hālawa (parking not included) → Skyline");
    const waiawa = opt([
      leg("drive", 27000, 27300, { to_stop_id: "10053", to: "WAIAWA STATION" }),
      leg("rail", 27300, 28200),
    ]);
    expect(tripSteps(waiawa)).toBe("Dropped off at Waiawa → Skyline");
  });

  it("notes Keoneʻae parking for weekday morning arrivals only, with the backup lot", () => {
    // Reaches the station at 7:44 AM.
    const morning = opt([
      leg("drive", 27000, 27840, { to_stop_id: "10046" }),
      leg("rail", 27840, 29760),
    ]);
    expect(parkingNote(morning, 1)).toMatch(/often full by 8 AM.*grass lot.*Honouliuli/);
    expect(parkingNote(morning, 6)).toBeNull(); // Saturday
    expect(parkingNote(parkRide, 1)).toBeNull(); // at the station by 6:44 AM
    const evening = opt([
      leg("drive", 61000, 61900, { to_stop_id: "10046" }),
      leg("rail", 61900, 63800),
    ]);
    expect(parkingNote(evening, 2)).toBeNull();
    const halawa = opt([
      leg("drive", 27000, 27840, { to_stop_id: "10055" }),
      leg("rail", 27840, 28600),
    ]);
    expect(parkingNote(halawa, 1)).toBeNull(); // no reports for other lots
    expect(parkingNote(bus91, 1)).toBeNull();
  });

  it("a car at the end of the trip is a pickup", () => {
    const home = opt([
      leg("walk", 61000, 61300),
      leg("rail", 61300, 63600),
      leg("drive", 63600, 64500, { from: "HALAWA STATION", from_stop_id: "10055", to: "Home" }),
    ]);
    expect(tripSteps(home)).toBe("Walk → Skyline → Picked up at Hālawa");
  });

  it("reminds the rider to allow time instead of guessing it", () => {
    expect(allowTimeNote(parkRide)).toBe("Allow time to park and get to the platform.");
    const noLot = opt([
      leg("drive", 27000, 27300, { to_stop_id: "10053", to: "WAIAWA STATION" }),
      leg("rail", 27300, 28200),
    ]);
    expect(allowTimeNote(noLot)).toBe("Allow time to get to the platform.");
    const pickup = opt([leg("rail", 61000, 62000), leg("drive", 62000, 62600)]);
    expect(allowTimeNote(pickup)).toBe("Allow time for the pickup.");
    expect(allowTimeNote(bus91)).toBeNull();
    expect(allowTimeNote(null)).toBeNull();
  });
});
