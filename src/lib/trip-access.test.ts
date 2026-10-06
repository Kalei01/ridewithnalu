import { describe, expect, it } from "vitest";
import {
  TRIP_ACCESS_OPTIONS,
  accessResources,
  carTripAvailable,
  vehicleToStation,
} from "./trip-access";
import { dropOffCandidates, pickupCandidates } from "./rail/drop-off";

describe("what each answer makes available", () => {
  it("Include driving or drop-off: a car may be part of the comparison, without assuming how", () => {
    const r = accessResources("vehicle");
    expect(r).toEqual({ vehicle: true });
    expect(vehicleToStation(r)).toBe("vehicle");
    expect(carTripAvailable(r)).toBe(true);
  });

  it("No driving: no car leg of any kind", () => {
    const r = accessResources("bus");
    expect(r).toEqual({ vehicle: false });
    expect(vehicleToStation(r)).toBe("none");
    expect(carTripAvailable(r)).toBe(false);
  });
});

describe("the two choices", () => {
  it("are worded as constraints on the comparison, not as modes", () => {
    expect(TRIP_ACCESS_OPTIONS.map((option) => `${option.emoji} ${option.label}`)).toEqual([
      "🚗 Include driving or drop-off",
      "🚌 No driving — bus, rail & walking",
    ]);
  });

  it("only decide whether a car may be used; neither names a winner", () => {
    expect(TRIP_ACCESS_OPTIONS.map((option) => option.value)).toEqual(["vehicle", "bus"]);
    // The constraint is all that differs: walking, bus and Skyline stay in both.
    expect(Object.keys(accessResources("vehicle"))).toEqual(["vehicle"]);
    expect(Object.keys(accessResources("bus"))).toEqual(["vehicle"]);
  });
});

describe("drop-off stations", () => {
  // ʻEwa Beach → downtown, with real station positions along the line.
  const origin = { lat: 21.32203, lon: -158.03366 };
  const downtown = { lat: 21.30937, lon: -157.86318 };
  const station = (stop_id: string, lat: number, lon: number) => ({
    stop_id,
    stop_lat: lat,
    stop_lon: lon,
  });
  const stations = [
    station("10047", 21.3345, -158.0238), // Kualakaʻi (about 1.6 km away)
    station("10046", 21.3348, -158.0127),
    station("10045", 21.3461, -158.0377),
    station("10055", 21.3731, -157.9388),
    station("10030", 21.3366, -157.8825),
    station("far-west", 21.4, -158.2),
  ];

  it("skips stations the rider would walk to and stations that lead away", () => {
    const ids = dropOffCandidates(origin, downtown, stations, 10).map((s) => s.stop_id);
    expect(ids).not.toContain("far-west");
    expect(ids).toContain("10030");
  });

  it("limits the search to a few real candidates, spread along the trip", () => {
    const picked = dropOffCandidates(origin, downtown, stations, 3);
    expect(picked.length).toBeLessThanOrEqual(3);
    expect(new Set(picked.map((s) => s.stop_id)).size).toBe(picked.length);
    // The one nearest the destination is always tried.
    expect(picked.map((s) => s.stop_id)).toContain("10030");
  });

  it("returns nothing without coordinates", () => {
    expect(dropOffCandidates({ lat: null, lon: null }, downtown, stations)).toEqual([]);
  });

  describe("pickup stations heading home", () => {
    // Downtown to ʻEwa Beach. The line's end (East Kapolei, UH West Oʻahu) lies past home.
    const home = { lat: 21.32203, lon: -158.03366 };
    const downtown = { lat: 21.30937, lon: -157.86318 };
    const station = (stop_id: string, lat: number, lon: number) => ({
      stop_id,
      stop_lat: lat,
      stop_lon: lon,
    });
    const stations = [
      station("10047", 21.3456, -158.051), // Kualakaʻi (East Kapolei)
      station("10046", 21.3585, -158.0512), // Keoneʻae (UH West Oʻahu)
      station("10045", 21.3461, -158.0377), // Honouliuli
      station("10055", 21.3731, -157.9388), // Hālawa
      station("10030", 21.3366, -157.8825), // Kahauiki
    ];

    it("tries the stations nearest home first, even though they lie past home", () => {
      const ids = pickupCandidates(home, downtown, stations).map((s) => s.stop_id);
      expect(ids.slice(0, 2).sort()).toEqual(["10045", "10047"]);
      // The station that makes the most progress from downtown is tried too.
      expect(ids).toContain("10030");
    });

    it("never lists a station twice and respects the limit", () => {
      const ids = pickupCandidates(home, downtown, stations, 3).map((s) => s.stop_id);
      expect(new Set(ids).size).toBe(ids.length);
      expect(ids.length).toBeLessThanOrEqual(3);
    });

    it("skips a station the rider could simply walk from", () => {
      const next = [station("near", 21.3225, -158.0345), ...stations];
      expect(pickupCandidates(home, downtown, next).map((s) => s.stop_id)).not.toContain("near");
    });
  });
});
