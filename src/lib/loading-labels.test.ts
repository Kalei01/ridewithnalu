import { describe, expect, it } from "vitest";
import { tripCheckingStatus, weatherSummaryText } from "./loading-labels";
import { sourceFreshnessLabel } from "./commute-model";

const minutes = (m: number) => `${m} min`;
const base = {
  driveRow: true,
  driveLoading: true,
  driveMinutes: null,
  hasTransit: true,
  transitLoading: true,
  formatMinutes: minutes,
};

describe("trip checking status", () => {
  it("names everything still being checked", () => {
    expect(tripCheckingStatus(base)).toBe("Checking traffic, TheBus and Skyline…");
  });

  it("shows the drive time as soon as it arrives, while transit is still checking", () => {
    expect(tripCheckingStatus({ ...base, driveLoading: false, driveMinutes: 35 })).toBe(
      "Drive 35 min · checking TheBus and Skyline…",
    );
  });

  it("doesn't invent a drive time when traffic couldn't be checked", () => {
    expect(tripCheckingStatus({ ...base, driveLoading: false, driveMinutes: null })).toBe(
      "Checking TheBus and Skyline…",
    );
  });

  it("leaves drive out for a rider without a car", () => {
    expect(tripCheckingStatus({ ...base, driveRow: false, driveMinutes: 35 })).toBe(
      "Checking TheBus and Skyline…",
    );
  });

  it("waits only on traffic once transit is in", () => {
    expect(tripCheckingStatus({ ...base, transitLoading: false })).toBe("Checking traffic…");
  });

  it("says nothing once every answer is in", () => {
    expect(
      tripCheckingStatus({ ...base, driveLoading: false, transitLoading: false, driveMinutes: 35 }),
    ).toBeNull();
  });
});

describe("browse weather summary", () => {
  it("says it is checking while the weather loads, not that it is unavailable", () => {
    expect(weatherSummaryText([], { hasData: false, failed: false, canLoad: true })).toBe(
      "Checking weather…",
    );
  });

  it("says unavailable only once the request failed or can't run", () => {
    expect(weatherSummaryText([], { hasData: false, failed: true, canLoad: true })).toBe(
      "Weather unavailable",
    );
    expect(weatherSummaryText([], { hasData: false, failed: false, canLoad: false })).toBe(
      "Weather unavailable",
    );
    expect(weatherSummaryText([], { hasData: true, failed: false, canLoad: true })).toBe(
      "Weather unavailable",
    );
  });

  it("shows the reading when there is one", () => {
    expect(
      weatherSummaryText(["84°", "Sunny"], { hasData: true, failed: false, canLoad: true }),
    ).toBe("84° · Sunny");
  });
});

describe("data freshness while loading", () => {
  const transit = {
    name: "GTFS timetable",
    basis: "scheduled" as const,
    fetchedAt: null,
    quality: "unavailable" as const,
  };

  it("says the timetable is being checked while the search runs", () => {
    expect(sourceFreshnessLabel(transit, 0, { loading: true })).toBe(
      "Bus & Skyline times · Checking…",
    );
  });

  it("says not available only once the search is over", () => {
    expect(sourceFreshnessLabel(transit, 0)).toBe("Bus & Skyline times · Not available");
    expect(sourceFreshnessLabel({ ...transit, quality: "good" }, 0)).toBe(
      "Bus & Skyline times · Update time unknown",
    );
  });
});
