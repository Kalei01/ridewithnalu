import { describe, expect, it } from "vitest";
import {
  SKYLINE_FALLBACK_HEADWAY_MINUTES,
  nextSkylineFallbackDepartureSeconds,
  skylineFallbackHeadwayMinutes,
  skylineFallbackPhaseMinute,
} from "./skyline-fallback";

describe("Skyline fallback metadata", () => {
  it("uses a 10-minute fallback headway", () => {
    expect(skylineFallbackHeadwayMinutes("Keoneʻae – UH-West Oʻahu")).toBe(10);
    expect(SKYLINE_FALLBACK_HEADWAY_MINUTES).toBe(10);
  });

  it("recognizes the observed UH-West :02 phase", () => {
    expect(skylineFallbackPhaseMinute("Keoneʻae")).toBe(2);
    expect(skylineFallbackPhaseMinute("University of Hawaiʻi - West Oʻahu")).toBe(2);
    expect(skylineFallbackPhaseMinute("Kualakaʻi")).toBeNull();
  });

  it("computes the next UH-West fallback departure without inventing direction", () => {
    expect(nextSkylineFallbackDepartureSeconds("Keoneʻae", 6 * 3600 + 2 * 60)).toBe(6 * 3600 + 12 * 60);
    expect(nextSkylineFallbackDepartureSeconds("Keoneʻae", 6 * 3600 + 1 * 60 + 30)).toBe(6 * 3600 + 2 * 60);
    expect(nextSkylineFallbackDepartureSeconds("Kualakaʻi", 6 * 3600)).toBeNull();
  });
});
