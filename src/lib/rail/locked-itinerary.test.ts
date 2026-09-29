import { describe, expect, it } from "vitest";
import { parseLockedItinerary } from "./locked-itinerary";

describe("committed transit itinerary recovery", () => {
  const planned = {
    leave_by_seconds: 6 * 3600,
    depart_seconds: 6 * 3600 + 600,
    arrive_seconds: 7 * 3600,
    total_minutes: 60,
    legs: [
      {
        kind: "rail",
        mode: "rail",
        route_short: "Skyline",
        route_long: null,
        headsign: "Kalihi",
        from: "Kualakaʻi",
        to: "Kalauao",
        depart_seconds: 6 * 3600 + 600,
        arrive_seconds: 6 * 3600 + 2400,
        minutes: 30,
      },
    ],
  };
  it("restores the exact boarded itinerary across a reload", () => {
    expect(parseLockedItinerary(JSON.stringify(planned))).toEqual(planned);
  });
  it("rejects corrupt or incomplete saved itinerary data", () => {
    expect(parseLockedItinerary("{broken")).toBeNull();
    expect(parseLockedItinerary(JSON.stringify({ ...planned, legs: [] }))).toBeNull();
  });
});
