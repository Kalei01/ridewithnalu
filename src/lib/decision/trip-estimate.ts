import type { DestinationAccess } from "../destination-access";

export type EstimateMode = "drive" | "rail";
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

/** All durations and arrival ranges describe the same door-to-door trip. */
export type TripEstimate = {
  mode: EstimateMode;
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

const DRIVE_FRESH_MS = 5 * 60_000;
const SCHEDULE_FRESH_MS = 10 * 60_000;

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
  const expected = drive.trafficMinutes + access.typicalMin;
  const earliest = departure + (drive.lowMinutes + access.lowMin) * 60;
  const latest = departure + (drive.highMinutes + access.highMin) * 60;
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
        (input.failed ? "limited" : qualityFor(drive.fetchedAt, nowMs, DRIVE_FRESH_MS)),
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
        : qualityFor(input.scheduleFetchedAt, nowMs, SCHEDULE_FRESH_MS),
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
  // Scheduled bus connections are less certain than a rail-only trip. This is a
  // bounded display range, not a claim of live vehicle prediction.
  const lateAllowance = 4 + Math.min(8, transfer * 0.5);
  const latest = option.arrive_seconds + lateAllowance * 60;
  return {
    mode: "rail",
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
    source:
      input.liveBusFetchedAt && nowMs - input.liveBusFetchedAt <= 90_000
        ? {
            name: "GTFS timetable + TheBus arrival",
            basis: "scheduled",
            fetchedAt: input.scheduleFetchedAt,
            quality: source.quality,
          }
        : source,
  };
}
