import { describe, expect, it } from "vitest";
import type { MobilitySnapshot, NaluDecision, TripRequest } from "./types";

describe("Nalu Intelligence Core contracts", () => {
  it("keeps a trip request provider-neutral", () => {
    const request: TripRequest = {
      origin: { lat: 21.3, lon: -157.86 },
      destination: { lat: 21.31, lon: -157.87 },
      timeConstraint: { kind: "now" },
      availableModes: ["drive", "rail", "bus"],
      requestedAt: "2026-10-01T18:00:00-10:00",
    };

    expect(request.availableModes).toEqual(["drive", "rail", "bus"]);
    expect(request.timeConstraint.kind).toBe("now");
  });

  it("represents scheduled transit separately from live observation", () => {
    const snapshot: MobilitySnapshot = {
      capturedAt: "2026-10-01T18:00:00-10:00",
      drive: null,
      transit: [
        {
          mode: "rail",
          travelMinutes: 42,
          departureTime: "2026-10-01T18:05:00-10:00",
          arrivalTime: "2026-10-01T18:47:00-10:00",
          scheduled: true,
          liveObservation: false,
          freshness: {
            observedAt: "2026-10-01T18:00:00-10:00",
            source: "GTFS",
          },
        },
      ],
      incidents: [],
    };

    expect(snapshot.transit[0]!.scheduled).toBe(true);
    expect(snapshot.transit[0]!.liveObservation).toBe(false);
  });

  it("allows a decision without pretending every mode has a result", () => {
    const decision: NaluDecision = {
      decisionState: "transit",
      selectedMode: "rail",
      alternatives: ["drive"],
      departureTime: "2026-10-01T18:05:00-10:00",
      arrivalTime: "2026-10-01T18:47:00-10:00",
      reasons: [{ text: "Rail is currently the available option." }],
      warnings: [],
      freshness: [],
    };

    expect(decision.selectedMode).toBe("rail");
    expect(decision.confidence).toBeUndefined();
  });
});
