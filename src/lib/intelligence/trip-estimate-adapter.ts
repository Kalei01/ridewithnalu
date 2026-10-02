import type { TripEstimate } from "../decision/trip-estimate";
import {
  createCanonicalTrip,
  type CanonicalTrip,
  type TripPoint,
  type TripRoute,
  type TripSegment,
  type TripTimeConstraint,
} from "./trip-model";

export type CanonicalRouteInput = {
  estimate: TripEstimate;
  origin: TripPoint;
  destination: TripPoint;
  routeGeometry?: TripPoint[];
  source?: string;
  segmentId?: string;
};

/**
 * Adapts the existing commute estimate contract into the canonical trip model.
 * Existing planners keep their current API while the Intelligence Core gains
 * a stable route representation.
 */
export function canonicalRouteFromEstimate(input: CanonicalRouteInput): TripRoute {
  const { estimate, origin, destination } = input;
  const segment: TripSegment = {
    id: input.segmentId ?? `${estimate.mode}-route`,
    mode: estimate.mode,
    origin,
    destination,
    departureTime: estimate.leaveTime,
    arrivalTime: estimate.arrivalTime,
    durationMinutes: estimate.expectedDurationMinutes,
    distanceMeters: null,
    routeGeometry: input.routeGeometry ?? [],
    source: input.source ?? estimate.source.name,
    observedAt: estimate.source.fetchedAt,
    quality: estimate.source.quality === "good" ? "current" : estimate.source.quality,
    notes: [
      ...(estimate.majorIncident ? ["major-incident"] : []),
      ...(estimate.availability !== "available" ? [`availability:${estimate.availability}`] : []),
    ],
  };

  return {
    id: `${estimate.mode}-route`,
    mode: estimate.mode,
    segments: [segment],
    departureTime: estimate.leaveTime,
    arrivalTime: estimate.arrivalTime,
    durationMinutes: estimate.expectedDurationMinutes,
    transferCount: estimate.transferMinutes > 0 ? 1 : 0,
    walkingMinutes: estimate.walkingMinutes,
    source: input.source ?? estimate.source.name,
  };
}

export function canonicalTripFromEstimates(input: {
  origin: TripPoint;
  destination: TripPoint;
  constraint: TripTimeConstraint;
  requestedAt: number;
  estimates: CanonicalRouteInput[];
  selectedMode?: TripEstimate["mode"] | null;
}): CanonicalTrip {
  const routes = input.estimates.map(canonicalRouteFromEstimate);
  const selectedRoute =
    input.selectedMode == null
      ? null
      : routes.find((route) => route.mode === input.selectedMode)?.id ?? null;

  return createCanonicalTrip({
    origin: input.origin,
    destination: input.destination,
    constraint: input.constraint,
    requestedAt: input.requestedAt,
    routes,
    selectedRouteId: selectedRoute,
  });
}