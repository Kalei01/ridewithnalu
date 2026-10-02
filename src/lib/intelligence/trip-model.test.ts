import { describe, expect, it } from "vitest";
import { createCanonicalTrip, summarizeRoute, type TripRoute } from "./trip-model";

const point = (latitude: number, longitude: number) => ({ latitude, longitude });

describe("Nalu canonical trip model", () => {
  it("represents a multimodal trip as ordered route segments", () => {
    const route: TripRoute = {
      id: "rail-bus",
      mode: "rail",
      segments: [
        {
          id: "walk-to-station",
          mode: "walk",
          origin: point(21.31, -158.08),
          destination: point(21.30, -158.07),
          departureTime: 100,
          arrivalTime: 106,
          durationMinutes: 6,
          distanceMeters: 500,
          routeGeometry: [point(21.31, -158.08), point(21.30, -158.07)],
          source: "gtfs",
          observedAt: 100,
          quality: "current",
          notes: [],
        },
        {
          id: "skyline",
          mode: "rail",
          origin: point(21.30, -158.07),
          destination: point(21.31, -157.86),
          departureTime: 110,
          arrivalTime: 140,
          durationMinutes: 30,
          distanceMeters: null,
          routeGeometry: [point(21.30, -158.07), point(21.31, -157.86)],
          source: "gtfs",
          observedAt: 105,
          quality: "current",
          notes: [],
        },
        {
          id: "bus",
          mode: "bus",
          origin: point(21.31, -157.86),
          destination: point(21.30, -157.86),
          departureTime: 150,
          arrivalTime: 160,
          durationMinutes: 10,
          distanceMeters: null,
          routeGeometry: [point(21.31, -157.86), point(21.30, -157.86)],
          source: "gtfs",
          observedAt: 145,
          quality: "current",
          notes: [],
        },
      ],
      departureTime: 100,
      arrivalTime: 160,
      durationMinutes: 60,
      transferCount: 1,
      walkingMinutes: 6,
      source: "gtfs",
    };

    const trip = createCanonicalTrip({
      origin: point(21.31, -158.08),
      destination: point(21.30, -157.86),
      constraint: { type: "now" },
      requestedAt: 100,
      routes: [route],
      selectedRouteId: route.id,
    });

    expect(trip.routes[0]?.segments.map((segment) => segment.mode)).toEqual([
      "walk",
      "rail",
      "bus",
    ]);
    expect(trip.selectedRouteId).toBe("rail-bus");
  });

  it("summarizes a route without rebuilding its segments", () => {
    const route: TripRoute = {
      id: "drive",
      mode: "drive",
      segments: [],
      departureTime: 100,
      arrivalTime: 1_000,
      durationMinutes: 15,
      transferCount: 0,
      walkingMinutes: 0,
      source: "tomtom",
    };

    expect(summarizeRoute(route)).toEqual({
      arrivalTime: 1_000,
      durationMinutes: 15,
      transferCount: 0,
      walkingMinutes: 0,
    });
  });

  it("preserves an explicit arrival-by constraint", () => {
    const trip = createCanonicalTrip({
      origin: point(21.31, -158.08),
      destination: point(21.30, -157.86),
      constraint: { type: "arrive-by", timestamp: 2_000 },
      requestedAt: 500,
      routes: [],
      selectedRouteId: null,
    });

    expect(trip.constraint).toEqual({ type: "arrive-by", timestamp: 2_000 });
    expect(trip.id).toMatch(/^trip-500-/);
  });
});
