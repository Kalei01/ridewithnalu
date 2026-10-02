import type { DestinationAccess } from "../destination-access";
import { FRESHNESS_POLICIES } from "../intelligence/freshness-policy";

export type EstimateMode = "drive" | "rail";
/** Actual public-transit family represented by the itinerary. Kept separate from the legacy drive-vs-rail decision mode while Phase 3 is rolled out. */
export type TransitMode = "walk" | "bus" | "rail" | "walk+bus" | "walk+rail" | "rail+bus" | "walk+rail+bus";
export type Availability = "available" | "service-unavailable" | "car-unavailable" | "data-error";
export type DataBasis = "live" | "scheduled" | "future-estimate";
export type DataQuality = "good" | "limited" | "stale" | "unavailable";

export type EstimateSource = {
  name: string;
  basis: DataBasis;
  /** This is when Nalu received the data, not necessarily when an agency published it. */
  fetchedAt: number | null;
  quality: DataQuality;
};

/** Drive duration is the canonical road ETA; parking/walking access is tracked separately. */
export type TripEstimate = {
  mode: EstimateMode;
  /** Actual public-transit family represented by the itinerary. */
  transitMode?: TransitMode;
  /** Human-facing transit family label, e.g. Bus or Rail + Bus. */
  transitLabel?: string;
  availability: Availability;
  leaveTime: number | null;
  arrivalTime: number | null;
  expectedDurationMinutes: number | null;
  earliestArrival: number | null;
  latestArrival: number | null;
  uncertaintyMinutes: number | null;
  arrivalMarginMinutes: number | null;
  waitMinutes: number;
  railWaitMinutes: number;
  busWaitMinutes: number;
  transferMinutes: number;
  walkingMinutes: number;
  trafficDelayMinutes: number | null;
  majorIncident: boolean;
  source: EstimateSource;
};

export type DriveSample = {
  trafficMinutes: number;
  lowMinutes: number;
  highMinutes: number;
  delayMinutes: number;
  fetchedAt: number;
  trafficBasis: "live" | "future-estimate";
};

export type TransitLeg = {
  mode: "walk" | "drive" | "bus" | "rail";
  depart_seconds: number | null;
  arrive_seconds: number | null;
  minutes: number | null;
};

export type TransitOption = {
  leave_by_seconds: number;
  arrive_seconds: number;
  total_minutes: number;
  legs: TransitLeg[];
};

function qualityFor(fetchedAt: number | null, nowMs: number, maxAgeMs: number): DataQuality {
  if (fetchedAt === null) return "limited";
  return nowMs - fetchedAt > maxAgeMs ? "stale" : "good";
}

function unavailable(
  mode: EstimateMode,
  availability: Availability,
  source: EstimateSource,
): TripEstimate {
  return {
    mode,
    availability,
    leaveTime: null,
    arrivalTime: null,
    expectedDurationMinutes: null,
    earliestArrival: null,
    latestArrival: null,
    uncertaintyMinutes: null,
    arrivalMarginMinutes: null,
    waitMinutes: 0,
    railWaitMinutes: 0,
    busWaitMinutes: 0,
    transferMinutes: 0,
    walkingMinutes: 0,
    trafficDelayMinutes: null,
    majorIncident: false,
    source,
  };
}

export function driveEstimate(input: {
  drive: DriveSample | null;
  access: DestinationAccess;
  nowSeconds: number;
  leaveAtSeconds?: number;
  nowMs: number;
  carAvailable: boolean;
  failed?: boolean;
  qualityOverride?: DataQuality;
  targetArrivalSeconds?: number | null;
  majorIncident?: boolean;
}): TripEstimate {
  const { drive, access, nowSeconds, nowMs } = input;
  if (!input.carAvailable)
    return unavailable("drive", "car-unavailable", {
      name: "TomTom",
      basis: "live",
      fetchedAt: null,
      quality: "unavailable",
    });
  if (!drive)
    return unavailable("drive", "data-error", {
      name: "TomTom",
      basis: "live",
      fetchedAt: null,
      quality: "unavailable",
    });
  const departure = input.leaveAtSeconds ?? nowSeconds;
  // The canonical current Drive ETA is the live road-travel estimate from
  // TomTom. Do not silently add a parking/walking buffer to the displayed
  // driving duration: that made the hero, saved Work view, verdict bars, and
  // Morning Pulse disagree about the same drive. Access time remains available
  // separately for explicit door-to-door/Arrive By calculations.
  const expected = drive.trafficMinutes;
  const earliest = departure + drive.lowMinutes * 60;
  const latest = departure + drive.highMinutes * 60;
  const arrival = departure + expected * 60;
  return {
    mode: "drive",
    availability: "available",
    leaveTime: departure,
    arrivalTime: arrival,
    expectedDurationMinutes: expected,
    earliestArrival: earliest,
    latestArrival: latest,
    uncertaintyMinutes: Math.max((arrival - earliest) / 60, (latest - arrival) / 60),
    arrivalMarginMinutes:
      input.targetArrivalSeconds == null ? null : (input.targetArrivalSeconds - arrival) / 60,
    waitMinutes: 0,
    railWaitMinutes: 0,
    busWaitMinutes: 0,
    transferMinutes: 0,
    walkingMinutes: access.typicalMin,
    trafficDelayMinutes: drive.delayMinutes,
    majorIncident: Boolean(input.majorIncident),
    source: {
      name: "TomTom",
      basis: drive.trafficBasis,
      fetchedAt: drive.fetchedAt,
      quality:
        input.qualityOverride ??
        (input.failed ? "limited" : qualityFor(drive.fetchedAt, nowMs, FRESHNESS_POLICIES.driveEta.staleAfterMs)),
    },
  };
}

export function transitEstimate(input: {
  option: TransitOption | null;
  nowSeconds: number;
  nowMs: number;
  scheduleFetchedAt: number | null;
  failed?: boolean;
  targetArrivalSeconds?: number | null;
  liveBusFetchedAt?: number | null;
  feedExpired?: boolean;
}): TripEstimate {
  const { option, nowSeconds, nowMs } = input;
  const source: EstimateSource = {
    name: "GTFS timetable",
    basis: "scheduled",
    fetchedAt: input.scheduleFetchedAt,
    quality: input.feedExpired
      ? "stale"
      : input.failed
        ? "limited"
        : qualityFor(input.scheduleFetchedAt, nowMs, FRESHNESS_POLICIES.transitSchedule.staleAfterMs),
  };
  if (!option)
    return unavailable("rail", input.failed ? "data-error" : "service-unavailable", source);

  let railWait = 0;
  let busWait = 0;
  let transfer = 0;
  let walking = 0;
  let previousArrival: number | null = null;
  let previousTransit = false;
  for (const leg of option.legs) {
    if (leg.mode === "walk") walking += Math.max(0, leg.minutes ?? 0);
    if (previousArrival !== null && leg.depart_seconds !== null) {
      const gap = Math.max(0, (leg.depart_seconds - previousArrival) / 60);
      if (leg.mode === "rail") railWait += gap;
      if (leg.mode === "bus") busWait += gap;
      if (previousTransit && (leg.mode === "bus" || leg.mode === "rail")) transfer += gap;
    }
    previousArrival = leg.arrive_seconds;
    previousTransit = leg.mode === "bus" || leg.mode === "rail";
  }
  const initialWait = Math.max(0, (option.leave_by_seconds - nowSeconds) / 60);
  const expected = Math.max(0, (option.arrive_seconds - nowSeconds) / 60);
  const hasWalk = option.legs.some((leg) => leg.mode === "walk");
  const hasBus = option.legs.some((leg) => leg.mode === "bus");
  const hasRail = option.legs.some((leg) => leg.mode === "rail");
  const transitModes = option.legs
    .map((leg) => leg.mode)
    .filter((mode): mode is "bus" | "rail" => mode === "bus" || mode === "rail");
  const transitLabel = transitModes.length
    ? transitModes.map((mode) => mode === "rail" ? "Rail" : "Bus").join(" + ")
    : "Walk";
  const transitMode: TransitMode =
    hasRail && hasBus && hasWalk ? "walk+rail+bus"
      : hasRail && hasBus ? "rail+bus"
        : hasRail && hasWalk ? "walk+rail"
          : hasBus && hasWalk ? "walk+bus"
            : hasRail ? "rail"
              : hasBus ? "bus"
                : "walk";
  // Scheduled bus connections are less certain than a rail-only trip. This is a
  // bounded display range, not a claim of live vehicle prediction.
  const lateAllowance = 4 + Math.min(8, transfer * 0.5);
  const latest = option.arrive_seconds + lateAllowance * 60;
  return {
    mode: "rail",
    transitMode,
    transitLabel,
    availability: "available",
    leaveTime: option.leave_by_seconds,
    arrivalTime: option.arrive_seconds,
    expectedDurationMinutes: expected,
    earliestArrival: option.arrive_seconds - 60,
    latestArrival: latest,
    uncertaintyMinutes: lateAllowance,
    arrivalMarginMinutes:
      input.targetArrivalSeconds == null
        ? null
        : (input.targetArrivalSeconds - option.arrive_seconds) / 60,
    waitMinutes: initialWait + railWait + busWait,
    railWaitMinutes: railWait,
    busWaitMinutes: busWait,
    transferMinutes: transfer,
    walkingMinutes: walking,
    trafficDelayMinutes: null,
    majorIncident: false,
    // The live bus check is used by the trip/navigation flow separately; this
    // estimate's arrival time remains schedule-based. Do not label a scheduled
    // ETA as live merely because a live vehicle check was performed.
    source,
  };
}
