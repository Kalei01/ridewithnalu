import type { EvidenceQuality } from "./evidence-normalizer";

export type FreshnessClass = "realtime" | "scheduled" | "context";

export type FreshnessPolicy = {
  staleAfterMs: number;
  class: FreshnessClass;
};

export const FRESHNESS_POLICIES: Record<string, FreshnessPolicy> = {
  driveEta: { staleAfterMs: 5 * 60_000, class: "realtime" },
  transitSchedule: { staleAfterMs: 10 * 60_000, class: "scheduled" },
  incident: { staleAfterMs: 10 * 60_000, class: "context" },
  weather: { staleAfterMs: 30 * 60_000, class: "context" },
};

export function qualityFromAge(
  observedAt: number | null,
  now: number,
  policy: FreshnessPolicy,
  supplied: EvidenceQuality = "current",
): EvidenceQuality {
  if (supplied === "unavailable") return "unavailable";
  if (observedAt === null) return supplied === "current" ? "limited" : supplied;
  return now - observedAt > policy.staleAfterMs ? "stale" : supplied;
}

export function confidenceForFreshness(
  observedAt: number | null,
  now: number,
  policy: FreshnessPolicy,
  quality: EvidenceQuality,
): number {
  if (quality === "unavailable") return 0;
  if (quality === "limited") return 0.6;
  if (quality === "stale") return 0.2;
  if (observedAt === null) return 0.6;

  const age = Math.max(0, now - observedAt);
  const ratio = Math.min(1, age / policy.staleAfterMs);
  return Math.max(0.5, 0.95 - ratio * 0.35);
}
