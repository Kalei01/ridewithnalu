export type GeoPoint = { lat: number; lon: number };

const EARTH_RADIUS_M = 6_371_000;

function toLocalMeters(point: GeoPoint, origin: GeoPoint) {
  const radians = Math.PI / 180;
  return {
    x: (point.lon - origin.lon) * radians * EARTH_RADIUS_M * Math.cos(origin.lat * radians),
    y: (point.lat - origin.lat) * radians * EARTH_RADIUS_M,
  };
}

function pointToSegmentMeters(point: GeoPoint, start: GeoPoint, end: GeoPoint) {
  const localPoint = toLocalMeters(point, start);
  const localEnd = toLocalMeters(end, start);
  const lengthSquared = localEnd.x * localEnd.x + localEnd.y * localEnd.y;
  if (lengthSquared === 0) return Math.hypot(localPoint.x, localPoint.y);
  const fraction = Math.max(0, Math.min(1, (localPoint.x * localEnd.x + localPoint.y * localEnd.y) / lengthSquared));
  return Math.hypot(localPoint.x - fraction * localEnd.x, localPoint.y - fraction * localEnd.y);
}

/** Keep only incidents whose reported geometry touches the road corridor TomTom routed. */
export function incidentTouchesRoute(
  incidentPoints: GeoPoint[],
  routePath: GeoPoint[],
  corridorMeters = 90,
) {
  if (!incidentPoints.length || routePath.length < 2) return false;
  for (const incidentPoint of incidentPoints) {
    for (let index = 1; index < routePath.length; index += 1) {
      const start = routePath[index - 1];
      const end = routePath[index];
      if (start && end && pointToSegmentMeters(incidentPoint, start, end) <= corridorMeters) return true;
    }
  }
  return false;
}