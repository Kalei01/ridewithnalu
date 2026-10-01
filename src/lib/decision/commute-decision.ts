import type { TripEstimate } from "./trip-estimate";
import {
  decideDriveVsTransit,
  decideDriveVsTransitArrival,
  type EvidenceKind,
  type DecisionModeEstimate,
} from "../intelligence/drive-transit-decision";

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

function toDecisionEstimate(item: TripEstimate): DecisionModeEstimate {
  return {
    mode: item.mode,
    availability: item.availability,
    quality: item.source.quality,
    expectedMinutes: item.expectedDurationMinutes,
    leaveTime: item.leaveTime,
    arrivalTime: item.arrivalTime,
    earliestArrival: item.earliestArrival,
    latestArrival: item.latestArrival,
    uncertaintyMinutes: item.uncertaintyMinutes,
    trafficDelayMinutes: item.trafficDelayMinutes,
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

/**
 * Adapter boundary: the production UI keeps its existing TripEstimate API,
 * while the reusable reasoning now lives in the Intelligence Core.
 */
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
