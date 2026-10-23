import { describe, expect, it } from "vitest";
import { labelDepartures, stopBuses } from "./browse-stop-buses";
import type { BusArrival } from "./bus-arrivals.functions";

const NOW = 8 * 3600;
const arrival = (over: Partial<BusArrival>): BusArrival => ({
  routeShortName: "42",
  headsign: "Ewa Beach",
  estimatedArrivalTime: "8:07 AM",
  scheduledArrivalTime: "8:05 AM",
  estimatedSeconds: NOW + 7 * 60,
  scheduledSeconds: NOW + 5 * 60,
  isDelayed: false,
  delayMinutes: 2,
  minutesAway: 7,
  isLive: true,
  canceled: false,
  vehicle: { id: "bus-1", lat: 21.33, lon: -158.0 },
  ...over,
});
const dep = (seconds: number, route = "42", headsign = "Ewa Beach") => ({
  departure_seconds: seconds,
  route_short_name: route,
  headsign,
});

describe("labelDepartures", () => {
  it("marks a confirmed live match and uses its predicted time", () => {
    const rows = labelDepartures([dep(NOW + 5 * 60)], [arrival({})], NOW);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ live: true, seconds: NOW + 7 * 60 });
  });
  it("labels everything scheduled when there is no live data", () => {
    const rows = labelDepartures([dep(NOW + 300), dep(NOW + 900, "1")], undefined, NOW);
    expect(rows.map((r) => r.live)).toEqual([false, false]);
    expect(rows[0]!.seconds).toBe(NOW + 300);
  });
  it("does not call a row live when the match is ambiguous or another route", () => {
    const rows = labelDepartures([dep(NOW + 300, "3")], [arrival({})], NOW);
    expect(rows[0]!.live).toBe(false);
  });
  it("does not trust a non-live arrival", () => {
    const rows = labelDepartures([dep(NOW + 5 * 60)], [arrival({ isLive: false })], NOW);
    expect(rows[0]!.live).toBe(false);
  });
  it("drops a departed bus, scheduled or live", () => {
    const rows = labelDepartures([dep(NOW - 5 * 60), dep(NOW + 600, "9")], [], NOW);
    expect(rows.map((r) => r.departure.departure_seconds)).toEqual([NOW + 600]);
    // Scheduled earlier but the live bus is running late: still catchable.
    const late = labelDepartures(
      [dep(NOW - 90)],
      [arrival({ scheduledSeconds: NOW - 90, estimatedSeconds: NOW + 240 })],
      NOW,
    );
    expect(late).toHaveLength(1);
    // Live prediction already past: gone.
    const gone = labelDepartures(
      [dep(NOW + 60)],
      [arrival({ scheduledSeconds: NOW + 60, estimatedSeconds: NOW - 200 })],
      NOW,
    );
    expect(gone).toHaveLength(0);
  });
});

describe("stopBuses", () => {
  it("returns live buses with a fix, one per vehicle", () => {
    const buses = stopBuses(
      [
        arrival({}),
        arrival({ estimatedSeconds: NOW + 1800 }),
        arrival({ routeShortName: "A", vehicle: { id: "b2", lat: 21.4, lon: -158.1 } }),
      ],
      NOW,
    );
    expect(buses.map((b) => b.id)).toEqual(["bus-1", "b2"]);
  });
  it("skips departed, canceled, scheduled-only and no-fix buses", () => {
    expect(
      stopBuses(
        [
          arrival({ estimatedSeconds: NOW - 300 }),
          arrival({ canceled: true, vehicle: { id: "x", lat: 21.3, lon: -158 } }),
          arrival({ isLive: false, vehicle: { id: "y", lat: 21.3, lon: -158 } }),
          arrival({ vehicle: null }),
        ],
        NOW,
      ),
    ).toEqual([]);
  });
  it("shows none for missing data", () => {
    expect(stopBuses(undefined, NOW)).toEqual([]);
  });
});

describe("ordering and shown rows", () => {
  it("re-sorts by the effective time after live times are swapped in", () => {
    const rows = labelDepartures(
      [dep(NOW + 5 * 60), dep(NOW + 8 * 60, "9", "Kalihi")],
      [arrival({ estimatedSeconds: NOW + 12 * 60 })],
      NOW,
    );
    expect(rows.map((r) => r.departure.route_short_name)).toEqual(["9", "42"]);
  });
  it("draws only buses behind the shown rows", () => {
    const live = [
      arrival({}),
      arrival({ routeShortName: "A", vehicle: { id: "b2", lat: 21.4, lon: -158.1 } }),
    ];
    const shown = [{ route: "42", headsign: "Ewa Beach", seconds: NOW + 7 * 60 }];
    expect(stopBuses(live, NOW, shown).map((b) => b.id)).toEqual(["bus-1"]);
    expect(stopBuses(live, NOW, []).length).toBe(0);
  });
});

describe("bus tag minutes", () => {
  it("tells two buses of one route apart by minutes away", () => {
    const buses = stopBuses(
      [
        arrival({}),
        arrival({
          estimatedSeconds: NOW + 19 * 60,
          vehicle: { id: "bus-2", lat: 21.4, lon: -158.1 },
        }),
      ],
      NOW,
    );
    expect(buses.map((b) => b.minutes)).toEqual([7, 19]);
  });
});
