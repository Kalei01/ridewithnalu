export type TripMode = "drive" | "rail" | "bus" | "walk";

export type TripPoint = {
  latitude: number;
  longitude: number;
  label?: string;
};

export type TripTimeConstraint =
  | { type: "depart-at"; timestamp: number }
  | { type: "arrive-by"; timestamp: number }
  | { type: "now" };

export type TripSegment = {
  id: string;
  mode: TripMode;
  origin: TripPoint;
  destination: TripPoint;
  departureTime: number | null;
  arrivalTime: number | null;
  durationMinutes: number | null;
  distanceMeters: number | null;
  routeGeometry: TripPoint[];
  source: string;
  observedAt: number | null;
  quality: "current" | "limited" | "stale" | "unavailable";
  notes: string[];
};

export type TripRoute = {
  id: string;
  mode: TripMode;
  segments: TripSegment[];
  departureTime: number | null;
  arrivalTime: number | null;
  durationMinutes: number | null;
  transferCount: number;
  walkingMinutes: number;
  source: string;
};

export type CanonicalTrip = {
  id: string;
  origin: TripPoint;
  destination: TripPoint;
  constraint: TripTimeConstraint;
  requestedAt: number;
  routes: TripRoute[];
  selectedRouteId: string | null;
};

/**
 * Canonical trip model shared by Nalu surfaces.
 *
 * A route is a sequence of real segments. Consumers must not reconstruct
 * geometry or timing independently when this model already contains it.
 */
export function createCanonicalTrip(input: Omit<CanonicalTrip, "id"> & { id?: string }): CanonicalTrip {
  return {
    ...input,
    id: input.id ?? createTripId(input.requestedAt),
  };
}

export function summarizeRoute(route: TripRoute): {
  arrivalTime: number | null;
  durationMinutes: number | null;
  transferCount: number;
  walkingMinutes: number;
} {
  return {
    arrivalTime: route.arrivalTime,
    durationMinutes: route.durationMinutes,
    transferCount: route.transferCount,
    walkingMinutes: route.walkingMinutes,
  };
}

function createTripId(requestedAt: number): string {
  return `trip-${requestedAt}-${Math.random().toString(36).slice(2, 8)}`;
}
