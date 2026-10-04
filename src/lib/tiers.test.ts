import { describe, expect, it } from "vitest";
import { DAILY_TRIP_LIMIT, ENFORCE_TIERS, FEATURE_TIER, asTier, tierAllows } from "./tiers";

describe("tiers", () => {
  it("restricts nothing while enforcement is off", () => {
    expect(ENFORCE_TIERS).toBe(false);
    expect(tierAllows("guest", "turn_by_turn")).toBe(true);
  });
  it("keeps the core answer free for everyone", () => {
    expect(FEATURE_TIER.drive_vs_transit_answer).toBe("guest");
    expect(DAILY_TRIP_LIMIT.free).toBeNull();
  });
  it("treats anything unknown as a guest", () => {
    expect(asTier("plus")).toBe("plus");
    expect(asTier(undefined)).toBe("guest");
    expect(asTier("admin")).toBe("guest");
  });
});
