import { describe, expect, it } from "vitest";
import { hubAccessFallback } from "./inbound-fallback";

describe("hubAccessFallback", () => {
  it("boards at the station nearest the origin and prepends a drive leg", async () => {
    const seen: string[] = [];
    const result = await hubAccessFallback({
      origin: { lat: 21.3, lon: -157.86 },
      stations: [
        { stop_id: "far", stop_name: "Far", stop_lat: 21.33, stop_lon: -158.05 },
        { stop_id: "near", stop_name: "Near", stop_lat: 21.36, stop_lon: -157.93 },
      ],
      afterSeconds: 60_000,
      fetchFromHub: async (hub, after) => {
        seen.push(hub.stopId);
        expect(after).toBeGreaterThan(60_000);
        return [{ leave_by_seconds: after, depart_seconds: after + 120, arrive_seconds: after + 1920,
          total_minutes: 30, legs: [{ kind: "rail", mode: "rail", route_short: null, route_long: null,
            headsign: null, from: "Near", to: "Home", depart_seconds: after + 120, arrive_seconds: after + 1920, minutes: 30 }] }];
      },
    });
    expect(seen).toEqual(["near"]);
    expect(result[0]!.legs[0]).toMatchObject({ kind: "access", mode: "drive", to_stop_id: "near" });
    expect(result[0]!.total_minutes).toBe(30 + result[0]!.legs[0]!.minutes!);
  });
  it("returns nothing when no hub has rail service", async () => {
    const result = await hubAccessFallback({ origin: { lat: 21.3, lon: -157.86 },
      stations: [{ stop_id: "a", stop_lat: 21.36, stop_lon: -157.93 }], afterSeconds: 0, fetchFromHub: async () => [] });
    expect(result).toEqual([]);
  });
});
