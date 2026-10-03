import { describe, expect, it, vi } from "vitest";
import {
  findInboundOptions,
  filterTransferSanityOptions,
  isTransferSane,
} from "./inbound-fallback";

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

  it("does not invent a trip when no station on the line has an active connection", async () => {
    const fetchAtStation = vi.fn(async (_stationId: string) => []);
    const result = await findInboundOptions({
      primaryStationId: "kapolei", stations, destination, fetchAtStation, maxAlternates: 1,
    });
    expect(result.options).toEqual([]);
    expect(fetchAtStation.mock.calls.map(([id]) => id)).toEqual(["kapolei", "halawa", "airport"]);
  });

  it("extends along the line when the nearest stations have no egress legs", async () => {
    const fetchAtStation = vi.fn(async (id: string) => (id === "airport" ? ["bus home"] : []));
    const result = await findInboundOptions({
      primaryStationId: "kapolei", stations, destination, fetchAtStation, maxAlternates: 1,
    });
    expect(result).toEqual({ options: ["bus home"], stationId: "airport" });
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


describe("rail transfer sanity", () => {
  const leg = (
    mode: "walk" | "drive" | "bus" | "rail",
    minutes: number | null,
    depart_seconds: number | null,
    arrive_seconds: number | null,
  ) => ({ mode, minutes, depart_seconds, arrive_seconds });

  it("rejects a one-station micro-rail hop feeding a bus", () => {
    expect(
      isTransferSane({
        legs: [
          leg("drive", 8, 0, 480),
          leg("rail", 2, 600, 720),
          leg("bus", 13, 1500, 2280),
        ],
      }),
    ).toBe(false);
  });

  it("rejects a rail-to-bus transfer when the wait exceeds the rail ride", () => {
    expect(
      isTransferSane({
        legs: [
          leg("rail", 8, 600, 1080),
          leg("bus", 9, 1920, 2460),
        ],
      }),
    ).toBe(false);
  });

  it("keeps a meaningful rail corridor run with a short bus transfer wait", () => {
    expect(
      isTransferSane({
        legs: [
          leg("rail", 20, 600, 1800),
          leg("bus", 5, 1980, 2280),
        ],
      }),
    ).toBe(true);
  });

  it("filters only the irrational rail-to-bus chains", () => {
    const options = [
      {
        id: "micro-hop",
        legs: [leg("rail", 2, 600, 720), leg("bus", 13, 1500, 2280)],
      },
      {
        id: "full-rail",
        legs: [leg("rail", 20, 600, 1800), leg("bus", 3, 1860, 2040)],
      },
    ];
    expect(filterTransferSanityOptions(options).map((option) => option.id)).toEqual(["full-rail"]);
  });
});
