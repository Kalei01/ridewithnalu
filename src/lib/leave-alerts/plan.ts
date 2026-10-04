/**
 * "Time to leave" decisions: given the arrival time a rider asked for, live
 * drive time and the transit trips that make it, work out when to leave and
 * what to say. Pure, so the scheduled job and the tests share it.
 */

import { preferLessWalking } from "@/lib/rail/walk-preference";

/** Send this long before the leave time. */
export const HEADS_UP_SECONDS = 10 * 60;
/** Start checking this long before the arrival time. */
export const WINDOW_BEFORE_ARRIVAL_SECONDS = 3 * 60 * 60;

export type TransitLeg = {
  mode: string;
  minutes: number | null;
  route_short?: string | null;
  route_long?: string | null;
  depart_seconds: number | null;
  arrive_seconds: number | null;
};
export type TransitCandidate = {
  leave_by_seconds: number | null;
  depart_seconds: number;
  arrive_seconds: number;
  legs: TransitLeg[];
};

export type LeavePlan = {
  mode: "drive" | "transit";
  /** When to walk out the door, Honolulu seconds after midnight. */
  leaveBySeconds: number;
  /** When they reach the door at the other end. */
  arriveSeconds: number;
  /** True when the leave time has already passed: "leave now". */
  late: boolean;
  driveMinutes: number | null;
  parkingMinutes: number;
  trafficDelayMinutes: number;
  /** First vehicle for a transit plan, e.g. "Bus 54" or "Skyline". */
  rideLabel: string | null;
  rideDepartSeconds: number | null;
  /** For a drive plan: whether any bus or train would also have made it. */
  transitOnTime: boolean;
};

const isRide = (leg: TransitLeg) => leg.mode === "bus" || leg.mode === "rail";

function rideLabel(leg: TransitLeg | undefined): string | null {
  if (!leg) return null;
  if (leg.mode === "rail") return "Skyline";
  const route = leg.route_short?.trim() || leg.route_long?.trim();
  return route ? `Bus ${route}` : "the bus";
}

export function chooseLeave(input: {
  nowSeconds: number;
  targetArriveSeconds: number;
  drive: { trafficMinutes: number; delayMinutes: number } | null;
  parkingMinutes: number;
  transit: TransitCandidate[];
}): LeavePlan | null {
  const { nowSeconds, targetArriveSeconds, drive, parkingMinutes } = input;

  const driveLeave = drive
    ? targetArriveSeconds - (drive.trafficMinutes + parkingMinutes) * 60
    : null;

  // The latest transit trip that still gets there on time and can still be caught.
  const onTime = preferLessWalking(
    input.transit.filter(
      (option) =>
        option.arrive_seconds <= targetArriveSeconds &&
        (option.leave_by_seconds ?? option.depart_seconds) >= nowSeconds - 60,
    ),
  ).sort(
    (a, b) =>
      (b.leave_by_seconds ?? b.depart_seconds) - (a.leave_by_seconds ?? a.depart_seconds) ||
      a.arrive_seconds - b.arrive_seconds,
  )[0];
  const transitLeave = onTime ? (onTime.leave_by_seconds ?? onTime.depart_seconds) : null;

  // Whichever lets them leave later is the faster way to make it.
  if (transitLeave !== null && onTime && (driveLeave === null || transitLeave > driveLeave)) {
    const firstRide = onTime.legs.find(isRide);
    return {
      mode: "transit",
      leaveBySeconds: transitLeave,
      arriveSeconds: onTime.arrive_seconds,
      late: false,
      driveMinutes: drive?.trafficMinutes ?? null,
      parkingMinutes,
      trafficDelayMinutes: drive?.delayMinutes ?? 0,
      rideLabel: rideLabel(firstRide),
      rideDepartSeconds: firstRide?.depart_seconds ?? null,
      transitOnTime: true,
    };
  }

  if (!drive || driveLeave === null) return null;
  const late = driveLeave < nowSeconds;
  return {
    mode: "drive",
    leaveBySeconds: late ? nowSeconds : driveLeave,
    arriveSeconds: late
      ? nowSeconds + (drive.trafficMinutes + parkingMinutes) * 60
      : targetArriveSeconds,
    late,
    driveMinutes: drive.trafficMinutes,
    parkingMinutes,
    trafficDelayMinutes: drive.delayMinutes,
    rideLabel: null,
    rideDepartSeconds: null,
    transitOnTime: Boolean(onTime),
  };
}

export function shouldSend(plan: LeavePlan, nowSeconds: number) {
  return plan.late || plan.leaveBySeconds - nowSeconds <= HEADS_UP_SECONDS;
}

/** Seconds until the next look: sooner as the leave time gets close. */
export function nextCheckDelaySeconds(plan: LeavePlan, nowSeconds: number) {
  const untilHeadsUp = plan.leaveBySeconds - HEADS_UP_SECONDS - nowSeconds;
  return Math.min(20 * 60, Math.max(5 * 60, Math.round(untilHeadsUp / 2)));
}

function clock(seconds: number) {
  const wrapped = ((Math.round(seconds / 60) % 1440) + 1440) % 1440;
  const hour = Math.floor(wrapped / 60);
  const minute = wrapped % 60;
  return `${hour % 12 || 12}:${String(minute).padStart(2, "0")} ${hour < 12 ? "AM" : "PM"}`;
}

export function leaveMessage(plan: LeavePlan, placeLabel: string) {
  if (plan.late) {
    return {
      title: `Leave now for ${placeLabel}`,
      body: `Driving gets you there around ${clock(plan.arriveSeconds)}.`,
    };
  }
  if (plan.mode === "transit") {
    const ride =
      plan.rideLabel && plan.rideDepartSeconds !== null
        ? ` for ${plan.rideLabel} at ${clock(plan.rideDepartSeconds)}`
        : "";
    return {
      title: `Time to leave for ${placeLabel}`,
      body: `Leave by ${clock(plan.leaveBySeconds)}${ride}. You'll get there around ${clock(plan.arriveSeconds)}.`,
    };
  }
  const parking = plan.parkingMinutes > 1 ? " plus parking" : "";
  const traffic = plan.trafficDelayMinutes >= 10 ? " Traffic is heavier than usual." : "";
  return {
    title: `Time to leave for ${placeLabel}`,
    body: `Leave by ${clock(plan.leaveBySeconds)} to get there by ${clock(plan.arriveSeconds)}. ${plan.transitOnTime ? "Driving is faster today" : "No bus or train makes it in time, so drive"}: about ${plan.driveMinutes} min${parking}.${traffic}`,
  };
}
