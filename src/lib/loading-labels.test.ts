import { describe, expect, it } from "vitest";
import { checkingStepsSummary, tripCheckingSteps, weatherSummaryText } from "./loading-labels";
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

describe("trip checking steps", () => {
  const states = (steps: ReturnType<typeof tripCheckingSteps>) =>
    steps?.map((s) => `${s.key}:${s.state}${s.detail ? `:${s.detail}` : ""}`);

  it("lists traffic, Skyline and TheBus, all still checking", () => {
    expect(states(tripCheckingSteps(base))).toEqual([
      "traffic:checking",
      "skyline:checking",
      "bus:checking",
    ]);
  });

  it("ticks traffic with the real drive time as soon as it arrives", () => {
    expect(states(tripCheckingSteps({ ...base, driveLoading: false, driveMinutes: 35 }))).toEqual([
      "traffic:done:35 min",
      "skyline:checking",
      "bus:checking",
    ]);
  });

  it("doesn't invent a drive time when traffic couldn't be checked", () => {
    expect(states(tripCheckingSteps({ ...base, driveLoading: false, driveMinutes: null }))).toEqual(
      ["traffic:unavailable", "skyline:checking", "bus:checking"],
    );
  });

  it("leaves traffic out for a rider without a car", () => {
    expect(states(tripCheckingSteps({ ...base, driveRow: false }))).toEqual([
      "skyline:checking",
      "bus:checking",
    ]);
  });

  it("ticks Skyline and TheBus together once the timetable search is in", () => {
    expect(states(tripCheckingSteps({ ...base, transitLoading: false }))).toEqual([
      "traffic:checking",
      "skyline:done",
      "bus:done",
    ]);
  });

  it("is null once every answer is in", () => {
    expect(
      tripCheckingSteps({ ...base, driveLoading: false, transitLoading: false, driveMinutes: 35 }),
    ).toBeNull();
  });

  it("describes progress in words for screen readers", () => {
    expect(
      checkingStepsSummary(
        tripCheckingSteps({ ...base, driveLoading: false, driveMinutes: 35 }) ?? [],
      ),
    ).toBe("Traffic 35 min in. Checking Skyline and TheBus…");
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
