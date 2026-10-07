/**
 * Calm wording for answers that are still on their way. Nalu says "checking"
 * until a request has actually failed; only then "unavailable".
 */

/**
 * The short line under "Checking…" while a trip loads, naming what's in so far:
 * "Drive 35 min · checking TheBus and Skyline…". Drive usually answers in about
 * a second and the timetable search takes longer, so the rider sees progress.
 */
export function tripCheckingStatus(input: {
  /** The rider has a car for this trip, so there is a Drive row. */
  driveRow: boolean;
  driveLoading: boolean;
  /** The Drive row's minutes once live traffic answered; null when it couldn't. */
  driveMinutes: number | null;
  /** This region has TheBus and Skyline. */
  hasTransit: boolean;
  transitLoading: boolean;
  formatMinutes: (minutes: number) => string;
}): string | null {
  const checkDrive = input.driveRow && input.driveLoading;
  const checkTransit = input.hasTransit && input.transitLoading;
  if (!checkDrive && !checkTransit) return null;
  if (checkDrive && checkTransit) return "Checking traffic, TheBus and Skyline…";
  if (checkDrive) return "Checking traffic…";
  if (input.driveRow && input.driveMinutes !== null)
    return `Drive ${input.formatMinutes(input.driveMinutes)} · checking TheBus and Skyline…`;
  return "Checking TheBus and Skyline…";
}

/**
 * The Browse weather line: the reading when there is one, "Checking weather…"
 * while it loads, and "Weather unavailable" only once the request failed (or
 * answered with nothing to say, or can't run without a location).
 */
export function weatherSummaryText(
  parts: string[],
  state: { hasData: boolean; failed: boolean; canLoad: boolean },
): string {
  if (parts.length) return parts.join(" · ");
  if (state.hasData || state.failed || !state.canLoad) return "Weather unavailable";
  return "Checking weather…";
}
