/**
 * Calm wording for answers that are still on their way. Nalu says "checking"
 * until a request has actually failed; only then "unavailable".
 */

export type CheckingStep = {
  key: "traffic" | "skyline" | "bus";
  label: string;
  /** checking: still waiting; done: answered; unavailable: the request failed. */
  state: "checking" | "done" | "unavailable";
  /** Real result we already know, e.g. the live drive time. Never a guess. */
  detail?: string;
};

/**
 * The steps shown under "Comparing your options" while a trip loads: traffic,
 * Skyline and TheBus, each ticking over when its own real answer arrives. Drive
 * usually answers in about a second; the timetable search (Skyline and TheBus
 * come from one search) takes longer. Null once nothing is left to wait on.
 */
export function tripCheckingSteps(input: {
  /** The rider has a car for this trip, so there is a Drive row. */
  driveRow: boolean;
  driveLoading: boolean;
  /** The Drive row's minutes once live traffic answered; null when it couldn't. */
  driveMinutes: number | null;
  /** This region has TheBus and Skyline. */
  hasTransit: boolean;
  transitLoading: boolean;
  formatMinutes: (minutes: number) => string;
}): CheckingStep[] | null {
  const checkDrive = input.driveRow && input.driveLoading;
  const checkTransit = input.hasTransit && input.transitLoading;
  if (!checkDrive && !checkTransit) return null;
  const steps: CheckingStep[] = [];
  if (input.driveRow) {
    steps.push(
      input.driveLoading
        ? { key: "traffic", label: "Traffic", state: "checking" }
        : input.driveMinutes !== null
          ? {
              key: "traffic",
              label: "Traffic",
              state: "done",
              detail: input.formatMinutes(input.driveMinutes),
            }
          : { key: "traffic", label: "Traffic", state: "unavailable" },
    );
  }
  if (input.hasTransit) {
    const state = input.transitLoading ? "checking" : "done";
    steps.push({ key: "skyline", label: "Skyline", state }, { key: "bus", label: "TheBus", state });
  }
  return steps;
}

/** Plain text for screen readers: "Traffic 35 min. Checking Skyline and TheBus." */
export function checkingStepsSummary(steps: CheckingStep[]): string {
  const done = steps
    .filter((s) => s.state === "done")
    .map((s) => (s.detail ? `${s.label} ${s.detail}` : s.label));
  const waiting = steps.filter((s) => s.state === "checking").map((s) => s.label);
  return [
    done.length ? `${done.join(", ")} in.` : "",
    waiting.length ? `Checking ${waiting.join(" and ")}…` : "",
  ]
    .filter(Boolean)
    .join(" ");
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
