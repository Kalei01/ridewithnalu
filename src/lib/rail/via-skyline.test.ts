import { describe, expect, it, vi } from "vitest";
import type { Option } from "@/lib/commute-model";
import { bridgeStation, joinAtStation, planViaSkyline } from "./via-skyline";

// Real stations and coordinates from the October 2026 timetable.
const KAHAUIKI = { stop_id: "10030", stop_name: "KAHAUIKI KALIHI TRANSIT CENTER STATION", stop_lat: "21.33274", stop_lon: "-157.888805" };
const KUALAKAI = { stop_id: "10047", stop_name: "KUALAKA'I EAST KAPOLEI STATION", stop_lat: "21.345574", stop_lon: "-158.050995" };
const STATIONS = [KAHAUIKI, KUALAKAI];
const DOWNTOWN = { lat: 21.3101, lon: -157.8624 }; // 55 Merchant St
const EWA_BEACH = { lat: 21.32203, lon: -158.03366 }; // 91-1160 Kamakana St

// Planner answers for Sunday 5 PM, copied from plan_transit_general.
const toStation: Option = {
  leave_by_seconds: 61200,
  depart_seconds: 61560,
  arrive_seconds: 62520,
  total_minutes: 22,
  legs: [
    { kind: "access", mode: "walk", from: "Your location", to: "S BERETANIA ST + BISHOP ST", to_stop_id: "437", minutes: 6, depart_seconds: 61200, arrive_seconds: 61560, route_short: null, route_long: null, headsign: null },
    { kind: "connect", mode: "bus", from: "S BERETANIA ST + BISHOP ST", to: "KAMEHAMEHA HWY + MIDDLE ST", from_stop_id: "437", to_stop_id: "453", route_short: "52", route_long: "Honolulu-Mililani-Haleiwa", headsign: "WAHIAWA - HALEIWA", minutes: 15, depart_seconds: 61560, arrive_seconds: 62460 },
    { kind: "egress", mode: "walk", from: "KAMEHAMEHA HWY + MIDDLE ST", to: "Your destination", from_stop_id: "453", minutes: 1, depart_seconds: 62460, arrive_seconds: 62520, route_short: null, route_long: null, headsign: null },
  ],
};
const fromStation: Option = {
  leave_by_seconds: 63240,
  depart_seconds: 63240,
  arrive_seconds: 67140,
  total_minutes: 65,
  legs: [
    { kind: "access", mode: "walk", from: "Your location", to: "KAHAUIKI KALIHI TRANSIT CENTER STATION", to_stop_id: "10030", minutes: 0, depart_seconds: 63240, arrive_seconds: 63240, route_short: null, route_long: null, headsign: null },
    { kind: "rail", mode: "rail", from: "KAHAUIKI KALIHI TRANSIT CENTER STATION", to: "HO'AE'AE WEST LOCH STATION", from_stop_id: "10030", to_stop_id: "10044", route_short: "", route_long: "SKYLINE", headsign: "KUALAKAI EAST KAPOLEI SKYLINE STATION", minutes: 27, depart_seconds: 63240, arrive_seconds: 64860 },
    { kind: "connect", mode: "walk", from: "HO'AE'AE WEST LOCH STATION", to: "FARRINGTON HWY + LEOKU ST", from_stop_id: "10044", to_stop_id: "464", minutes: 1, depart_seconds: 64860, arrive_seconds: 65160, route_short: null, route_long: null, headsign: null },
    { kind: "connect", mode: "bus", from: "FARRINGTON HWY + LEOKU ST", to: "FORT WEAVER RD + KEAUNUI DR", from_stop_id: "464", to_stop_id: "1074", route_short: "42", route_long: "Ewa Beach-Waikiki", headsign: "EWA BEACH via Arizona Memorial", minutes: 13, depart_seconds: 65160, arrive_seconds: 65940 },
    { kind: "egress", mode: "walk", from: "FORT WEAVER RD + KEAUNUI DR", to: "Your destination", from_stop_id: "1074", minutes: 20, depart_seconds: 65940, arrive_seconds: 67140, route_short: null, route_long: null, headsign: null },
  ],
};

describe("bus → Skyline → bus", () => {
  it("picks Kahauiki for downtown → ʻEwa Beach, where neither end is near a station", () => {
    expect(bridgeStation(DOWNTOWN, EWA_BEACH, STATIONS)?.stopId).toBe("10030");
  });

  it("isn't needed when a station is walkable at either end, or it would double back", () => {
    expect(bridgeStation({ lat: 21.3335, lon: -157.889 }, EWA_BEACH, STATIONS)).toBeNull(); // starting at Kahauiki
    expect(bridgeStation(DOWNTOWN, { lat: 21.3456, lon: -158.051 }, STATIONS)).toBeNull(); // ending at Kualakaʻi
    expect(bridgeStation(DOWNTOWN, { lat: 21.2766, lon: -157.8245 }, STATIONS)).toBeNull(); // Waikīkī: away from the line
  });

  it("joins the real 5 PM trip: bus 52, Skyline, bus 42, home 6:39 PM", () => {
    const trip = joinAtStation(toStation, fromStation, { stopId: "10030", name: KAHAUIKI.stop_name })!;
    expect(trip.leave_by_seconds).toBe(61200); // 5:00 PM
    expect(trip.arrive_seconds).toBe(67140); // 6:39 PM
    expect(trip.total_minutes).toBe(99);
    expect(trip.legs.filter((l) => l.mode !== "walk").map((l) => l.route_short || "Skyline")).toEqual(["52", "Skyline", "42"]);
    const transfer = trip.legs[2]!;
    expect(transfer).toMatchObject({ kind: "connect", mode: "walk", from: "KAMEHAMEHA HWY + MIDDLE ST", to: KAHAUIKI.stop_name, to_stop_id: "10030" });
    expect(trip.legs.some((l) => l.to === "Your destination" && l.mode === "walk" && l.from === "KAMEHAMEHA HWY + MIDDLE ST")).toBe(false);
  });

  it("refuses a train that leaves before you can reach the platform", () => {
    const tooSoon = { ...fromStation, depart_seconds: toStation.arrive_seconds + 60 };
    expect(joinAtStation(toStation, tooSoon, { stopId: "10030", name: "K" })).toBeNull();
  });

  it("plans both halves and never throws", async () => {
    const search = vi.fn(async ({ to }: { to: { lat: number } }) => (to.lat === Number(KAHAUIKI.stop_lat) ? [toStation] : [fromStation]));
    const trips = await planViaSkyline({ origin: DOWNTOWN, destination: EWA_BEACH, stations: STATIONS, afterSeconds: 61200, walkRadiusM: 1600, search });
    expect(trips).toHaveLength(1);
    expect(search.mock.calls[1]?.[0]).toMatchObject({ afterSeconds: 62520 + 180, fromRadiusM: 300 });
    const failing = await planViaSkyline({ origin: DOWNTOWN, destination: EWA_BEACH, stations: STATIONS, afterSeconds: 61200, walkRadiusM: 1600, search: async () => { throw new Error("down"); } });
    expect(failing).toEqual([]);
  });
});

describe("bridge search cost", () => {
  it("searches onward once per distinct station arrival time", async () => {
    const sameArrival = { ...toStation, leave_by_seconds: toStation.leave_by_seconds + 300 };
    const search = vi.fn(async ({ to }: { to: { lat: number } }) =>
      to.lat === Number(KAHAUIKI.stop_lat) ? [toStation, sameArrival] : [fromStation],
    );
    const trips = await planViaSkyline({ origin: DOWNTOWN, destination: EWA_BEACH, stations: STATIONS, afterSeconds: 61200, walkRadiusM: 1600, search });
    expect(search).toHaveBeenCalledTimes(2);
    // Of two ways in arriving together, keep the one that leaves later.
    expect(trips[0]?.leave_by_seconds).toBe(sameArrival.leave_by_seconds);
  });
});
