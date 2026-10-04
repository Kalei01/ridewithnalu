import { describe, expect, it } from "vitest";
import {
  DAILY_TRIP_LIMIT,
  ENFORCE_GUEST_LIMITS,
  ENFORCE_PLUS,
  ENFORCE_TIERS,
  FEATURE_TIER,
  asTier,
  consumeTripCheck,
  tierAllows,
} from "./tiers";

describe("tiers", () => {
  it("restricts nothing while both switches are off (Phase 1)", () => {
    expect(ENFORCE_GUEST_LIMITS).toBe(false);
    expect(ENFORCE_PLUS).toBe(false);
    expect(ENFORCE_TIERS).toBe(false);
    expect(tierAllows("guest", "turn_by_turn")).toBe(true);
    expect(tierAllows("guest", "arrive_by")).toBe(true);
  });
  it("applies the agreed lineup in a developer preview", () => {
    expect(tierAllows("guest", "arrive_by", true)).toBe(false);
    expect(tierAllows("free", "arrive_by", true)).toBe(true);
    expect(tierAllows("free", "leave_alert_one", true)).toBe(true);
    expect(tierAllows("free", "leave_alerts_all", true)).toBe(false);
    expect(tierAllows("free", "turn_by_turn", true)).toBe(false);
    expect(tierAllows("free", "riding_alerts", true)).toBe(false);
    expect(tierAllows("plus", "turn_by_turn", true)).toBe(true);
  });
  it("keeps the core answer and getting home safe free for everyone", () => {
    expect(FEATURE_TIER.drive_vs_transit_answer).toBe("guest");
    expect(FEATURE_TIER.get_home_safe).toBe("guest");
    expect(tierAllows("guest", "get_home_safe", true)).toBe(true);
    expect(DAILY_TRIP_LIMIT.free).toBeNull();
  });
  it("counts guest trip checks only when previewing or switched on", () => {
    expect(consumeTripCheck("guest", new Date(), false)).toEqual({ allowed: true, remaining: null });
    expect(consumeTripCheck("free", new Date(), true)).toEqual({ allowed: true, remaining: null });
  });
  it("treats anything unknown as a guest", () => {
    expect(asTier("plus")).toBe("plus");
    expect(asTier(undefined)).toBe("guest");
    expect(asTier("admin")).toBe("guest");
  });
});
