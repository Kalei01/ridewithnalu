type Point = { lat: number | null; lon: number | null };

export type ResolvedTripDirection = {
  inbound: boolean;
  reverseTrip: boolean;
  departingFromSavedHome: boolean;
  arrivingAtSavedHome: boolean;
  from: Point;
  to: Point;
};

function matchesSavedHome(point: Point, home: Point | null): boolean {
  return Boolean(
    home && point.lat !== null && point.lon !== null && home.lat !== null && home.lon !== null &&
    Math.abs(point.lat - home.lat) < 0.00001 && Math.abs(point.lon - home.lon) < 0.00001,
  );
}

/** Keep the chosen start and destination in travel order; a manual return on an
 * eastbound legacy setup is the only case that reverses those two points. */
export function resolveTripDirection(input: {
  origin: Point;
  destination: Point;
  savedHome: Point | null;
  manualInbound: boolean | null;
}): ResolvedTripDirection {
  const { origin, destination, savedHome } = input;
  const destinationIsHome = matchesSavedHome(destination, savedHome);
  const destinationIsWest = origin.lon !== null && destination.lon !== null &&
    destination.lon < origin.lon;
  const inferredInbound = destinationIsHome || destinationIsWest;
  const inbound = input.manualInbound ?? inferredInbound;
  const reverseTrip = inbound && input.manualInbound === true && !inferredInbound;
  const from = reverseTrip ? destination : origin;
  const to = reverseTrip ? origin : destination;
  return {
    inbound, reverseTrip, from, to,
    departingFromSavedHome: matchesSavedHome(from, savedHome),
    arrivingAtSavedHome: matchesSavedHome(to, savedHome),
  };
}

/** The SQL uses historical names: p_dest is the trip origin, p_home the arrival door. */
export function inboundPlannerCoordinates(trip: ResolvedTripDirection) {
  if (trip.from.lat === null || trip.from.lon === null || trip.to.lat === null || trip.to.lon === null)
    throw new Error("Both ends of an inbound trip need coordinates");
  return {
    p_dest_lat: trip.from.lat,
    p_dest_lon: trip.from.lon,
    p_home_lat: trip.to.lat,
    p_home_lon: trip.to.lon,
  };
}
