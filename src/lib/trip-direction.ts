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

/** Keep the chosen start and destination in travel order. `inbound` means
 * "arriving at saved Home" (or the explicit Work -> Home toggle), nothing else;
 * only a manual return to Home from a non-Home destination reverses the points. */
export function resolveTripDirection(input: {
  origin: Point;
  destination: Point;
  savedHome: Point | null;
  manualInbound: boolean | null;
}): ResolvedTripDirection {
  const { origin, destination, savedHome } = input;
  const destinationIsHome = matchesSavedHome(destination, savedHome);
  // Direction is about Home, never geography: Oʻahu riders live and work in
  // every part of the island, so "west" or "east" says nothing about it.
  const inbound = input.manualInbound ?? destinationIsHome;
  const reverseTrip = inbound && input.manualInbound === true && !destinationIsHome;
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
