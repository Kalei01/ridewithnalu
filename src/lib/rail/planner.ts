export type TimedItinerary = { leave_by_seconds: number; arrive_seconds: number };
export type RailPick<T> = { option: T | null; earliestArriveSeconds: number | null; feasible: boolean };
export function latestRailArrival<T extends TimedItinerary>(options: T[], arriveBySeconds: number): RailPick<T> {
  if (!options.length) return { option: null, earliestArriveSeconds: null, feasible: false };
  let earliest = options[0]?.arrive_seconds ?? null;
  let best: T | null = null;
  for (const option of options) {
    if (earliest === null || option.arrive_seconds < earliest) earliest = option.arrive_seconds;
    if (option.arrive_seconds <= arriveBySeconds && (!best || option.leave_by_seconds > best.leave_by_seconds)) best = option;
  }
  return { option: best, earliestArriveSeconds: earliest, feasible: Boolean(best) };
}
