/**
 * Drive times are the live road time and nothing more. Nalu does not guess how
 * long parking or the walk in will take: that depends on the rider, the
 * building and the hour, and the rider knows it better than any estimate. The
 * screens say "(parking not included)" where it matters.
 *
 * Kept as a function so every caller (arrival windows, leave alerts, the
 * planner) shares one definition of "nothing added".
 */

export type DestinationAccess = {
  label: string;
  lowMin: number;
  typicalMin: number;
  highMin: number;
};

const NONE: DestinationAccess = {
  label: "Parking not included",
  lowMin: 0,
  typicalMin: 0,
  highMin: 0,
};

export function destinationAccess(
  _point?: { lat: number | null; lon: number | null },
  _placeKind?: string | null,
  _at?: Date,
): DestinationAccess {
  return NONE;
}

export type ArrivalRange = {
  earliestSeconds: number;
  expectedSeconds: number;
  latestSeconds: number;
  roadMinutes: number;
  accessMinutes: number;
};

/** Door-to-door arrival window from a road-time range plus the access buffer. */
export function arrivalRange(
  startSeconds: number,
  road: { low: number; expected: number; high: number },
  access: DestinationAccess,
): ArrivalRange {
  const low = Math.min(road.low, road.expected);
  const high = Math.max(road.high, road.expected);
  return {
    earliestSeconds: startSeconds + (low + access.lowMin) * 60,
    expectedSeconds: startSeconds + (road.expected + access.typicalMin) * 60,
    latestSeconds: startSeconds + (high + access.highMin) * 60,
    roadMinutes: road.expected,
    accessMinutes: access.typicalMin,
  };
}
