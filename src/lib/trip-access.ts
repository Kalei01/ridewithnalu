/**
 * What transportation the rider has for THIS trip. It is an input to the
 * planner, never a verdict: it decides which kinds of itineraries Nalu may
 * build, and Nalu still compares them and picks the best.
 *
 *   tripAccess ──► resources ──► possible itineraries ──► compare ──► verdict
 *
 * The answers are deliberately not routing modes. "Include driving or
 * drop-off" only says a car may be part of the comparison; it does not mean
 * Drive or Skyline wins. "No driving — bus, rail & walking" means no car, not
 * that Bus wins. Walking is always part of an itinerary and never asked. New
 * answers can be added later by describing what they allow in `accessResources`.
 */

export type TripAccess = "vehicle" | "bus";

export const TRIP_ACCESS_OPTIONS: ReadonlyArray<{
  value: TripAccess;
  emoji: string;
  label: string;
}> = [
  { value: "vehicle", emoji: "🚗", label: "Include driving or drop-off" },
  { value: "bus", emoji: "🚌", label: "No driving — bus, rail & walking" },
];

export const tripAccessLabel = (access: TripAccess) =>
  TRIP_ACCESS_OPTIONS.find((option) => option.value === access)?.label ?? "";

/** What the rider has available. Walking is always part of an itinerary, so it isn't listed. */
export type AccessResources = {
  /**
   * A car can carry the rider for some or all of the trip: driving themselves
   * (and parking), or being dropped off. Nalu does not assume which.
   */
  vehicle: boolean;
};

export function accessResources(access: TripAccess): AccessResources {
  return { vehicle: access === "vehicle" };
}

/**
 * How a vehicle may be used to reach a Skyline station:
 * - "vehicle": drive and park at a station with a lot, or be dropped off at
 *   any station that makes progress toward the destination.
 * - "none": no vehicle leg is built.
 */
export type VehicleToStation = "vehicle" | "none";

export function vehicleToStation(resources: AccessResources): VehicleToStation {
  return resources.vehicle ? "vehicle" : "none";
}

/** Whether a door-to-door car trip (driven or as a passenger) can be compared. */
export function carTripAvailable(resources: AccessResources): boolean {
  return resources.vehicle;
}
