import { describe, expect, it } from "vitest";
import { createNaluVerdict } from "./verdict-engine";
import type { CanonicalTrip } from "./trip-model";
import type { DecisionModeEstimate } from "./drive-transit-decision";

const point = { latitude: 21.31, longitude: -158.08 };
const estimates = (driveMinutes: number, railMinutes: number): DecisionModeEstimate[] => [
  { mode: "drive", availability: "available", quality: "good", expectedMinutes: driveMinutes, leaveTime: 100, arrivalTime: 100 + driveMinutes * 60, earliestArrival: 100, latestArrival: 100 + driveMinutes * 60, uncertaintyMinutes: 2, trafficDelayMinutes: 0, majorIncident: false, railWaitMinutes: 0, busWaitMinutes: 0, transferMinutes: 0 },
  { mode: "rail", availability: "available", quality: "good", expectedMinutes: railMinutes, leaveTime: 100, arrivalTime: 100 + railMinutes * 60, earliestArrival: 100, latestArrival: 100 + railMinutes * 60, uncertaintyMinutes: 2, trafficDelayMinutes: null, majorIncident: false, railWaitMinutes: 0, busWaitMinutes: 0, transferMinutes: 0 },
];

const trip: CanonicalTrip = {
  id: "trip-test", origin: point, destination: { latitude: 21.30, longitude: -157.86 },
  constraint: { type: "now" }, requestedAt: 100, selectedRouteId: null,
  routes: [
    { id: "drive-route", mode: "drive", segments: [{ id: "drive", mode: "drive", origin: point, destination: point, departureTime: 100, arrivalTime: 1_300, durationMinutes: 20, distanceMeters: null, routeGeometry: [], source: "TomTom", observedAt: 90, quality: "current", notes: [] }], departureTime: 100, arrivalTime: 1_300, durationMinutes: 20, transferCount: 0, walkingMinutes: 0, source: "TomTom" },
    { id: "rail-route", mode: "rail", segments: [{ id: "rail", mode: "rail", origin: point, destination: point, departureTime: 100, arrivalTime: 1_600, durationMinutes: 25, distanceMeters: null, routeGeometry: [], source: "GTFS", observedAt: 80, quality: "current", notes: [] }], departureTime: 100, arrivalTime: 1_600, durationMinutes: 25, transferCount: 0, walkingMinutes: 5, source: "GTFS" },
  ],
};

describe("central Nalu verdict engine", () => {
  it("selects the faster mode and preserves canonical evidence freshness", () => {
    const result = createNaluVerdict({ trip, estimates: estimates(20, 30), now: 200 });
    expect(result.selectedMode).toBe("drive");
    expect(result.alternatives).toEqual(["rail"]);
    expect(result.reasons[0]?.text).toContain("Drive");
    expect(result.freshness.map((item) => item.source)).toEqual(["TomTom", "GTFS"]);
    expect(result.freshness[0]?.observedAt).toBe(new Date(90 * 1000).toISOString());
  });

  it("does not force a mode when the underlying decision is uncertain", () => {
    const result = createNaluVerdict({ trip, estimates: estimates(20, 21), now: 200 });
    expect(result.selectedMode).toBeNull();
    expect(result.confidence).toBe("medium");
  });
});