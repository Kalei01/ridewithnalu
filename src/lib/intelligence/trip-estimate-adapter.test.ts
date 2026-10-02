import { describe, expect, it } from "vitest";
import type { TripEstimate } from "../decision/trip-estimate";
import { canonicalRouteFromEstimate, canonicalTripFromEstimates } from "./trip-estimate-adapter";

const estimate = (mode: "drive" | "transit", overrides: Partial<TripEstimate> = {}): TripEstimate => ({
  mode, availability: "available", leaveTime: 100, arrivalTime: 1_000, expectedDurationMinutes: 15,
  earliestArrival: 900, latestArrival: 1_100, uncertaintyMinutes: 2, arrivalMarginMinutes: null,
  waitMinutes: mode === "transit" ? 5 : 0, railWaitMinutes: mode === "transit" ? 5 : 0, busWaitMinutes: 0,
  transferMinutes: 0, walkingMinutes: mode === "transit" ? 6 : 0, trafficDelayMinutes: mode === "drive" ? 3 : null,
  majorIncident: false, source: { name: mode === "drive" ? "TomTom" : "GTFS timetable", basis: mode === "drive" ? "live" : "scheduled", fetchedAt: 50, quality: "good" },
  ...overrides,
});

describe("commute estimate → canonical trip adapter", () => {
  const origin = { latitude: 21.31, longitude: -158.08, label: "Home" };
  const destination = { latitude: 21.30, longitude: -157.86, label: "Work" };

  it("preserves drive timing and source freshness", () => {
    const route = canonicalRouteFromEstimate({ estimate: estimate("drive"), origin, destination });
    expect(route.mode).toBe("drive");
    expect(route.arrivalTime).toBe(1_000);
    expect(route.durationMinutes).toBe(15);
    expect(route.segments[0]?.source).toBe("TomTom");
    expect(route.segments[0]?.observedAt).toBe(50);
    expect(route.segments[0]?.quality).toBe("current");
  });

  it("preserves rail waiting/walking context without inventing geometry", () => {
    const route = canonicalRouteFromEstimate({ estimate: estimate("transit"), origin, destination });
    expect(route.walkingMinutes).toBe(6);
    expect(route.segments[0]?.routeGeometry).toEqual([]);
    expect(route.segments[0]?.arrivalTime).toBe(1_000);
  });

  it("creates one canonical trip containing both planner outputs and selects the decision mode", () => {
    const trip = canonicalTripFromEstimates({
      origin, destination, constraint: { type: "arrive-by", timestamp: 1_200 }, requestedAt: 75,
      estimates: [
        { estimate: estimate("drive"), origin, destination },
        { estimate: estimate("transit"), origin, destination },
      ],
      selectedMode: "transit",
    });
    expect(trip.routes.map((route) => route.mode)).toEqual(["drive", "transit"]);
    expect(trip.selectedRouteId).toBe("transit-route");
    expect(trip.constraint).toEqual({ type: "arrive-by", timestamp: 1_200 });
  });
});