import type { TripEstimate } from "./trip-estimate";
import {
  decideDriveVsTransit,
  decideDriveVsTransitArrival,
  type EvidenceKind,
  type DecisionModeEstimate,
} from "../intelligence/drive-transit-decision";
import { normalizeEvidence, type NormalizedEvidence } from "../intelligence/evidence-normalizer";
import { FRESHNESS_POLICIES } from "../intelligence/freshness-policy";

export type DecisionState = "drive" | "rail" | "same" | "none" | "uncertain";
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
      mode: item.mode,
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
      mode: item.mode,
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
    mode: item.mode,
    availability: item.availability,
    quality: eta?.quality === "stale" ? "stale" : item.source.quality,
    expectedMinutes: item.expectedDurationMinutes,
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
  };
}

export function decideTrip(
  drive: TripEstimate,
  rail: TripEstimate,
  previous: "drive" | "rail" | null = null,
  config: { tossUpMinutes?: number; switchMarginMinutes?: number } = {},
): TripDecision {
  return decideDriveVsTransit(
    toDecisionEstimate(drive),
    toDecisionEstimate(rail),
    previous,
    config,
  );
}

export type ArrivalDecision = TripDecision & {
  driveMarginMinutes: number | null;
  railMarginMinutes: number | null;
};

export function decideArrival(
  drive: TripEstimate,
  rail: TripEstimate,
  targetSeconds: number,
): ArrivalDecision {
  return decideDriveVsTransitArrival(
    toDecisionEstimate(drive),
    toDecisionEstimate(rail),
    targetSeconds,
  );
}
