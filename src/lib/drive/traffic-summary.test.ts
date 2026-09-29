import { describe, expect, it } from "vitest";
import { routeTravelSeconds } from "./traffic-summary";

describe("TomTom route time selection", () => {
  const summary = {
    travelTimeInSeconds: 48 * 60,
    liveTrafficIncidentsTravelTimeInSeconds: 42 * 60,
  };
  it("uses live speeds for a drive now", () => {
    expect(routeTravelSeconds(summary, false)).toBe(42 * 60);
  });
  it("uses the time-dependent departAt route time for a future drive", () => {
    expect(routeTravelSeconds(summary, true)).toBe(48 * 60);
  });
});
