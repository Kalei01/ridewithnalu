export type TripMode = "drive" | "transit" | "rail" | "bus" | "walk";

export type TripPoint = { latitude: number; longitude: number; label?: string };
export type TripTimeConstraint =
  | { type: "depart-at"; timestamp: number }
  | { type: "arrive-by"; timestamp: number }
  | { type: "now" };

export type TripSegment = {
  id: string; mode: TripMode; origin: TripPoint; destination: TripPoint;
  departureTime: number | null; arrivalTime: number | null; durationMinutes: number | null;
  distanceMeters: number | null; routeGeometry: TripPoint[]; source: string;
  observedAt: number | null; quality: "current" | "limited" | "stale" | "unavailable"; notes: string[];
};

export type TripRoute = {
  id: string; mode: TripMode; segments: TripSegment[]; departureTime: number | null;
  arrivalTime: number | null; durationMinutes: number | null; transferCount: number;
  walkingMinutes: number; source: string;
};

export type CanonicalTrip = {
  id: string; origin: TripPoint; destination: TripPoint; constraint: TripTimeConstraint;
  requestedAt: number; routes: TripRoute[]; selectedRouteId: string | null;
};

/** Canonical trip shared by maps, navigation, commute details, and future consumers. */
export function createCanonicalTrip(input: Omit<CanonicalTrip, "id"> & { id?: string }): CanonicalTrip {
  return { ...input, id: input.id ?? createTripId(input) };
}

export function summarizeRoute(route: TripRoute) {
  return { arrivalTime: route.arrivalTime, durationMinutes: route.durationMinutes, transferCount: route.transferCount, walkingMinutes: route.walkingMinutes };
}

function createTripId(input: Omit<CanonicalTrip, "id">): string {
  const routeSignature = input.routes.map((route) => route.id + ":" + route.segments.map((segment) => segment.id).join(",")).join("|");
  const raw = [input.requestedAt, input.origin.latitude, input.origin.longitude, input.destination.latitude, input.destination.longitude, input.constraint.type, input.constraint.type === "now" ? "" : input.constraint.timestamp, routeSignature].join("|");
  let hash = 0;
  for (let index = 0; index < raw.length; index += 1) hash = (hash * 31 + raw.charCodeAt(index)) | 0;
  return "trip-" + input.requestedAt + "-" + Math.abs(hash).toString(36);
}