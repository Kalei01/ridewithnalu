import { describe, expect, it } from "vitest";
import { homeLineFor } from "./home-line";
import type { HomeLive, HomeTraffic } from "./home-types";

const westbound: HomeTraffic = {
  direction: "westbound",
  minutes: 34,
  typicalMinutes: 28,
  delayMinutes: 6,
  corridor: "Via Moanalua Fwy West → H-1 West",
  fetchedAt: 0,
  path: [],
  sections: [],
};
const evening = 17 * 3600;
const trains = (start: number, gap: number) =>
  [0, 1, 2, 3, 4].map((i) => ({ departSeconds: start + i * gap, endStopId: null }));
const live = (over: Partial<HomeLive> = {}): HomeLive => ({
  generatedAt: 0,
  serviceSeconds: evening,
  traffic: { eastbound: null, westbound },
  skyline: { eastbound: trains(evening, 600), westbound: trains(evening + 60, 900) },
  showers: null,
  ...over,
});

describe("homeLineFor", () => {
  it("uses the drive home and the westbound trains still to come in the afternoon", () => {
    expect(homeLineFor(live(), evening)).toBe(
      "Pau hana traffic: the drive out toward Kapolei via H-1 is 6 min slower than usual — Skyline's every 15 min.",
    );
  });
  it("says nothing about traffic with no usual to compare", () => {
    const unknown = { ...westbound, delayMinutes: null, typicalMinutes: null };
    expect(
      homeLineFor(live({ traffic: { eastbound: null, westbound: unknown } }), evening),
    ).toBeNull();
  });
  it("says Skyline has stopped only late, when no train is left", () => {
    const late = 22 * 3600;
    const calm = { ...westbound, delayMinutes: 0 };
    const empty = { eastbound: trains(70000, 600), westbound: trains(70000, 600) };
    expect(
      homeLineFor(live({ traffic: { eastbound: null, westbound: calm }, skyline: empty }), late),
    ).toBe("Skyline's pau for the night, and the drive out toward Kapolei via H-1's moving like usual.");
    expect(
      homeLineFor(live({ traffic: { eastbound: null, westbound: calm }, skyline: null }), late),
    ).toBeNull();
  });
});
