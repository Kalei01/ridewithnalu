import { useTier } from "@/hooks/use-tier";
import { consumeTripCheck, FEATURE_TIER, tierAllows, type Feature } from "@/lib/tiers";

export type UpgradeRequest = { kind: "signup" | "plus"; feature?: Feature; reason?: "trip_limit" };

/** Opens the sign-up or Plus screen (UpgradeSheet listens for this). */
export function requestUpgrade(request: UpgradeRequest) {
  window.dispatchEvent(new CustomEvent<UpgradeRequest>("nalu-upgrade", { detail: request }));
}

/**
 * One place to ask "does this person's plan include this?". `require` opens
 * the right screen when it doesn't. While the plan switches are off (Phase 1)
 * everything is allowed, except in a developer's tier preview.
 */
export function useGate() {
  const { tier, previewing } = useTier();
  const allows = (feature: Feature) => tierAllows(tier, feature, previewing);
  return {
    tier,
    allows,
    require(feature: Feature) {
      if (allows(feature)) return true;
      // Free-account features ask a guest to sign up; Plus features show Plus.
      requestUpgrade({ kind: FEATURE_TIER[feature] === "plus" ? "plus" : "signup", feature });
      return false;
    },
    /** Counts one "Where to?" trip check; guests past their daily limit see the sign-up screen. */
    tripCheck() {
      const result = consumeTripCheck(tier, new Date(), previewing);
      if (!result.allowed) requestUpgrade({ kind: "signup", reason: "trip_limit" });
      return result.allowed;
    },
  };
}
