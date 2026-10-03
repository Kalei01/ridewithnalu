import type { TripEstimate } from "./trip-estimate";
import {
  decideDriveVsTransit,
  decideDriveVsTransitArrival,
  type EvidenceKind,
  type DecisionModeEstimate,
} from "../intelligence/drive-transit-decision";
import { normalizeEvidence, type NormalizedEvidence } from "../intelligence/evidence-normalizer";
import { FRESHNESS_POLICIES } from "../intelligence/freshness-policy";

export type DecisionState = "drive" | "transit" | "same" | "none" | "uncertain";
export type { EvidenceKind };
export type DecisionEvidence = { kind: EvidenceKind; text: string };
export type TripDecision = {
  state: DecisionState;
  confidence: "high" | "moderate" | "low";
  differenceMinutes: number | null;
  primary: DecisionEvidence;
  supporting: DecisionEvidence | null;
};

export const DEFAULT_TOSS_UP_MINUTES = 5;
export const DEFAULT_SWITCH_MARGIN_MINUTES = 3;

function normalizeTripEvidence(item: TripEstimate): NormalizedEvidence[] {
  const source = item.mode === "drive" ? "drive-provider" : "transit-provider";
  const policy = item.mode === "drive" ? FRESHNESS_POLICIES.driveEta : FRESHNESS_POLICIES.transitSchedule;
  const quality =
    item.source.quality === "good" ? "current" : item.source.quality;
  const evidence: NormalizedEvidence[] = [
    normalizeEvidence({
      id: `${item.mode}-eta`,
      mode: item.mode === "drive" ? "drive" : "transit",
      source,
      value: item.expectedDurationMinutes,
      unit: "minutes",
      observedAt: item.source.fetchedAt,
      expiresAt: null,
      quality,
      impact: "neutral",
      relevance: "route",
      }, { staleAfterMs: policy.staleAfterMs, now: item.source.fetchedAt ?? Date.now() }),
  ];

  if (item.trafficDelayMinutes !== null) {
    evidence.push(normalizeEvidence({
      id: `${item.mode}-traffic-delay`,
      mode: item.mode === "drive" ? "drive" : "transit",
      source,
      value: item.trafficDelayMinutes,
      unit: "minutes",
      observedAt: item.source.fetchedAt,
      expiresAt: null,
      quality,
      impact: "negative",
      relevance: "route",
      }, { staleAfterMs: policy.staleAfterMs, now: item.source.fetchedAt ?? Date.now() }));
  }

  return evidence;
}

function toDecisionEstimate(item: TripEstimate): DecisionModeEstimate {
  const evidence = normalizeTripEvidence(item);
  const eta = evidence.find((entry) => entry.id.endsWith("-eta"));
  const traffic = evidence.find((entry) => entry.id.endsWith("-traffic-delay"));

  return {
    mode: item.mode === "drive" ? "drive" : "transit",
    availability: item.availability,
    quality: eta?.quality === "stale" ? "stale" : item.source.quality,
    // Compare door to door: drive includes parking and the walk in, transit
    // already includes walking and waiting.
    expectedMinutes: item.doorToDoorMinutes ?? item.expectedDurationMinutes,
    leaveTime: item.leaveTime,
    arrivalTime: item.arrivalTime,
    earliestArrival: item.earliestArrival,
    latestArrival: item.latestArrival,
    uncertaintyMinutes: item.uncertaintyMinutes,
    trafficDelayMinutes: traffic?.quality === "stale" ? null : item.trafficDelayMinutes,
    majorIncident: item.majorIncident,
    railWaitMinutes: item.railWaitMinutes,
    busWaitMinutes: item.busWaitMinutes,
    transferMinutes: item.transferMinutes,
    eligible: item.eligible,
  };
}

export function decideTrip(
  drive: TripEstimate,
  transit: TripEstimate,
  previous: "drive" | "transit" | null = null,
  config: { tossUpMinutes?: number; switchMarginMinutes?: number } = {},
): TripDecision {
  return decideDriveVsTransit(
    toDecisionEstimate(drive),
    toDecisionEstimate(transit),
    previous,
    config,
  );
}

/**
 * How many minutes the chosen mode saves. Null when the chosen mode is not
 * actually the faster one (the verdict kept its earlier call because the times
 * are close), so the UI never credits the slower mode with being "faster".
 */
export function verdictMarginMinutes(
  state: DecisionState,
  driveMinutes: number | null,
  transitMinutes: number | null,
): number | null {
  if (driveMinutes === null || transitMinutes === null) return null;
  const transitMinusDrive = transitMinutes - driveMinutes;
  if (state === "same") return Math.abs(transitMinusDrive);
  if (state === "drive") return transitMinusDrive > 0 ? transitMinusDrive : null;
  if (state === "transit") return transitMinusDrive < 0 ? -transitMinusDrive : null;
  return null;
}

export type ArrivalDecision = TripDecision & {
  driveMarginMinutes: number | null;
  transitMarginMinutes: number | null;
  /** @deprecated Compatibility alias for older UI consumers. */
  railMarginMinutes: number | null;
};

export function decideArrival(
  drive: TripEstimate,
  transit: TripEstimate,
  targetSeconds: number,
): ArrivalDecision {
  const result = decideDriveVsTransitArrival(
    toDecisionEstimate(drive),
    toDecisionEstimate(transit),
    targetSeconds,
  );
  return {
    ...result,
    railMarginMinutes: result.transitMarginMinutes,
  };
}
