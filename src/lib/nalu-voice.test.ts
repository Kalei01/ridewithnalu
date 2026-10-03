import { describe, expect, it } from "vitest";
import { generateSmartNaluInsight } from "./nalu-voice";

describe("generateSmartNaluInsight", () => {
  it("explains a decisive driving win with the saved time", () => {
    expect(
      generateSmartNaluInsight({
        driveMinutes: 43,
        transitMinutes: 80,
        selectedMode: "drive",
        trafficLevel: "heavy",
      }),
    ).toContain("Driving saves 37 min over transit right now");
  });

  it("explains a decisive transit win and connects it to a road incident", () => {
    expect(
      generateSmartNaluInsight({
        driveMinutes: 82,
        transitMinutes: 55,
        selectedMode: "transit",
        incidents: [
          {
            road: "H1 Eastbound",
            description: "Major crash causing heavy delays",
            delayMinutes: 28,
          },
        ],
      }),
    ).toContain("Transit saves 27 min over driving right now");
  });

  it("keeps close calls practical instead of forcing a winner", () => {
    expect(
      generateSmartNaluInsight({
        driveMinutes: 58,
        transitMinutes: 63,
        selectedMode: "toss_up",
      }),
    ).toContain("Times are neck-and-neck (~5 min apart)");
  });

  it("calls out a long transit transfer or wait", () => {
    expect(
      generateSmartNaluInsight({
        driveMinutes: 45,
        transitMinutes: 65,
        selectedMode: "transit",
        transferMinutes: 17,
      }),
    ).toContain("17 min transfer/wait");
  });

  it("mentions wet roads when weather can affect the drive", () => {
    expect(
      generateSmartNaluInsight({
        driveMinutes: 55,
        transitMinutes: 58,
        selectedMode: "drive",
        weather: [{ precipPercent: 60, shortForecast: "Rain showers" }],
      }),
    ).toContain("Wet roads");
  });

  it("uses Oʻahu road names in incident-aware copy", () => {
    expect(
      generateSmartNaluInsight({
        driveMinutes: 70,
        transitMinutes: 78,
        selectedMode: "drive",
        incidents: [
          {
            road: "Nimitz Highway",
            description: "Lane closure",
            delayMinutes: 15,
          },
        ],
      }),
    ).toContain("Nimitz");
  });
});
