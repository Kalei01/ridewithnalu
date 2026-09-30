import type { TripEstimate } from "./trip-estimate";

export type DecisionState = "drive" | "rail" | "same" | "none" | "uncertain";
export type EvidenceKind =
  | "time_advantage"
  | "traffic_delay"
  | "major_incident"
  | "rail_wait"
  | "bus_wait"
  | "transfer_wait"
  | "arrival_margin"
  | "data_quality"
  | "service_availability";
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

const evidence = (kind: EvidenceKind, text: string): DecisionEvidence => ({ kind, text });

/** Expected arrival from the same departure instant is primary; ranges express confidence. */
export function decideTrip(
  drive: TripEstimate,
  rail: TripEstimate,
  previous: "drive" | "rail" | null = null,
  config: { tossUpMinutes?: number; switchMarginMinutes?: number } = {},
): TripDecision {
  const tossUp = config.tossUpMinutes ?? DEFAULT_TOSS_UP_MINUTES;
  const switchMargin = config.switchMarginMinutes ?? DEFAULT_SWITCH_MARGIN_MINUTES;
  const unavailable = [drive, rail].filter((item) => item.availability !== "available");
  if (unavailable.some((item) => item.availability === "data-error"))
    return {
      state: "uncertain",
      confidence: "low",
      differenceMinutes: null,
      primary: evidence(
        "data_quality",
        `${unavailable.find((item) => item.availability === "data-error")?.mode === "drive" ? "Drive time" : "Rail data"} is unavailable right now`,
      ),
      supporting: null,
    };
  if (unavailable.length === 2)
    return {
      state: "none",
      confidence: "low",
      differenceMinutes: null,
      primary: evidence("service_availability", "Neither option is available right now"),
      supporting: null,
    };
  if (unavailable.length === 1) {
    const winner = unavailable[0]?.mode === "drive" ? "rail" : "drive";
    const remaining = winner === "drive" ? drive : rail;
    if (remaining.source.quality === "stale")
      return {
        state: "uncertain",
        confidence: "low",
        differenceMinutes: null,
        primary: evidence("data_quality", "The latest travel information is too old to rely on"),
        supporting: null,
      };
    return {
      state: winner,
      confidence: remaining.source.quality === "limited" ? "low" : "high",
      differenceMinutes: null,
      primary: evidence(
        "service_availability",
        winner === "drive"
          ? "There isn't a rail trip you can take right now"
          : "Your car isn't available for this trip",
      ),
      supporting: null,
    };
  }
  if (drive.source.quality === "stale" || rail.source.quality === "stale")
    return {
      state: "uncertain",
      confidence: "low",
      differenceMinutes: null,
      primary: evidence(
        "data_quality",
        `${drive.source.quality === "stale" ? "Traffic" : "Transit"} information is too old for a reliable comparison`,
      ),
      supporting: null,
    };

  const driveMinutes = drive.expectedDurationMinutes as number;
  const railMinutes = rail.expectedDurationMinutes as number;
  const difference = Math.round(Math.abs(driveMinutes - railMinutes));
  const faster: "drive" | "rail" = driveMinutes < railMinutes ? "drive" : "rail";
  const intervalsOverlap =
    (drive.earliestArrival as number) <= (rail.latestArrival as number) &&
    (rail.earliestArrival as number) <= (drive.latestArrival as number);

  // Uncertainty affects confidence, not the directional result. If both current
  // estimates are available and one is materially faster, keep that verdict.
  // This prevents overlapping ranges from turning a clear expected-time
  // difference into "Data uncertain".
  const wideUncertainty =
    Math.max(drive.uncertaintyMinutes ?? 0, rail.uncertaintyMinutes ?? 0) > 15;
  const limitedData = drive.source.quality === "limited" || rail.source.quality === "limited";

  if (limitedData && difference < tossUp * 2)
    return {
      state: "uncertain",
      confidence: "low",
      differenceMinutes: difference,
      primary: evidence("data_quality", "One side doesn't have enough current information yet"),
      supporting: null,
    };

  if (previous && previous !== faster && difference < tossUp + switchMargin)
    return {
      state: previous,
      confidence: "low",
      differenceMinutes: null,
      primary: evidence(
        "time_advantage",
        "The times are close, so Nalu is keeping the previous call for now",
      ),
      supporting: null,
    };

  if (difference < tossUp)
    return {
      state: "same",
      confidence: wideUncertainty ? "low" : "moderate",
      differenceMinutes: difference,
      primary: evidence("time_advantage", "They're about the same time"),
      supporting: null,
    };

  let primary = evidence(
    "time_advantage",
    `${faster === "drive" ? "Drive" : "Rail"} gets you there about ${difference} min sooner`,
  );
  let supporting: DecisionEvidence | null = null;
  if (faster === "rail" && drive.majorIncident)
    supporting = evidence("major_incident", "There's a reported crash or slowdown on the drive");
  else if (faster === "rail" && (drive.trafficDelayMinutes ?? 0) >= 5)
    supporting = evidence(
      "traffic_delay",
      `Traffic is adding about ${Math.round(drive.trafficDelayMinutes as number)} min to the drive`,
    );
  else if (faster === "drive" && rail.transferMinutes >= 8)
    supporting = evidence(
      "transfer_wait",
      `The connection adds about ${Math.round(rail.transferMinutes)} min`,
    );
  else if (faster === "drive" && rail.busWaitMinutes >= 10)
    supporting = evidence(
      "bus_wait",
      `The bus is adding about ${Math.round(rail.busWaitMinutes)} min of waiting`,
    );
  else if (faster === "drive" && rail.railWaitMinutes >= 10)
    supporting = evidence(
      "rail_wait",
      `The next train is adding about ${Math.round(rail.railWaitMinutes)} min of waiting`,
    );
  if (faster === "rail" && drive.majorIncident && (drive.trafficDelayMinutes ?? 0) >= difference)
    [primary, supporting] = [supporting as DecisionEvidence, primary];
  return {
    state: faster,
    confidence: wideUncertainty || intervalsOverlap ? "moderate" : "high",
    differenceMinutes: difference,
    primary,
    supporting,
  };
}

export type ArrivalDecision = TripDecision & {
  driveMarginMinutes: number | null;
  railMarginMinutes: number | null;
};

/** Arrival feasibility and protection come before the convenience of leaving later. */
export function decideArrival(
  drive: TripEstimate,
  rail: TripEstimate,
  targetSeconds: number,
): ArrivalDecision {
  const driveMargin = drive.arrivalTime === null ? null : (targetSeconds - drive.arrivalTime) / 60;
  const railMargin = rail.arrivalTime === null ? null : (targetSeconds - rail.arrivalTime) / 60;
  const result = (decision: TripDecision): ArrivalDecision => ({
    ...decision,
    driveMarginMinutes: driveMargin,
    railMarginMinutes: railMargin,
  });
  if (drive.availability === "data-error" || rail.availability === "data-error")
    return result({
      state: "uncertain",
      confidence: "low",
      differenceMinutes: null,
      primary: evidence("data_quality", "One arrival time isn't available right now"),
      supporting: null,
    });
  if (drive.source.quality === "stale" || rail.source.quality === "stale")
    return result({
      state: "uncertain",
      confidence: "low",
      differenceMinutes: null,
      primary: evidence("data_quality", "One arrival time is too old to rely on"),
      supporting: null,
    });
  const driveFeasible = driveMargin !== null && driveMargin >= 0;
  const railFeasible = railMargin !== null && railMargin >= 0;
  if (
    (drive.source.quality === "limited" || rail.source.quality === "limited") &&
    (driveMargin === null || railMargin === null || Math.abs(driveMargin - railMargin) < 10)
  )
    return result({
      state: "uncertain",
      confidence: "low",
      differenceMinutes: null,
      primary: evidence(
        "data_quality",
        "Future traffic and transit times are too uncertain to compare reliably",
      ),
      supporting: null,
    });
  if (!driveFeasible && !railFeasible)
    return result({
      state: "none",
      confidence: "low",
      differenceMinutes: null,
      primary: evidence("arrival_margin", "Neither option is expected to get you there on time"),
      supporting: null,
    });
  if (driveFeasible !== railFeasible) {
    const winner = driveFeasible ? "drive" : "rail";
    return result({
      state: winner,
      confidence: "moderate",
      differenceMinutes: null,
      primary: evidence(
        "arrival_margin",
        `${winner === "drive" ? "Drive" : "Rail"} is the option that can get you there on time`,
      ),
      supporting: null,
    });
  }
  const driveProtected = (drive.latestArrival ?? Infinity) <= targetSeconds;
  const railProtected = (rail.latestArrival ?? Infinity) <= targetSeconds;
  if (driveProtected !== railProtected) {
    const winner = driveProtected ? "drive" : "rail";
    return result({
      state: winner,
      confidence: "moderate",
      differenceMinutes: null,
      primary: evidence(
        "arrival_margin",
        `${winner === "drive" ? "Drive" : "Rail"} still gets you there on time if things run a little late`,
      ),
      supporting: null,
    });
  }
  const later = (drive.leaveTime as number) - (rail.leaveTime as number);
  const earlier = (rail.arrivalTime as number) - (drive.arrivalTime as number);
  // A mode wins only when it is no worse on both arrival and departure and
  // materially better on one. Otherwise the tradeoff belongs to the rider.
  if (later >= 0 && earlier >= 0 && (later >= 5 * 60 || earlier >= 5 * 60))
    return result({
      state: "drive",
      confidence: "moderate",
      differenceMinutes: Math.round(earlier / 60),
      primary: evidence("arrival_margin", "You can leave later and still get there no later by car"),
      supporting: null,
    });
  if (later <= 0 && earlier <= 0 && (-later >= 5 * 60 || -earlier >= 5 * 60))
    return result({
      state: "rail",
      confidence: "moderate",
      differenceMinutes: Math.round(-earlier / 60),
      primary: evidence("arrival_margin", "You can leave later and still get there no later by rail"),
      supporting: null,
    });
  return result({
    state: "same",
    confidence: driveProtected && railProtected ? "moderate" : "low",
    differenceMinutes: Math.round(Math.abs(earlier) / 60),
    primary: evidence(
      "arrival_margin",
      "Both can get you there on time; one lets you leave later while the other gets you there sooner",
    ),
    supporting: null,
  });
}
