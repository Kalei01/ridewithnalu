type Scheduled = {
  routeShortName: string | null;
  headsign: string | null;
  scheduledSeconds: number;
};
type LiveCandidate = {
  routeShortName: string;
  headsign: string;
  scheduledSeconds: number;
  isLive: boolean;
};

function normalize(value: string | null) {
  return (value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function sameRouteAndDirection(
  route: string | null,
  headsign: string | null,
  candidate: { routeShortName: string; headsign: string },
) {
  if (normalize(route) !== normalize(candidate.routeShortName)) return false;
  const wanted = normalize(headsign);
  const actual = normalize(candidate.headsign);
  return Boolean(wanted && actual) && (wanted.includes(actual) || actual.includes(wanted));
}

/** No provider trip ID is available in the consumed HEA fields, so require a unique nearby schedule. */
export function scheduledBusMatch<T extends Scheduled>(
  scheduled: T[],
  candidate: { routeShortName: string; headsign: string },
  predictedSeconds: number,
): T | null {
  const matches = scheduled
    .filter((item) => sameRouteAndDirection(item.routeShortName, item.headsign, candidate))
    .map((item) => ({ item, distance: Math.abs(item.scheduledSeconds - predictedSeconds) }))
    .filter(({ distance }) => distance <= 10 * 60)
    .sort((a, b) => a.distance - b.distance);
  if (!matches[0] || (matches[1] && matches[1].distance - matches[0].distance < 2 * 60))
    return null;
  return matches[0].item;
}

export function confirmedLiveBus<T extends LiveCandidate>(
  arrivals: T[],
  route: string | null,
  headsign: string | null,
  scheduledSeconds: number | null,
): T | null {
  if (scheduledSeconds === null) return null;
  const matches = arrivals.filter(
    (arrival) =>
      arrival.isLive &&
      sameRouteAndDirection(route, headsign, arrival) &&
      Math.abs(arrival.scheduledSeconds - scheduledSeconds) <= 2 * 60,
  );
  return matches.length === 1 ? (matches[0] ?? null) : null;
}
