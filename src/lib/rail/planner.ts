export type TimedItinerary = { leave_by_seconds: number; arrive_seconds: number };
export type RailPick<T> = {
  option: T | null;
  earliestOption: T | null;
  earliestArriveSeconds: number | null;
  feasible: boolean;
};
export function latestRailArrival<T extends TimedItinerary>(
  options: T[],
  arriveBySeconds: number,
): RailPick<T> {
  if (!options.length)
    return { option: null, earliestOption: null, earliestArriveSeconds: null, feasible: false };
  let earliestOption = options[0] ?? null;
  let best: T | null = null;
  for (const option of options) {
    if (!earliestOption || option.arrive_seconds < earliestOption.arrive_seconds)
      earliestOption = option;
    if (
      option.arrive_seconds <= arriveBySeconds &&
      (!best || option.leave_by_seconds > best.leave_by_seconds)
    )
      best = option;
  }
  return {
    option: best,
    earliestOption,
    earliestArriveSeconds: earliestOption?.arrive_seconds ?? null,
    feasible: Boolean(best),
  };
}
