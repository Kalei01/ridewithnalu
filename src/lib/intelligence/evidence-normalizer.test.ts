import { describe, expect, it } from "vitest";
import { bestEvidence, normalizeEvidence, normalizeEvidenceBatch } from "./evidence-normalizer";

describe("Nalu evidence normalizer", () => {
  const now = 1_000_000;

  it("keeps current evidence current", () => {
    const result = normalizeEvidence({
      id: "drive-eta",
      mode: "drive",
      source: "tomtom",
      value: 62,
      unit: "minutes",
      observedAt: now - 30_000,
      expiresAt: null,
      impact: "negative",
      relevance: "route",
    }, { now });

    expect(result.quality).toBe("current");
    expect(result.confidence).toBeGreaterThan(0.8);
  });

  it("marks expired or old evidence stale", () => {
    const result = normalizeEvidence({
      id: "incident",
      mode: "incident",
      source: "tomtom",
      value: true,
      observedAt: now - 20 * 60_000,
      expiresAt: null,
      impact: "negative",
      relevance: "route",
    }, { now });

    expect(result.quality).toBe("stale");
  });

  it("normalizes a provider batch without changing provider values", () => {
    const result = normalizeEvidenceBatch([
      {
        id: "eta",
        mode: "drive",
        source: "tomtom",
        value: 60,
        observedAt: now,
        expiresAt: null,
        impact: "neutral",
        relevance: "route",
      },
      {
        id: "rain",
        mode: "weather",
        source: "nws",
        value: "rain",
        observedAt: now,
        expiresAt: null,
        impact: "negative",
        relevance: "trip",
      },
    ], { now });

    expect(result.map((item) => item.value)).toEqual([60, "rain"]);
    expect(result.every((item) => item.quality === "current")).toBe(true);
  });

  it("selects route-relevant current evidence before general stale evidence", () => {
    const result = bestEvidence([
      {
        id: "general",
        mode: "weather",
        source: "nws",
        value: "rain",
        observedAt: now,
        expiresAt: null,
        quality: "stale",
        impact: "negative",
        confidence: 1,
        relevance: "general",
      },
      {
        id: "route",
        mode: "incident",
        source: "tomtom",
        value: "closure",
        observedAt: now,
        expiresAt: null,
        quality: "current",
        impact: "negative",
        confidence: 0.7,
        relevance: "route",
      },
    ]);

    expect(result?.id).toBe("route");
  });
});
