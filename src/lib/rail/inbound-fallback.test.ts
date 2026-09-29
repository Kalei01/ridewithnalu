import { describe, expect, it, vi } from "vitest";
import { findInboundOptions } from "./inbound-fallback";

const destination = { lat: 21.36, lon: -157.94 };
const stations = [
  { stop_id: "kapolei", stop_lat: 21.3358, stop_lon: -158.0798 },
  { stop_id: "halawa", stop_lat: 21.36, stop_lon: -157.94 },
  { stop_id: "airport", stop_lat: 21.33, stop_lon: -157.93 },
  { stop_id: "unknown", stop_lat: null, stop_lon: null },
];

describe("inbound arrival station fallback", () => {
  it("keeps the configured station when its itinerary reaches the destination", async () => {
    const fetchAtStation = vi.fn(async () => ["rail and bus to Home"]);
    const result = await findInboundOptions({
      primaryStationId: "kapolei", stations, destination, fetchAtStation,
    });
    expect(result).toEqual({ options: ["rail and bus to Home"], stationId: "kapolei" });
    expect(fetchAtStation).toHaveBeenCalledTimes(1);
  });

  it("tries the nearest alternative after an empty result and uses its planner itinerary", async () => {
    const fetchAtStation = vi.fn(async (stationId: string) =>
      stationId === "halawa" ? [{ legs: ["rail", "bus to Home"] }] : [],
    );
    const result = await findInboundOptions({
      primaryStationId: "kapolei", stations, destination, fetchAtStation,
    });
    expect(fetchAtStation.mock.calls.map(([id]) => id)).toEqual(["kapolei", "halawa"]);
    expect(result).toEqual({ options: [{ legs: ["rail", "bus to Home"] }], stationId: "halawa" });
  });

  it("does not invent a trip when every nearby station has no active connection", async () => {
    const fetchAtStation = vi.fn(async (_stationId: string) => []);
    const result = await findInboundOptions({
      primaryStationId: "kapolei", stations, destination, fetchAtStation, maxAlternates: 1,
    });
    expect(result.options).toEqual([]);
    expect(fetchAtStation.mock.calls.map(([id]) => id)).toEqual(["kapolei", "halawa"]);
  });

  it("can recover when the nearest-stop lookup itself found no station", async () => {
    const fetchAtStation = vi.fn(async (stationId: string) => stationId === "halawa" ? ["walk home"] : []);
    const result = await findInboundOptions({
      primaryStationId: null, stations, destination, fetchAtStation,
    });
    expect(result.stationId).toBe("halawa");
    expect(fetchAtStation).toHaveBeenCalledTimes(1);
  });
});
