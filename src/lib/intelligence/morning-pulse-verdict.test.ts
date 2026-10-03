import { describe, expect, it } from "vitest";
import { createMorningPulseVerdict } from "./morning-pulse-verdict";

const base = {
  from: { lat: 21.3, lon: -158.0 },
  to: { lat: 21.31, lon: -157.86 },
  nowEpochMs: 1_760_000_000_000,
  nowSecondsSinceMidnight: 7 * 3600,
};

describe("createMorningPulseVerdict", () => {
  it("uses the central verdict engine for a clear time advantage", () => {
    const { verdict } = createMorningPulseVerdict({
      ...base,
      drive: {
        minutes: 45,
        delayMinutes: 8,
        roads: ["H-1 Freeway"],
        incidents: [],
      },
      rail: {
        depart_seconds: 7 * 3600 + 5 * 60,
        arrive_seconds: 7 * 3600 + 55 * 60,
        total_minutes: 50,
      },
    });

    expect(verdict.selectedMode).toBe("drive");
    expect(verdict.decisionState).toBe("drive");
    expect(verdict.reasons[0]?.text).toContain("Drive gets you there about 5 min sooner");
  });

  it("uses the door leave time and scheduled door arrival, in seconds", () => {
    const nowSec = Math.floor(base.nowEpochMs / 1000);
    const { trip } = createMorningPulseVerdict({
      ...base,
      drive: { minutes: 30, delayMinutes: 0, roads: [], incidents: [] },
      rail: {
        leave_by_seconds: 7 * 3600 + 2 * 60,
        depart_seconds: 7 * 3600 + 12 * 60,
        arrive_seconds: 7 * 3600 + 55 * 60,
        total_minutes: 53,
      },
    });
    const rail = trip.routes.find((route) => route.mode === "rail");
    expect(rail?.departureTime).toBe(nowSec + 2 * 60);
    // Door arrival includes the walk and the wait for the train.
    expect(rail?.arrivalTime).toBe(nowSec + 55 * 60);
  });

  it("keeps the result usable when one side is unavailable", () => {
    const { verdict } = createMorningPulseVerdict({
      ...base,
      drive: {
        minutes: 45,
        delayMinutes: 2,
        roads: [],
        incidents: [],
      },
      rail: null,
    });

    expect(verdict.decisionState).toBe("drive");
    expect(verdict.selectedMode).toBe("drive");
    expect(verdict.confidence).toBe("high");
  });
});
