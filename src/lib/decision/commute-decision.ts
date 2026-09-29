export type Recommendation = "rail" | "drive" | "same" | "none";
export type DecisionInput = {
  railMinutes: number | null;
  driveMinutes: number | null;
  driveAvailable: boolean;
  railLeaveBySeconds?: number | null;
  driveLeaveBySeconds?: number | null;
  driveDelayMinutes?: number | null;
  hasMajorIncident?: boolean;
  railWaitMinutes?: number | null;
  thresholdMinutes?: number;
};
export type CommuteDecision = {
  recommendation: Recommendation;
  differenceMinutes: number | null;
  explanation: string | null;
};

export function compareCommute(input: DecisionInput): CommuteDecision {
  const threshold = input.thresholdMinutes ?? 5;
  const drive = input.driveAvailable ? input.driveMinutes : null;
  if (input.railMinutes === null && drive === null)
    return { recommendation: "none", differenceMinutes: null, explanation: null };
  if (input.railMinutes === null)
    return {
      recommendation: "drive",
      differenceMinutes: null,
      explanation: "Driving is the available option right now",
    };
  if (drive === null)
    return {
      recommendation: "rail",
      differenceMinutes: null,
      explanation: input.driveAvailable
        ? "A current drive time could not be calculated"
        : "Driving is not available from your starting point",
    };
  const difference = drive - input.railMinutes;
  const recommendation: Recommendation =
    Math.abs(difference) < threshold ? "same" : difference > 0 ? "rail" : "drive";
  if (recommendation === "rail" && input.hasMajorIncident)
    return {
      recommendation,
      differenceMinutes: Math.abs(difference),
      explanation: "Rail avoids a reported traffic incident",
    };
  if (recommendation === "rail" && (input.driveDelayMinutes ?? 0) >= 5)
    return {
      recommendation,
      differenceMinutes: Math.abs(difference),
      explanation: `Rail avoids about ${input.driveDelayMinutes} min of traffic delay`,
    };
  if (
    recommendation === "drive" &&
    input.railWaitMinutes !== null &&
    input.railWaitMinutes !== undefined &&
    input.railWaitMinutes >= 10
  )
    return {
      recommendation,
      differenceMinutes: Math.abs(difference),
      explanation: `Driving avoids a ${input.railWaitMinutes} min wait for rail`,
    };
  if (recommendation === "same")
    return {
      recommendation,
      differenceMinutes: 0,
      explanation: "Both options should arrive at about the same time",
    };
  return {
    recommendation,
    differenceMinutes: Math.abs(difference),
    explanation:
      recommendation === "drive"
        ? `Driving is about ${Math.abs(difference)} min faster than rail and bus`
        : `Rail and bus are about ${Math.abs(difference)} min faster than driving`,
  };
}

export function compareArriveBy(
  input: {
    railLeaveBySeconds: number | null;
    railArriveSeconds: number | null;
    driveLeaveBySeconds: number | null;
    driveArriveSeconds: number | null;
  },
  thresholdMinutes = 5,
) {
  const haveRail = input.railLeaveBySeconds !== null && input.railArriveSeconds !== null;
  const haveDrive = input.driveLeaveBySeconds !== null && input.driveArriveSeconds !== null;
  if (!haveRail && !haveDrive)
    return { winner: "none" as const, laterMinutes: 0, earlierMinutes: 0 };
  if (!haveRail) return { winner: "drive" as const, laterMinutes: 0, earlierMinutes: 0 };
  if (!haveDrive) return { winner: "rail" as const, laterMinutes: 0, earlierMinutes: 0 };
  const later = Math.round(
    ((input.driveLeaveBySeconds ?? 0) - (input.railLeaveBySeconds ?? 0)) / 60,
  );
  const earlier = Math.round(
    ((input.railArriveSeconds ?? 0) - (input.driveArriveSeconds ?? 0)) / 60,
  );
  if (Math.abs(later) < thresholdMinutes)
    return { winner: "same" as const, laterMinutes: 0, earlierMinutes: 0 };
  return later > 0
    ? { winner: "drive" as const, laterMinutes: later, earlierMinutes: Math.max(0, earlier) }
    : {
        winner: "rail" as const,
        laterMinutes: Math.abs(later),
        earlierMinutes: Math.max(0, -earlier),
      };
}
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
      primary: evidence("service_availability", "Neither option is available for this trip"),
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
        primary: evidence("data_quality", "The available option's estimate is too old to rely on"),
        supporting: null,
      };
    return {
      state: winner,
      confidence: remaining.source.quality === "limited" ? "low" : "high",
      differenceMinutes: null,
      primary: evidence(
        "service_availability",
        winner === "drive"
          ? "No reachable rail trip is available"
          : "Your car is unavailable for this trip",
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
        `${drive.source.quality === "stale" ? "Traffic" : "Transit"} data is too old for a reliable comparison`,
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
  const wideUncertainty =
    Math.max(drive.uncertaintyMinutes ?? 0, rail.uncertaintyMinutes ?? 0) > 15;
  if (wideUncertainty && intervalsOverlap)
    return {
      state: "uncertain",
      confidence: "low",
      differenceMinutes: difference,
      primary: evidence("data_quality", "The arrival ranges overlap too widely to call a winner"),
      supporting: null,
    };
  if (drive.source.quality === "limited" || rail.source.quality === "limited") {
    if (difference < tossUp * 2)
      return {
        state: "uncertain",
        confidence: "low",
        differenceMinutes: difference,
        primary: evidence("data_quality", "One estimate has limited supporting data"),
        supporting: null,
      };
  }
  if (previous && previous !== faster && difference < tossUp + switchMargin)
    return {
      state: previous,
      confidence: "low",
      differenceMinutes: null,
      primary: evidence(
        "time_advantage",
        "Expected times are close; keeping the previous recommendation while estimates settle",
      ),
      supporting: null,
    };
  if (difference < tossUp || (intervalsOverlap && difference < tossUp * 2))
    return {
      state: "same",
      confidence: "moderate",
      differenceMinutes: difference,
      primary: evidence("time_advantage", "Expected arrivals are close and their ranges overlap"),
      supporting: null,
    };

  let primary = evidence(
    "time_advantage",
    `${faster === "drive" ? "Driving" : "Transit"} is expected to arrive about ${difference} min sooner`,
  );
  let supporting: DecisionEvidence | null = null;
  if (faster === "rail" && drive.majorIncident)
    supporting = evidence("major_incident", "A reported incident affects the drive");
  else if (faster === "rail" && (drive.trafficDelayMinutes ?? 0) >= 5)
    supporting = evidence(
      "traffic_delay",
      `The drive is running ${Math.round(drive.trafficDelayMinutes as number)} min slower than usual`,
    );
  else if (faster === "drive" && rail.transferMinutes >= 8)
    supporting = evidence(
      "transfer_wait",
      `A transit connection adds about ${Math.round(rail.transferMinutes)} min`,
    );
  else if (faster === "drive" && rail.busWaitMinutes >= 10)
    supporting = evidence(
      "bus_wait",
      `The bus connection adds about ${Math.round(rail.busWaitMinutes)} min`,
    );
  else if (faster === "drive" && rail.railWaitMinutes >= 10)
    supporting = evidence(
      "rail_wait",
      `The rail connection adds about ${Math.round(rail.railWaitMinutes)} min`,
    );
  if (faster === "rail" && drive.majorIncident && (drive.trafficDelayMinutes ?? 0) >= difference)
    [primary, supporting] = [supporting as DecisionEvidence, primary];
  return {
    state: faster,
    confidence: intervalsOverlap ? "moderate" : "high",
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
      primary: evidence("data_quality", "An arrival estimate is unavailable right now"),
      supporting: null,
    });
  if (drive.source.quality === "stale" || rail.source.quality === "stale")
    return result({
      state: "uncertain",
      confidence: "low",
      differenceMinutes: null,
      primary: evidence("data_quality", "An arrival estimate is too old to rely on"),
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
        "Future conditions are too uncertain for a reliable arrival comparison",
      ),
      supporting: null,
    });
  if (!driveFeasible && !railFeasible)
    return result({
      state: "none",
      confidence: "low",
      differenceMinutes: null,
      primary: evidence("arrival_margin", "Neither option is expected to arrive by your target"),
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
        `${winner === "drive" ? "Driving" : "Transit"} is the option expected to make your target`,
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
        `${winner === "drive" ? "Driving" : "Transit"} has enough margin even at the late end of its range`,
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
      primary: evidence("arrival_margin", "Driving arrives no later and lets you leave later"),
      supporting: null,
    });
  if (later <= 0 && earlier <= 0 && (-later >= 5 * 60 || -earlier >= 5 * 60))
    return result({
      state: "rail",
      confidence: "moderate",
      differenceMinutes: Math.round(-earlier / 60),
      primary: evidence("arrival_margin", "Transit arrives no later and lets you leave later"),
      supporting: null,
    });
  return result({
    state: "same",
    confidence: driveProtected && railProtected ? "moderate" : "low",
    differenceMinutes: Math.round(Math.abs(earlier) / 60),
    primary: evidence(
      "arrival_margin",
      "Both can make your target; one leaves later while the other arrives earlier",
    ),
    supporting: null,
  });
}
