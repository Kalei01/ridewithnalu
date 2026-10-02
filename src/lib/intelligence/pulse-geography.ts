export const PULSE_MAX_STATION_DISTANCE_MILES = 5;

export type StationProximity = {
  distanceMiles: number | null;
};

export function isRailGeographicallyRelevant(
  originStation: StationProximity | null,
  destinationStation: StationProximity | null,
): boolean {
  return Boolean(
    originStation &&
      destinationStation &&
      originStation.distanceMiles !== null &&
      destinationStation.distanceMiles !== null &&
      Number.isFinite(originStation.distanceMiles) &&
      Number.isFinite(destinationStation.distanceMiles) &&
      originStation.distanceMiles <= PULSE_MAX_STATION_DISTANCE_MILES &&
      destinationStation.distanceMiles <= PULSE_MAX_STATION_DISTANCE_MILES,
  );
}
