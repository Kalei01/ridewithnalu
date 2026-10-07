/**
 * The three kinds of trip Nalu compares side by side:
 *
 * - Drive: door to door (the drive estimate, not a transit option).
 * - Skyline: any trip that rides Skyline, however the rider reaches the
 *   station: on foot, by bus, driving and parking at a lot, or being dropped
 *   off. A walk from the airport station counts as much as a drive to Keoneʻae.
 * - Bus: trips that stay on TheBus.
 *
 * Which of these exist for a rider depends on their trip access (see
 * trip-access.ts); this module only groups what the planner returned.
 */
import { latestRailArrival } from "@/lib/rail/planner";
import type { Option } from "@/lib/commute-model";
import { PARK_AND_RIDE_NAMES } from "@/lib/rail/park-and-ride";
import { stationLabel } from "@/lib/commute-formatting";

/** Uses a car for part of the trip (driven by the rider or by someone else). */
export const needsCar = (option: Option) => option.legs.some((leg) => leg.mode === "drive");

/** Rides Skyline for part of the trip. */
export const usesSkyline = (option: Option) => option.legs.some((leg) => leg.mode === "rail");

export type ChoicePick = { option: Option | null; makesIt: boolean };

/** A card's trip: first in planner order, or for Arrive By the latest that still makes it. */
function pick(options: Option[], arriveByTarget: number | null): ChoicePick {
  if (!options.length) return { option: null, makesIt: false };
  if (arriveByTarget === null) return { option: options[0] ?? null, makesIt: true };
  const preferred = latestRailArrival(
    options.filter((option) => !option.extraTransfers),
    arriveByTarget,
  );
  if (preferred.option) return { option: preferred.option, makesIt: true };
  const any = latestRailArrival(options, arriveByTarget);
  if (any.option) return { option: any.option, makesIt: true };
  // Nothing makes the target: show the earliest arrival, marked as late.
  const earliest = options.reduce((a, b) => (b.arrive_seconds < a.arrive_seconds ? b : a));
  return { option: earliest, makesIt: false };
}

export function transitChoices(options: Option[], arriveByTarget: number | null) {
  return {
    skyline: pick(options.filter(usesSkyline), arriveByTarget),
    bus: pick(
      options.filter((option) => !usesSkyline(option)),
      arriveByTarget,
    ),
  };
}

/**
 * "Drive to UH West Oʻahu → Skyline → Bus 42", "Walk → Bus 91". A car leg to a
 * station without a park-and-ride lot can only be a drop-off, so it reads
 * "Dropped off at Waiawa".
 */
export function tripSteps(option: Option): string {
  const steps: string[] = [];
  option.legs.forEach((leg, index) => {
    if (leg.mode === "drive" && index === option.legs.length - 1 && index > 0) {
      // A car at the end of the trip: someone picks the rider up at the station.
      const name =
        (leg.from_stop_id ? PARK_AND_RIDE_NAMES[leg.from_stop_id] : undefined) ??
        (leg.from ? stationLabel(leg.from) : undefined);
      steps.push(name ? `Picked up at ${name}` : "Picked up");
    } else if (leg.mode === "drive") {
      const lot = leg.to_stop_id ? PARK_AND_RIDE_NAMES[leg.to_stop_id] : undefined;
      const station = lot ?? (leg.to_stop_id && leg.to ? stationLabel(leg.to) : undefined);
      if (!station) steps.push("Drive");
      else
        steps.push(
          lot ? `Drive to ${station} (parking not included)` : `Dropped off at ${station}`,
        );
    } else if (leg.mode === "rail") steps.push("Skyline");
    else if (leg.mode === "bus") {
      const route = leg.route_short?.trim() || leg.route_long?.trim();
      steps.push(route ? `Bus ${route}` : "Bus");
    } else if (leg.mode === "walk" && index === 0 && (leg.minutes ?? 0) >= 1) steps.push("Walk");
  });
  return steps.join(" → ");
}

/** Keoneʻae (UH West Oʻahu) park-and-ride. */
const KEONEAE = "10046";

/**
 * Hawaii News Now reported in May 2026 that the Keoneʻae lot fills by around
 * 8 AM on weekdays and that riders then park on a nearby empty grass lot. Nalu
 * can't see the lot, so it never assumes "full": for weekday trips reaching
 * the station from 7 to 11 AM it says what is known and names Honouliuli, the
 * next station toward town, which also has a lot (City Stations and Parking).
 */
export function parkingNote(option: Option | null, isoDow: number): string | null {
  const access = option?.legs[0];
  if (!access || access.mode !== "drive" || access.to_stop_id !== KEONEAE) return null;
  if (isoDow < 1 || isoDow > 5) return null;
  const atStation = access.arrive_seconds;
  if (atStation == null || atStation < 7 * 3600 || atStation >= 11 * 3600) return null;
  return "This lot is often full by 8 AM on weekdays; some riders park on a nearby grass lot. Or try Honouliuli, the next stop toward town.";
}

/**
 * A short reminder, not an estimate: Nalu doesn't guess how long parking or a
 * pickup takes, so it tells the rider to allow for it.
 */
export function allowTimeNote(option: Option | null): string | null {
  const car = option?.legs.find((leg) => leg.mode === "drive");
  if (!option || !car) return null;
  if (option.legs.at(-1) === car) return "Allow time for the pickup.";
  const lot = Boolean(car.to_stop_id && PARK_AND_RIDE_NAMES[car.to_stop_id]);
  return lot ? "Allow time to park and get to the platform." : "Allow time to get to the platform.";
}

/**
 * What the Skyline row says when it has no trip. Outside Skyline's hours it
 * says so plainly (from the station's own timetable) instead of implying the
 * trip doesn't make sense.
 */
export function skylineEmptyText(input: {
  failed: boolean;
  closedForEvening: boolean;
  notRunningYet: boolean;
  lastTrain: string | null;
  firstTrain: string | null;
}): string {
  if (input.closedForEvening)
    return input.lastTrain
      ? `Skyline has stopped for the night (last train ${input.lastTrain})`
      : "Skyline has stopped for the night";
  if (input.notRunningYet)
    return input.firstTrain
      ? `Skyline isn’t running yet (first train ${input.firstTrain})`
      : "Skyline isn’t running yet";
  // The Skyline search failed or ran out of time: say so, never "no trip".
  if (input.failed) return "Can’t check Skyline right now";
  return "No Skyline trip that makes sense right now";
}

/** What the Bus row says when it has no trip. */
export function busEmptyText(input: { failed: boolean }): string {
  return input.failed ? "Can’t check TheBus right now" : "No bus trip right now";
}
