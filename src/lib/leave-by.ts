/**
 * "Arrive by" planning: work backwards from a target arrival time to the
 * latest honest departure, for driving and for the rail chain.
 * Everything here is pure so the maths can be tested without the network.
 */

/** Parking plus the final walk at the destination end of a drive. */
export const DRIVE_BUFFER_MIN = 7;

export type DrivePlan = {
  /** Latest time to pull out of the driveway, in Honolulu seconds. */
  leaveBySeconds: number;
  /** When the rider is actually at the door. */
  arriveSeconds: number;
  /** False when leaving right now is already too late. */
  feasible: boolean;
  /** Earliest arrival possible if they left immediately. */
  earliestArriveSeconds: number;
  bufferMinutes: number;
};

export function driveArriveBy(
  arriveBySeconds: number,
  driveMinutes: number,
  nowSeconds: number,
  bufferMinutes = DRIVE_BUFFER_MIN,
): DrivePlan {
  const doorToDoor = (driveMinutes + bufferMinutes) * 60;
  const leaveBySeconds = arriveBySeconds - doorToDoor;
  const earliestArriveSeconds = nowSeconds + doorToDoor;
  const feasible = leaveBySeconds >= nowSeconds;
  return {
    leaveBySeconds: feasible ? leaveBySeconds : nowSeconds,
    arriveSeconds: feasible ? arriveBySeconds : earliestArriveSeconds,
    feasible,
    earliestArriveSeconds,
    bufferMinutes,
  };
}

export type RailPick<T> = {
  /** Latest itinerary that still lands at or before the target. */
  option: T | null;
  /** Soonest arrival any listed itinerary can manage. */
  earliestArriveSeconds: number | null;
  feasible: boolean;
};

/**
 * Pick the latest reachable rail itinerary arriving at or before the target.
 * Options are assumed to be the ones already reachable from now onwards.
 */
export function latestRailArrival<T extends { arrive_seconds: number; leave_by_seconds: number }>(
  options: T[],
  arriveBySeconds: number,
): RailPick<T> {
  if (!options.length) return { option: null, earliestArriveSeconds: null, feasible: false };
  let earliest = options[0]!.arrive_seconds;
  let best: T | null = null;
  for (const option of options) {
    if (option.arrive_seconds < earliest) earliest = option.arrive_seconds;
    if (option.arrive_seconds > arriveBySeconds) continue;
    if (!best || option.leave_by_seconds > best.leave_by_seconds) best = option;
  }
  return { option: best, earliestArriveSeconds: earliest, feasible: Boolean(best) };
}

export type ComparisonInput = {
  railLeaveBySeconds: number | null;
  railArriveSeconds: number | null;
  driveLeaveBySeconds: number | null;
  driveArriveSeconds: number | null;
};

export type Comparison = {
  winner: "rail" | "drive" | "same" | "none";
  /** Minutes of extra slack the winner buys before leaving. */
  laterMinutes: number;
  /** Minutes earlier the winner lands at the door. */
  earlierMinutes: number;
};

/** Which mode lets the rider leave later (the thing that matters when arriving by a time). */
export function compareArriveBy(input: ComparisonInput): Comparison {
  const haveRail = input.railLeaveBySeconds !== null && input.railArriveSeconds !== null;
  const haveDrive = input.driveLeaveBySeconds !== null && input.driveArriveSeconds !== null;
  if (!haveRail && !haveDrive) return { winner: "none", laterMinutes: 0, earlierMinutes: 0 };
  if (!haveRail) return { winner: "drive", laterMinutes: 0, earlierMinutes: 0 };
  if (!haveDrive) return { winner: "rail", laterMinutes: 0, earlierMinutes: 0 };

  const laterMinutes = Math.round((input.driveLeaveBySeconds! - input.railLeaveBySeconds!) / 60);
  const earlierMinutes = Math.round((input.railArriveSeconds! - input.driveArriveSeconds!) / 60);
  if (Math.abs(laterMinutes) < 5) return { winner: "same", laterMinutes: 0, earlierMinutes: 0 };
  return laterMinutes > 0
    ? { winner: "drive", laterMinutes, earlierMinutes: Math.max(0, earlierMinutes) }
    : { winner: "rail", laterMinutes: Math.abs(laterMinutes), earlierMinutes: Math.max(0, -earlierMinutes) };
}
