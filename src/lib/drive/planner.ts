/** Pure, portable helpers for interpreting TomTom drive estimates. */
export const DRIVE_DESTINATION_BUFFER_MIN = 0;

export type DrivePlan = {
  leaveBySeconds: number;
  arriveSeconds: number;
  feasible: boolean;
  earliestArriveSeconds: number;
  bufferMinutes: number;
  estimated: boolean;
};

export function planDriveArrival(
  arriveBySeconds: number,
  driveMinutes: number,
  nowSeconds: number,
  bufferMinutes = DRIVE_DESTINATION_BUFFER_MIN,
  estimated = false,
): DrivePlan {
  const doorToDoorSeconds = (driveMinutes + bufferMinutes) * 60;
  const requestedLeave = arriveBySeconds - doorToDoorSeconds;
  const earliestArriveSeconds = nowSeconds + doorToDoorSeconds;
  const feasible = requestedLeave >= nowSeconds;
  return {
    leaveBySeconds: feasible ? requestedLeave : nowSeconds,
    arriveSeconds: feasible ? arriveBySeconds : earliestArriveSeconds,
    feasible,
    earliestArriveSeconds,
    bufferMinutes,
    estimated,
  };
}

export type DriveRangeSample = { trafficMinutes: number; lowMinutes: number; highMinutes: number };
export type DriveAccessRange = { lowMin: number; typicalMin: number; highMin: number };

export type BoundedDrivePlan = DrivePlan & {
  latestArrivalSeconds: number;
  protected: boolean;
  expectedDurationMinutes: number;
  converged: boolean;
  iterations: number;
  futureFailed: boolean;
};

/** Leave early enough for the late end of the road and destination-access range. */
export function planDriveArrivalWithRange(
  arriveBySeconds: number,
  sample: DriveRangeSample,
  access: DriveAccessRange,
  nowSeconds: number,
  metadata: {
    estimated?: boolean | undefined;
    converged?: boolean | undefined;
    iterations?: number | undefined;
    futureFailed?: boolean | undefined;
  } = {},
): BoundedDrivePlan {
  const requestedLeave = arriveBySeconds - (sample.highMinutes + access.highMin) * 60;
  const leaveBySeconds = Math.max(nowSeconds, requestedLeave);
  const arriveSeconds = leaveBySeconds + (sample.trafficMinutes + access.typicalMin) * 60;
  const latestArrivalSeconds = leaveBySeconds + (sample.highMinutes + access.highMin) * 60;
  return {
    leaveBySeconds,
    arriveSeconds,
    latestArrivalSeconds,
    feasible: arriveSeconds <= arriveBySeconds,
    protected: latestArrivalSeconds <= arriveBySeconds,
    earliestArriveSeconds: nowSeconds + (sample.trafficMinutes + access.typicalMin) * 60,
    expectedDurationMinutes: sample.trafficMinutes + access.typicalMin,
    bufferMinutes: access.highMin,
    estimated: Boolean(metadata.estimated),
    converged: metadata.converged ?? true,
    iterations: metadata.iterations ?? 0,
    futureFailed: Boolean(metadata.futureFailed),
  };
}

/** TomTom's departAt estimate depends on departure time; iterate with a hard bound. */
export async function solveFutureDrive<T extends DriveRangeSample>(input: {
  targetSeconds: number;
  nowSeconds: number;
  initial: T;
  access: DriveAccessRange;
  fetchAt: (departureSeconds: number) => Promise<T>;
  maxIterations?: number;
  toleranceSeconds?: number;
}): Promise<{
  sample: T;
  candidateSeconds: number;
  converged: boolean;
  iterations: number;
  futureFailed: boolean;
}> {
  const maxIterations = Math.max(1, Math.min(4, input.maxIterations ?? 3));
  const toleranceSeconds = Math.max(0, input.toleranceSeconds ?? 60);
  let sample = input.initial;
  let candidate = input.targetSeconds - (sample.highMinutes + input.access.highMin) * 60;
  let converged = false;
  let iterations = 0;
  let futureFailed = false;
  const cache = new Map<number, T>();
  while (iterations < maxIterations && candidate > input.nowSeconds) {
    const bucket = Math.floor(candidate / 300);
    try {
      let nextSample = cache.get(bucket);
      if (!nextSample) {
        nextSample = await input.fetchAt(candidate);
        cache.set(bucket, nextSample);
      }
      iterations += 1;
      sample = nextSample;
      const nextCandidate = input.targetSeconds - (sample.highMinutes + input.access.highMin) * 60;
      if (Math.abs(nextCandidate - candidate) <= toleranceSeconds) {
        candidate = nextCandidate;
        converged = true;
        break;
      }
      candidate = nextCandidate;
    } catch {
      futureFailed = true;
      break;
    }
  }
  return { sample, candidateSeconds: candidate, converged, iterations, futureFailed };
}

/** Convert a Honolulu seconds-since-midnight target into an ISO instant. */
export function honoluluSecondsToIso(seconds: number, reference = new Date()): string {
  const dateParts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Pacific/Honolulu",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(reference);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    dateParts.find((part) => part.type === type)?.value ?? "";
  const normalized = ((Math.round(seconds) % 86400) + 86400) % 86400;
  const hh = String(Math.floor(normalized / 3600)).padStart(2, "0");
  const mm = String(Math.floor((normalized % 3600) / 60)).padStart(2, "0");
  const ss = String(normalized % 60).padStart(2, "0");
  return `${read("year")}-${read("month")}-${read("day")}T${hh}:${mm}:${ss}-10:00`;
}
