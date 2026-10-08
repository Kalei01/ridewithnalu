import { describe, expect, it } from "vitest";
import { cleanFeedbackText, looksLikeSpam } from "./feedback-text";

describe("feedback text", () => {
  it("strips control characters and caps length", () => {
    expect(cleanFeedbackText("  hi\u0000 there\u0007  ", 50)).toBe("hi there");
    expect(cleanFeedbackText("a".repeat(900), 500)).toHaveLength(500);
  });
  it("flags notes with several links but not one", () => {
    expect(looksLikeSpam("see https://a.com and http://b.com")).toBe(true);
    expect(looksLikeSpam("Skyline said 20 min, see https://x.com")).toBe(false);
    expect(looksLikeSpam("The H-1 time was wrong")).toBe(false);
  });
});
