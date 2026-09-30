import { describe, expect, it } from "vitest";
import { routeTravelSeconds } from "./traffic-summary";

describe("TomTom route time selection", () => {
  it("uses TomTom's primary ETA for a live trip", () => {
    expect(
      routeTravelSeconds(
        {
          travelTimeInSeconds: 31 * 60,
          liveTrafficIncidentsTravelTimeInSeconds: 42 * 60,
        },
        false,
      ),
    ).toBe(31 * 60);
  });

  it("uses the primary ETA for a future departure", () => {
    expect(
      routeTravelSeconds(
        {
          travelTimeInSeconds: 35 * 60,
          liveTrafficIncidentsTravelTimeInSeconds: 42 * 60,
        },
        true,
      ),
    ).toBe(35 * 60);
  });

  it("falls back to the primary ETA when live incident data is absent", () => {
    expect(
      routeTravelSeconds({ travelTimeInSeconds: 33 * 60 }, false),
    ).toBe(33 * 60);
  });
});
