export type DecisionMode = "drive" | "rail";

export type DecisionQuality = "good" | "limited" | "stale" | "unavailable";
export type DecisionAvailability =
  | "available"
  | "service-unavailable"
  | "car-unavailable"
  | "data-error";

export type DecisionModeEstimate = {
  mode: DecisionMode;
  availability: DecisionAvailability;
  quality: DecisionQuality;
  expectedMinutes: number | null;
  leaveTime: number | null;
  arrivalTime: number | null;
  earliestArrival: number | null;
  latestArrival: number | null;
  uncertaintyMinutes: number | null;
  trafficDelayMinutes: number | null;
  majorIncident: boolean;
  railWaitMinutes: number;
  busWaitMinutes: number;
  transferMinutes: number;
};

export type DriveTransitDecision = {
  state: "drive" | "rail" | "same" | "none" | "uncertain";
  confidence: "high" | "moderate" | "low";
  differenceMinutes: number | null;
  primary: { kind: EvidenceKind; text: string };
  supporting: { kind: EvidenceKind; text: string } | null;
};

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

export type ArrivalDecision = DriveTransitDecision & {
  driveMarginMinutes: number | null;
  railMarginMinutes: number | null;
};

const evidence = (kind: EvidenceKind, text: string) => ({ kind, text });

/**
 * Provider-neutral drive-vs-transit reasoning.
 *
 * This function intentionally knows nothing about TomTom, GTFS, TheBus,
 * Supabase, React, or UI wording beyond the user-facing reason strings.
 * Providers are converted into DecisionModeEstimate at the adapter boundary.
 */
export function decideDriveVsTransit(
  drive: DecisionModeEstimate,
  rail: DecisionModeEstimate,
  previous: "drive" | "rail" | null = null,
  config: { tossUpMinutes?: number; switchMarginMinutes?: number } = {},
): DriveTransitDecision {
  const tossUp = config.tossUpMinutes ?? 5;
  const switchMargin = config.switchMarginMinutes ?? 3;
  const unavailable = [drive, rail].filter((item) => item.availability !== "available");

  if (unavailable.some((item) => item.availability === "data-error")) {
    return {
      state: "uncertain",
      confidence: "low",
      differenceMinutes: null,
      primary: evidence(
        "data_quality",
        `${unavailable.find((item) => item.availability === "data-error")?.mode === "drive" ? "Drive time" : "Transit data"} is unavailable right now`,
      ),
      supporting: null,
    };
  }

  if (unavailable.length === 2) {
    return {
      state: "none",
      confidence: "low",
      differenceMinutes: null,
      primary: evidence("service_availability", "Neither option is available right now"),
      supporting: null,
    };
  }

  if (unavailable.length === 1) {
    const winner = unavailable[0]?.mode === "drive" ? "rail" : "drive";
    const remaining = winner === "drive" ? drive : rail;

    if (remaining.quality === "stale") {
      return {
        state: "uncertain",
        confidence: "low",
        differenceMinutes: null,
        primary: evidence(
          "data_quality",
          "The latest travel information is too old to rely on",
        ),
        supporting: null,
      };
    }

    return {
      state: winner,
      confidence: remaining.quality === "limited" ? "low" : "high",
      differenceMinutes: null,
      primary: evidence(
        "service_availability",
        winner === "drive"
          ? "There isn't a transit trip you can take right now"
          : "Your car isn't available for this trip",
      ),
      supporting: null,
    };
  }

  if (drive.quality === "stale" || rail.quality === "stale") {
    return {
      state: "uncertain",
      confidence: "low",
      differenceMinutes: null,
      primary: evidence(
        "data_quality",
        `${drive.quality === "stale" ? "Traffic" : "Transit"} information is too old for a reliable comparison`,
      ),
      supporting: null,
    };
  }

  const driveMinutes = drive.expectedMinutes as number;
  const railMinutes = rail.expectedMinutes as number;
  const difference = Math.round(Math.abs(driveMinutes - railMinutes));
  const faster: "drive" | "rail" = driveMinutes < railMinutes ? "drive" : "rail";
  const intervalsOverlap =
    (drive.earliestArrival as number) <= (rail.latestArrival as number) &&
    (rail.earliestArrival as number) <= (drive.latestArrival as number);

  const wideUncertainty =
    Math.max(drive.uncertaintyMinutes ?? 0, rail.uncertaintyMinutes ?? 0) > 15;
  const limitedData = drive.quality === "limited" || rail.quality === "limited";

  if (limitedData && difference < tossUp * 2) {
    return {
      state: "uncertain",
      confidence: "low",
      differenceMinutes: difference,
      primary: evidence(
        "data_quality",
        "One side doesn't have enough current information yet",
      ),
      supporting: null,
    };
  }

  if (previous && previous !== faster && difference < tossUp + switchMargin) {
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
  }

  if (difference < tossUp) {
    return {
      state: "same",
      confidence: wideUncertainty ? "low" : "moderate",
      differenceMinutes: difference,
      primary: evidence("time_advantage", "They're about the same time"),
      supporting: null,
    };
  }

  let primary = evidence(
    "time_advantage",
    `${faster === "drive" ? "Drive" : "Rail"} gets you there about ${difference} min sooner`,
  );
  let supporting: { kind: EvidenceKind; text: string } | null = null;

  if (faster === "rail" && drive.majorIncident)
    supporting = evidence(
      "major_incident",
      "There's a reported crash or slowdown on the drive",
    );
  else if (faster === "rail" && (drive.trafficDelayMinutes ?? 0) >= 5)
    supporting = evidence(
      "traffic_delay",
      `Traffic is adding about ${Math.round(drive.trafficDelayMinutes as number)} min to the drive`,
    );
  else if (faster === "drive" && rail.transferMinutes >= 8)
    supporting = evidence(
      "transfer_wait",
      `Changing rides adds about ${Math.round(rail.transferMinutes)} min`,
    );
  else if (faster === "drive" && rail.busWaitMinutes >= 10)
    supporting = evidence(
      "bus_wait",
      `The bus is adding about ${Math.round(rail.busWaitMinutes)} min of waiting`,
    );
  else if (faster === "drive" && rail.railWaitMinutes >= 10)
    supporting = evidence(
      "rail_wait",
      `The next train is adding about ${Math.round(rail.railWaitMinutes)} min`,
    );

  if (
    faster === "rail" &&
    drive.majorIncident &&
    (drive.trafficDelayMinutes ?? 0) >= difference
  ) {
    [primary, supporting] = [supporting as typeof primary, primary];
  }

  return {
    state: faster,
    confidence: wideUncertainty || intervalsOverlap ? "moderate" : "high",
    differenceMinutes: difference,
    primary,
    supporting,
  };
}

/**
 * Arrival-first reasoning uses the same normalized mode estimates.
 * Feasibility is evaluated before convenience or departure-time tradeoffs.
 */
export function decideDriveVsTransitArrival(
  drive: DecisionModeEstimate,
  rail: DecisionModeEstimate,
  targetSeconds: number,
): ArrivalDecision {
  const driveMargin =
    drive.arrivalTime === null ? null : (targetSeconds - drive.arrivalTime) / 60;
  const railMargin =
    rail.arrivalTime === null ? null : (targetSeconds - rail.arrivalTime) / 60;

  const result = (decision: DriveTransitDecision): ArrivalDecision => ({
    ...decision,
    driveMarginMinutes: driveMargin,
    railMarginMinutes: railMargin,
  });

  if (
    drive.availability === "data-error" ||
    rail.availability === "data-error"
  ) {
    return result({
      state: "uncertain",
      confidence: "low",
      differenceMinutes: null,
      primary: evidence("data_quality", "One arrival time isn't available right now"),
      supporting: null,
    });
  }

  if (drive.quality === "stale" || rail.quality === "stale") {
    return result({
      state: "uncertain",
      confidence: "low",
      differenceMinutes: null,
      primary: evidence("data_quality", "One arrival time is too old to rely on"),
      supporting: null,
    });
  }

  const driveFeasible = driveMargin !== null && driveMargin >= 0;
  const railFeasible = railMargin !== null && railMargin >= 0;

  if (
    (drive.quality === "limited" || rail.quality === "limited") &&
    (driveMargin === null ||
      railMargin === null ||
      Math.abs(driveMargin - railMargin) < 10)
  ) {
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
  }

  if (!driveFeasible && !railFeasible) {
    return result({
      state: "none",
      confidence: "low",
      differenceMinutes: null,
      primary: evidence(
        "arrival_margin",
        "Neither option is expected to get you there on time",
      ),
      supporting: null,
    });
  }

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

  if (later >= 0 && earlier >= 0 && (later >= 5 * 60 || earlier >= 5 * 60)) {
    return result({
      state: "drive",
      confidence: "moderate",
      differenceMinutes: Math.round(earlier / 60),
      primary: evidence(
        "arrival_margin",
        "You can leave later and still get there no later by car",
      ),
      supporting: null,
    });
  }

  if (later <= 0 && earlier <= 0 && (-later >= 5 * 60 || -earlier >= 5 * 60)) {
    return result({
      state: "rail",
      confidence: "moderate",
      differenceMinutes: Math.round(-earlier / 60),
      primary: evidence(
        "arrival_margin",
        "You can leave later and still get there no later by rail",
      ),
      supporting: null,
    });
  }

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
