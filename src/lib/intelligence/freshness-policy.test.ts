import { describe, expect, it } from "vitest";
import {
  FRESHNESS_POLICIES,
  confidenceForFreshness,
  qualityFromAge,
} from "./freshness-policy";

describe("freshness policy", () => {
  it("uses tighter freshness for live drive ETA than scheduled transit", () => {
    expect(FRESHNESS_POLICIES.driveEta.staleAfterMs).toBe(5 * 60_000);
    expect(FRESHNESS_POLICIES.transitSchedule.staleAfterMs).toBe(10 * 60_000);
  });

  it("marks missing current timestamps as limited instead of fresh", () => {
    expect(
      qualityFromAge(null, 1_000, FRESHNESS_POLICIES.driveEta, "current"),
    ).toBe("limited");
  });

  it("marks evidence stale after its source-specific threshold", () => {
    const now = 10 * 60_000;
    expect(
      qualityFromAge(
        now - 5 * 60_000 - 1,
        now,
        FRESHNESS_POLICIES.driveEta,
      ),
    ).toBe("stale");
    expect(
      qualityFromAge(
        now - 10 * 60_000,
        now,
        FRESHNESS_POLICIES.transitSchedule,
      ),
    ).toBe("current");
  });

  it("reduces confidence as current evidence ages", () => {
    const policy = FRESHNESS_POLICIES.driveEta;
    const fresh = confidenceForFreshness(0, 1, policy, "current");
    const aged = confidenceForFreshness(
      1,
      policy.staleAfterMs * 0.9 + 1,
      policy,
      "current",
    );
    expect(fresh).toBeGreaterThan(aged);
    expect(aged).toBeGreaterThanOrEqual(0.5);
  });

  it("never gives stale or unavailable evidence high confidence", () => {
    const policy = FRESHNESS_POLICIES.driveEta;
    expect(confidenceForFreshness(0, 1, policy, "stale")).toBe(0.2);
    expect(confidenceForFreshness(0, 1, policy, "unavailable")).toBe(0);
  });
});
