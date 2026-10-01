import { describe, expect, it } from "vitest";
import { formatDriveMinutes, routeTravelSeconds } from "./traffic-summary";

describe("drive traffic summary", () => {
  it("uses the live traffic model even when the primary estimate is higher", () => {
    expect(
      routeTravelSeconds(
        { travelTimeInSeconds: 84 * 60, liveTrafficIncidentsTravelTimeInSeconds: 54 * 60 },
        false,
      ),
    ).toBe(54 * 60);
  });

  it("keeps a normal primary ETA when live data is close", () => {
    expect(routeTravelSeconds({ travelTimeInSeconds: 60 * 60, liveTrafficIncidentsTravelTimeInSeconds: 63 * 60 }, false)).toBe(63 * 60);
  });

  it("uses a materially slower live ETA for a current trip", () => {
    expect(routeTravelSeconds({ travelTimeInSeconds: 60 * 60, liveTrafficIncidentsTravelTimeInSeconds: 81 * 60 }, false)).toBe(81 * 60);
  });

  it("keeps the primary estimate for future departures", () => {
    expect(routeTravelSeconds({ travelTimeInSeconds: 60 * 60, liveTrafficIncidentsTravelTimeInSeconds: 81 * 60 }, true)).toBe(60 * 60);
  });

  it("formats durations naturally after one hour", () => {
    expect(formatDriveMinutes(59)).toBe("59 min");
    expect(formatDriveMinutes(60)).toBe("1 hr");
    expect(formatDriveMinutes(65)).toBe("1 hr 5 min");
    expect(formatDriveMinutes(125)).toBe("2 hrs 5 min");
  });
});
