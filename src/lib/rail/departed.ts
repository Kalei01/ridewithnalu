/**
 * Trips whose leave-by time has already passed are not catchable. The trip
 * search may be a minute or so old (the planner minute is held between
 * re-checks), so the screen drops them against the live clock before scoring
 * or showing anything. A short grace matches the planner's own tolerance for
 * a trip that is just leaving.
 */
export const DEPARTED_GRACE_SECONDS = 60;

export function dropDeparted<T extends { leave_by_seconds: number | null }>(
  options: readonly T[],
  nowSeconds: number,
  graceSeconds = DEPARTED_GRACE_SECONDS,
): T[] {
  return options.filter(
    (option) =>
      option.leave_by_seconds === null || option.leave_by_seconds >= nowSeconds - graceSeconds,
  );
}
