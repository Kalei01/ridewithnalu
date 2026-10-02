import { describe, expect, it } from "vitest";
import {
  decideDriveVsTransit,
  decideDriveVsTransitArrival,
  type DecisionModeEstimate,
} from "./drive-transit-decision";

const at = (hour: number, minute = 0) => (hour * 60 + minute) * 60;

function mode(
  partial: { mode: DecisionModeEstimate["mode"]; expectedMinutes: number } &
    Partial<Omit<DecisionModeEstimate, "mode" | "expectedMinutes">>,
): DecisionModeEstimate {
  const { mode: selectedMode, expectedMinutes, ...overrides } = partial;
  return {
    availability: "available",
    quality: "good",
    mode: selectedMode,
    expectedMinutes,
    leaveTime: at(6),
    arrivalTime: at(6) + expectedMinutes * 60,
    earliestArrival: at(6) + (expectedMinutes - 2) * 60,
    latestArrival: at(6) + (expectedMinutes + 3) * 60,
    uncertaintyMinutes: 3,
    trafficDelayMinutes: null,
    majorIncident: false,
    railWaitMinutes: 0,
    busWaitMinutes: 0,
    transferMinutes: 0,
    ...overrides,
  };
}

describe("Nalu Intelligence Core drive-vs-transit reasoning", () => {
  it("preserves a clear drive decision", () => {
    const result = decideDriveVsTransit(
      mode({ mode: "drive", expectedMinutes: 30 }),
      mode({ mode: "transit", expectedMinutes: 60 }),
    );
    expect(result.state).toBe("drive");
    expect(result.differenceMinutes).toBe(30);
  });

  it("preserves a clear rail decision and uses grounded traffic evidence", () => {
    const result = decideDriveVsTransit(
      mode({
        mode: "drive",
        expectedMinutes: 60,
        trafficDelayMinutes: 22,
        majorIncident: true,
      }),
      mode({ mode: "transit", expectedMinutes: 48 }),
    );
    expect(result.state).toBe("transit");
    expect(result.primary.kind).toBe("major_incident");
  });

  it("keeps close choices as a toss-up", () => {
    const result = decideDriveVsTransit(
      mode({ mode: "drive", expectedMinutes: 42 }),
      mode({ mode: "transit", expectedMinutes: 45 }),
    );
    expect(result.state).toBe("same");
  });

  it("preserves the previous call when a new result is within the switch margin", () => {
    const result = decideDriveVsTransit(
      mode({ mode: "drive", expectedMinutes: 40 }),
      mode({ mode: "transit", expectedMinutes: 46 }),
      "transit",
    );
    expect(result.state).toBe("transit");
    expect(result.confidence).toBe("low");
  });

  it("does not make a stale source look reliable", () => {
    const result = decideDriveVsTransit(
      mode({ mode: "drive", expectedMinutes: 35, quality: "stale" }),
      mode({ mode: "transit", expectedMinutes: 55 }),
    );
    expect(result.state).toBe("uncertain");
    expect(result.confidence).toBe("low");
  });

  it("handles arrival-by feasibility before convenience", () => {
    const result = decideDriveVsTransitArrival(
      mode({
        mode: "drive",
        expectedMinutes: 50,
        arrivalTime: at(7, 40),
        latestArrival: at(7, 45),
      }),
      mode({
        mode: "transit",
        expectedMinutes: 35,
        arrivalTime: at(7, 15),
        latestArrival: at(7, 25),
      }),
      at(7, 30),
    );
    expect(result.state).toBe("transit");
    expect(result.driveMarginMinutes).toBe(-10);
    expect(result.transitMarginMinutes).toBe(15);
  });

  it("preserves service availability reasoning", () => {
    const result = decideDriveVsTransit(
      mode({ mode: "drive", expectedMinutes: 35, availability: "car-unavailable" }),
      mode({ mode: "transit", expectedMinutes: 50 }),
    );
    expect(result.state).toBe("transit");
  });
});
