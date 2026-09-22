import { describe, expect, it } from "vitest";
import { landmarkFor } from "./landmarks";

describe("landmarkFor", () => {
  it("matches okina and diacritic variants of Hawaiian names", () => {
    expect(landmarkFor("Kualakaʻi Station")).toBe("Near Ka Makana Aliʻi");
    expect(landmarkFor("Kualakai Station")).toBe("Near Ka Makana Aliʻi");
    expect(landmarkFor("Hālawa Station")).toBe("Aloha Stadium / Pearl Harbor");
    expect(landmarkFor("Halawa Station")).toBe("Aloha Stadium / Pearl Harbor");
  });

  it("matches multi-road stops with the more specific rule first", () => {
    expect(landmarkFor("Nimitz Hwy + Opp Bishop St")).toBe("Near Aloha Tower Marketplace & Topa Financial");
    expect(landmarkFor("Kalihi Transit Center")).toBe("Middle St Transit Hub");
  });

  it("returns null for unknown stops", () => {
    expect(landmarkFor("Some Random Stop")).toBeNull();
    expect(landmarkFor(null)).toBeNull();
  });
});
