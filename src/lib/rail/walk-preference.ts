/**
 * Keeps transit suggestions realistic about walking.
 *
 * The planners rank purely by arrival time, so a trip that walks 30+ minutes
 * to catch an earlier bus could beat a sensible one arriving a few minutes
 * later. These rules run over every planner's results before one is chosen.
 */

/** Furthest walk to the first stop or from the last stop: about 20 minutes at 3 mph. */
export const MAX_STOP_WALK_M = 1600;

/** Arrivals this close count as "about the same" when comparing walking. */
const SIMILAR_ARRIVAL_SECONDS = 5 * 60;
/** Walking saved before a slightly later trip is preferred. */
const MEANINGFUL_WALK_SAVING_MIN = 8;
/** A transfer trip whose ride is shorter than this is a pointless hop. */
const MIN_TRANSFER_RIDE_MIN = 3;

type Leg = {
  mode: string;
  minutes: number | null;
  route_short?: string | null;
  route_long?: string | null;
  depart_seconds: number | null;
  arrive_seconds: number | null;
};
type TransitOptionLike = { arrive_seconds: number; leave_by_seconds: number | null; legs: Leg[] };

const isRide = (leg: Leg) => leg.mode === "bus" || leg.mode === "rail";

/** Driving to a station needs a car; a walk-and-ride trip doesn't. */
export const needsCar = (option: TransitOptionLike) => option.legs.some((leg) => leg.mode === "drive");

/**
 * Driving counts as no walking, so without this a car trip would always "win"
 * the walking comparison. A trip that needs a car never pushes out one that
 * doesn't; the rider may not want to (or be able to) take the car.
 */
const mayReplace = (other: TransitOptionLike, option: TransitOptionLike) => !needsCar(other) || needsCar(option);

export function totalWalkMinutes(option: TransitOptionLike): number {
  return option.legs.reduce((sum, leg) => sum + (leg.mode === "walk" ? (leg.minutes ?? 0) : 0), 0);
}

/** One or two minutes on a bus just to transfer saves nothing and adds a missed-connection risk. */
function hasPointlessHop(option: TransitOptionLike): boolean {
  const rides = option.legs.filter(isRide);
  if (rides.length < 2) return false;
  return rides.some((leg) => leg.minutes !== null && leg.minutes < MIN_TRANSFER_RIDE_MIN);
}

/** Same vehicles at the same times: the same trip, whichever curb you wait on. */
function rideSignature(option: TransitOptionLike): string {
  return option.legs
    .filter(isRide)
    .map((leg) => `${leg.mode}:${leg.route_short || leg.route_long || ""}:${leg.depart_seconds}:${leg.arrive_seconds}`)
    .join("|");
}

export function preferLessWalking<T extends TransitOptionLike>(options: T[]): T[] {
  const sensible = options.filter((option) => !hasPointlessHop(option));
  // If every option is a hop (rare), keep them rather than show nothing.
  const pool = sensible.length ? sensible : options;

  const bySignature = new Map<string, T>();
  for (const option of pool) {
    const ridesKey = rideSignature(option);
    // Keep the walk and drive versions of the same trains apart.
    const key = ridesKey && (needsCar(option) ? `car|${ridesKey}` : ridesKey);
    const kept = bySignature.get(key);
    if (
      !key ||
      !kept ||
      totalWalkMinutes(option) < totalWalkMinutes(kept) ||
      (totalWalkMinutes(option) === totalWalkMinutes(kept) && option.arrive_seconds < kept.arrive_seconds)
    ) {
      bySignature.set(key || `${bySignature.size}`, option);
    }
  }
  const unique = Array.from(bySignature.values());

  return unique.filter(
    (option) =>
      !unique.some(
        (other) =>
          other !== option &&
          mayReplace(other, option) &&
          other.arrive_seconds <= option.arrive_seconds + SIMILAR_ARRIVAL_SECONDS &&
          totalWalkMinutes(other) <= totalWalkMinutes(option) - MEANINGFUL_WALK_SAVING_MIN,
      ),
  );
}

/**
 * Each extra transfer must save at least this much. A missed connection costs
 * a whole wait for the next bus (often 15 to 30 minutes), so a trip that is
 * only a few minutes faster but adds a transfer isn't worth the risk.
 */
export const MIN_SAVING_PER_EXTRA_TRANSFER_MIN = 10;

const rideCount = (option: TransitOptionLike) => option.legs.filter(isRide).length;

/** Drop trips whose extra transfers don't buy enough time over a simpler trip. */
export function preferFewerTransfers<T extends TransitOptionLike>(options: T[]): T[] {
  return options.filter(
    (option) =>
      !options.some((simpler) => {
        const extra = rideCount(option) - rideCount(simpler);
        if (simpler === option || extra <= 0 || rideCount(simpler) === 0) return false;
        if (!mayReplace(simpler, option)) return false;
        const savedMinutes = (simpler.arrive_seconds - option.arrive_seconds) / 60;
        return savedMinutes < MIN_SAVING_PER_EXTRA_TRANSFER_MIN * extra;
      }),
  );
}

/** Car legs shorter than this are the same; only a clearly shorter car leg is preferred. */
const MEANINGFUL_CAR_SAVING_MIN = 5;

const minutesOn = (option: TransitOptionLike, mode: string) =>
  option.legs.filter((leg) => leg.mode === mode).reduce((sum, leg) => sum + (leg.minutes ?? 0), 0);

/**
 * A trip with a car leg only counts as a Skyline trip when the train is the
 * bigger part. Two minutes on the train and a 26-minute car ride is just a
 * ride in a car; the Drive row already covers that.
 */
export function preferSkylineOverCar<T extends TransitOptionLike>(options: T[]): T[] {
  return options.filter((option) => {
    const car = minutesOn(option, "drive");
    return car === 0 || minutesOn(option, "rail") >= car;
  });
}

/**
 * Among trips that use a car and arrive about the same time, prefer the one
 * with the clearly shorter car leg: the station nearer the destination or
 * home. Whoever is driving would rather not cover most of the trip for a few
 * minutes saved, and a few minutes is not worth a long car leg.
 */
export function preferShorterCarLeg<T extends TransitOptionLike>(options: T[]): T[] {
  return options.filter(
    (option) =>
      !needsCar(option) ||
      !options.some(
        (other) =>
          other !== option &&
          needsCar(other) &&
          other.arrive_seconds <= option.arrive_seconds + SIMILAR_ARRIVAL_SECONDS &&
          minutesOn(other, "drive") <= minutesOn(option, "drive") - MEANINGFUL_CAR_SAVING_MIN,
      ),
  );
}
