import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  accessResources,
  carTripAvailable,
  readTripAccess,
  tripAccessKey,
  vehicleToStation,
  writeTripAccess,
} from "./trip-access";
import { dropOffCandidates } from "./rail/drop-off";

describe("what each answer makes available", () => {
  it("Drive or drop-off: a car for some or all of the trip, without assuming how", () => {
    const r = accessResources("vehicle");
    expect(r).toEqual({ vehicle: true });
    expect(vehicleToStation(r)).toBe("vehicle");
    expect(carTripAvailable(r)).toBe(true);
  });

  it("Taking the bus: no car leg of any kind", () => {
    const r = accessResources("bus");
    expect(r).toEqual({ vehicle: false });
    expect(vehicleToStation(r)).toBe("none");
    expect(carTripAvailable(r)).toBe(false);
  });
});

describe("remembering an answer", () => {
  const store = new Map<string, string>();
  const HOUR = 60 * 60_000;
  beforeEach(() => {
    store.clear();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => void store.set(key, value),
        removeItem: (key: string) => void store.delete(key),
      },
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("is per destination", () => {
    expect(tripAccessKey({ lat: 21.30937, lon: -157.86318 })).toBe("21.3094,-157.8632");
    expect(tripAccessKey({ lat: null, lon: null })).toBeNull();
  });

  it("holds for the same trip and then lapses, so a later trip is asked again", () => {
    const key = "21.3094,-157.8632";
    const t0 = Date.UTC(2026, 9, 6, 18, 0);
    writeTripAccess(key, "vehicle", t0);
    expect(readTripAccess(key, t0 + HOUR)).toBe("vehicle");
    expect(readTripAccess(key, t0 + 5 * HOUR)).toBeNull();
    expect(readTripAccess("21.0000,-157.0000", t0 + HOUR)).toBeNull();
  });

  it("can be cleared by Change", () => {
    const key = "21.3094,-157.8632";
    const t0 = Date.UTC(2026, 9, 6, 18, 0);
    writeTripAccess(key, "bus", t0);
    writeTripAccess(key, null, t0 + 1000);
    expect(readTripAccess(key, t0 + 2000)).toBeNull();
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
});
