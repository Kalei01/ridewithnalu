export type EvidenceMode = "drive" | "transit" | "rail" | "bus" | "weather" | "incident";
export type EvidenceQuality = "current" | "limited" | "stale" | "unavailable";
export type EvidenceImpact = "positive" | "neutral" | "negative" | "unknown";

export type NormalizedEvidence = {
  id: string;
  mode: EvidenceMode;
  source: string;
  value: number | string | boolean | null;
  unit?: string;
  observedAt: number | null;
  expiresAt: number | null;
  quality: EvidenceQuality;
  impact: EvidenceImpact;
  confidence: number;
  relevance: "route" | "trip" | "destination" | "general";
  detail?: string;
};

export type EvidenceInput = Omit<NormalizedEvidence, "quality" | "confidence"> & {
  quality?: EvidenceQuality;
  confidence?: number;
};

export type EvidencePolicy = {
  now?: number;
  staleAfterMs?: number;
  maxConfidence?: number;
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

function confidenceForQuality(
  quality: EvidenceQuality,
  observedAt: number | null,
  now: number,
  staleAfterMs: number,
): number {
  if (quality === "unavailable" || quality === "stale") {
    return quality === "stale" ? 0.2 : 0;
  }
  if (quality === "limited" || observedAt === null) return 0.6;

  const ageRatio = Math.min(1, Math.max(0, now - observedAt) / staleAfterMs);
  return Math.max(0.5, 0.95 - ageRatio * 0.35);
}

/**
 * Converts provider-specific facts into a stable Nalu evidence contract.
 * Providers should never be required to know how the Intelligence Core
 * consumes their data.
 */
export function normalizeEvidence(
  input: EvidenceInput,
  policy: EvidencePolicy = {},
): NormalizedEvidence {
  const now = policy.now ?? Date.now();
  const staleAfterMs = policy.staleAfterMs ?? 15 * 60_000;
  let quality = input.quality ?? "current";

  // A current claim without an observation timestamp cannot be verified as
  // current. Keep it usable, but explicitly downgrade it to limited.
  if (input.observedAt === null && quality === "current") {
    quality = "limited";
  } else if (input.observedAt !== null && now - input.observedAt > staleAfterMs) {
    quality = "stale";
  }

  if (input.expiresAt !== null && now >= input.expiresAt) {
    quality = "stale";
  }

  const confidence = clamp(
    input.confidence ??
      confidenceForQuality(quality, input.observedAt, now, staleAfterMs),
    0,
    policy.maxConfidence ?? 1,
  );

  return {
    ...input,
    quality,
    confidence,
  };
}

export function normalizeEvidenceBatch(
  inputs: EvidenceInput[],
  policy: EvidencePolicy = {},
): NormalizedEvidence[] {
  return inputs.map((input) => normalizeEvidence(input, policy));
}

export function bestEvidence(
  evidence: NormalizedEvidence[],
  predicate?: (item: NormalizedEvidence) => boolean,
): NormalizedEvidence | null {
  const candidates = predicate ? evidence.filter(predicate) : evidence;
  if (!candidates.length) return null;

  return [...candidates].sort((a, b) => {
    const qualityRank = (quality: EvidenceQuality) =>
      quality === "current" ? 4 : quality === "limited" ? 3 : quality === "stale" ? 2 : 1;
    const relevanceRank = (relevance: NormalizedEvidence["relevance"]) =>
      relevance === "route" ? 4 : relevance === "trip" ? 3 : relevance === "destination" ? 2 : 1;
    return (
      qualityRank(b.quality) - qualityRank(a.quality) ||
      relevanceRank(b.relevance) - relevanceRank(a.relevance) ||
      b.confidence - a.confidence
    );
  })[0] ?? null;
}
