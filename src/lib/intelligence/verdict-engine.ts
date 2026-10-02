import type { NaluDecision, DecisionReason, EvidenceFreshness } from "./types";
import type { CanonicalTrip } from "./trip-model";
import { decideDriveVsTransit, type DecisionModeEstimate } from "./drive-transit-decision";

export type VerdictEngineInput = {
  trip: CanonicalTrip;
  estimates: DecisionModeEstimate[];
  previousMode?: "drive" | "rail" | null;
  now?: number;
  tossUpMinutes?: number;
  switchMarginMinutes?: number;
};

function toFreshness(trip: CanonicalTrip): EvidenceFreshness[] {
  return trip.routes.flatMap((route) =>
    route.segments
      .filter((segment) => segment.observedAt !== null)
      .map((segment) => ({
        observedAt: new Date(segment.observedAt! * 1000).toISOString(),
        source: segment.source,
      })),
  );
}

/**
 * Central Nalu verdict: turns normalized route evidence into the provider-neutral
 * decision contract. UI surfaces should consume this result instead of recreating
 * drive-vs-rail reasoning independently.
 */
export function createNaluVerdict(input: VerdictEngineInput): NaluDecision {
  const drive = input.estimates.find((item) => item.mode === "drive");
  const rail = input.estimates.find((item) => item.mode === "rail");
  const freshness = toFreshness(input.trip);

  if (!drive || !rail) {
    return {
      selectedMode: null,
      alternatives: input.trip.routes.map((route) => route.mode),
      reasons: [{
        text: "A complete drive-versus-rail comparison is not available yet",
        evidence: ["missing-mode-data"],
      }],
      warnings: ["One or more travel options are missing."],
      freshness,
      confidence: "low",
    };
  }

  const decisionOptions: { tossUpMinutes?: number; switchMarginMinutes?: number } = {};
  if (input.tossUpMinutes !== undefined) decisionOptions.tossUpMinutes = input.tossUpMinutes;
  if (input.switchMarginMinutes !== undefined) decisionOptions.switchMarginMinutes = input.switchMarginMinutes;

  const decision = decideDriveVsTransit(
    drive,
    rail,
    input.previousMode ?? null,
    decisionOptions,
  );

  const routeByMode = new Map(input.trip.routes.map((route) => [route.mode, route]));
  const selectedRoute =
    decision.state === "drive" || decision.state === "rail"
      ? routeByMode.get(decision.state)
      : undefined;

  const alternatives = input.trip.routes
    .filter((route) => route.id !== selectedRoute?.id)
    .map((route) => route.mode);

  const reasons: DecisionReason[] = [{
    text: decision.primary.text,
    evidence: [decision.primary.kind],
  }];

  if (decision.supporting) {
    reasons.push({
      text: decision.supporting.text,
      evidence: [decision.supporting.kind],
    });
  }

  const warnings: string[] = [];
  for (const estimate of input.estimates) {
    if (estimate.availability !== "available") {
      warnings.push(
        `${estimate.mode === "drive" ? "Drive" : "Rail"} is ${estimate.availability.replaceAll("-", " ")}.`,
      );
    }
    if (estimate.quality === "stale") {
      warnings.push(
        `${estimate.mode === "drive" ? "Traffic" : "Transit"} information may be out of date.`,
      );
    }
  }

  return {
    selectedMode:
      decision.state === "drive" || decision.state === "rail"
        ? decision.state
        : null,
    alternatives,
    departureTime: selectedRoute?.departureTime == null
      ? null
      : new Date(selectedRoute.departureTime * 1000).toISOString(),
    arrivalTime: selectedRoute?.arrivalTime == null
      ? null
      : new Date(selectedRoute.arrivalTime * 1000).toISOString(),
    reasons,
    warnings,
    freshness,
    confidence: decision.confidence === "moderate" ? "medium" : decision.confidence,
  };
}

