import { describe, expect, it } from "vitest";
import { answerSpeedStep, landingStep } from "./funnel-steps";

describe("funnel steps", () => {
  it("buckets time to answer", () => {
    expect(answerSpeedStep(2)).toBe("answer_under_5s");
    expect(answerSpeedStep(5)).toBe("answer_5_to_10s");
    expect(answerSpeedStep(10)).toBe("answer_5_to_10s");
    expect(answerSpeedStep(14)).toBe("answer_over_10s");
  });
  it("sorts pages into landing kinds", () => {
    expect(landingStep("/guides/kapolei-to-downtown")).toBe("landed_guide");
    expect(landingStep("/oahu-commute")).toBe("landed_guide");
    expect(landingStep("/install")).toBe("landed_intro");
    expect(landingStep("/")).toBe("landed_app");
  });
});
