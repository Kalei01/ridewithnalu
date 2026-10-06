/**
 * The three kinds of trip Nalu compares side by side:
 *
 * - Drive: door to door (the drive estimate, not a transit option). When
 *   someone else is driving, the same car trip as a passenger.
 * - Skyline: any trip that uses a car for part of the way to Skyline: driving
 *   and parking at a station lot, being dropped off at a station, or riding
 *   back to the car.
 * - Bus: walk, bus and Skyline only, no car.
 *
 * Which of these exist for a rider depends on their trip access (see
 * trip-access.ts); this module only groups what the planner returned.
 *
 * Both transit choices come from the one planner result list, which is already
 * ordered by preference (simpler trips first, then trips whose extra transfers
 * save too little). This module only groups it; it never re-decides.
 */
import { latestRailArrival } from "@/lib/rail/planner";
import type { Option } from "@/lib/commute-model";
import { PARK_AND_RIDE_NAMES } from "@/lib/rail/park-and-ride";
import { stationLabel } from "@/lib/commute-formatting";

/** Uses a car for part of the trip (driven by the rider or by someone else). */
export const needsCar = (option: Option) => option.legs.some((leg) => leg.mode === "drive");

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
    skyline: pick(options.filter(needsCar), arriveByTarget),
    bus: pick(
      options.filter((option) => !needsCar(option)),
      arriveByTarget,
    ),
  };
}

/**
 * "Drive to UH West Oʻahu → Skyline → Bus 42", "Walk → Bus 91". When someone
 * else is driving the car leg reads "Dropped off at …".
 */
export function tripSteps(option: Option, access: { dropOff?: boolean } = {}): string {
  const steps: string[] = [];
  option.legs.forEach((leg, index) => {
    if (leg.mode === "drive") {
      const station = leg.to_stop_id
        ? (PARK_AND_RIDE_NAMES[leg.to_stop_id] ?? (leg.to ? stationLabel(leg.to) : undefined))
        : undefined;
      if (access.dropOff) steps.push(station ? `Dropped off at ${station}` : "Dropped off");
      else steps.push(station ? `Drive to ${station}` : "Drive");
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
