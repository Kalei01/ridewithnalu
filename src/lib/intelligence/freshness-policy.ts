export type FreshnessClass = "realtime" | "scheduled" | "context";

export type FreshnessPolicy = {
  staleAfterMs: number;
  class: FreshnessClass;
};

export type FreshnessPolicies = {
  driveEta: FreshnessPolicy;
  transitSchedule: FreshnessPolicy;
  incident: FreshnessPolicy;
  weather: FreshnessPolicy;
};

export const FRESHNESS_POLICIES: FreshnessPolicies = {
  driveEta: { staleAfterMs: 5 * 60_000, class: "realtime" },
  transitSchedule: { staleAfterMs: 10 * 60_000, class: "scheduled" },
  incident: { staleAfterMs: 10 * 60_000, class: "context" },
  weather: { staleAfterMs: 30 * 60_000, class: "context" },
};

export type FreshnessQuality = "current" | "limited" | "stale" | "unavailable";

export function qualityFromAge(observedAt: number | null, now: number, policy: FreshnessPolicy, supplied: FreshnessQuality = "current"): FreshnessQuality {
  if (supplied === "unavailable") return "unavailable";
  if (observedAt === null) return supplied === "current" ? "limited" : supplied;
  return now - observedAt > policy.staleAfterMs ? "stale" : supplied;
}

export function confidenceForFreshness(observedAt: number | null, now: number, policy: FreshnessPolicy, supplied: FreshnessQuality = "current"): number {
  const quality = qualityFromAge(observedAt, now, policy, supplied);
  if (quality === "unavailable") return 0;
  if (quality === "stale") return 0.2;
  if (quality === "limited") return 0.6;
  if (observedAt === null) return 0.6;
  const ageRatio = Math.max(0, (now - observedAt) / policy.staleAfterMs);
  return Math.max(0.5, 0.95 - ageRatio * 0.45);
}
