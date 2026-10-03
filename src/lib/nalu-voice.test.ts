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
    ).toContain("17 min from the transfer/wait");
  });

  it("mentions wet roads when weather can affect the drive", () => {
    expect(
      generateSmartNaluInsight({
        driveMinutes: 55,
        transitMinutes: 65,
        selectedMode: "drive",
        weather: [{ precipPercent: 60, shortForecast: "Rain showers" }],
      }),
    ).toContain("Wet roads");
  });

  it("uses Oʻahu road names in incident-aware copy", () => {
    expect(
      generateSmartNaluInsight({
        driveMinutes: 60,
        transitMinutes: 75,
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
  it("keeps personality separate from the factual drive recommendation", () => {
    const line = generateSmartNaluInsight({
      driveMinutes: 42,
      transitMinutes: 79,
      selectedMode: "drive",
      trafficLevel: "heavy",
      direction: "morning-westbound",
    });

    expect(line).toMatch(/^Driving saves 37 min over transit right now\./);
    expect(line.split(". ").length).toBeLessThanOrEqual(2);
    expect(line).not.toContain("might");
  });

  it("uses a clear transit fact before the personality tail", () => {
    const line = generateSmartNaluInsight({
      driveMinutes: 84,
      transitMinutes: 54,
      selectedMode: "transit",
      incidents: [{ road: "H1 Westbound", description: "Crash", delayMinutes: 24 }],
    });

    expect(line).toMatch(/^Transit saves 30 min over driving right now/);
    expect(line).toContain("H-1");
  });

  it("adds useful humor without changing a close-call decision", () => {
    const line = generateSmartNaluInsight({
      driveMinutes: 58,
      transitMinutes: 63,
      selectedMode: "toss_up",
    });

    expect(line).toMatch(/^Times are neck-and-neck \(~5 min apart\)\./);
    expect(line.split(". ").length).toBeLessThanOrEqual(2);
  });

  it("makes personality deterministic for the same commute", () => {
    const context = {
      driveMinutes: 47,
      transitMinutes: 76,
      selectedMode: "drive" as const,
      trafficLevel: "heavy" as const,
      direction: "morning-westbound" as const,
    };

    expect(generateSmartNaluInsight(context)).toBe(generateSmartNaluInsight(context));
  });

  it("varies the personality tail across materially different commute contexts", () => {
    const first = generateSmartNaluInsight({
      driveMinutes: 41,
      transitMinutes: 78,
      selectedMode: "drive",
      trafficLevel: "heavy",
      direction: "morning-westbound",
    });
    const second = generateSmartNaluInsight({
      driveMinutes: 56,
      transitMinutes: 93,
      selectedMode: "drive",
      trafficLevel: "heavy",
      direction: "evening-westbound",
    });

    expect(first).not.toBe(second);
    expect(first).toMatch(/^Driving saves /);
    expect(second).toMatch(/^Driving saves /);
  });

});

describe("Nalu voice library architecture", () => {
  it("keeps smart personality deterministic and limited to two sentences", () => {
    const contexts = [
      { driveMinutes: 42, transitMinutes: 79, selectedMode: "drive" as const, trafficLevel: "heavy" as const },
      { driveMinutes: 84, transitMinutes: 54, selectedMode: "transit" as const },
      { driveMinutes: 58, transitMinutes: 63, selectedMode: "toss_up" as const },
    ];

    for (const context of contexts) {
      const line = generateSmartNaluInsight(context);
      expect(line.split(". ").length).toBeLessThanOrEqual(2);
    }
  });
});
