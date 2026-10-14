export type LeaveCountdown = {
  /** "Leave in 6 min", "Leave in under a minute", "Time to go". */
  text: string;
  /** soon: two minutes or less (amber); go: the leave-by time has arrived. */
  tone: "ahead" | "soon" | "go";
};

const DAY = 86_400;

/**
 * Counts down to a real leave-by time (seconds after midnight, Honolulu).
 * Null when it is far off (over 90 minutes) or long past (over 10 minutes), so
 * Nalu never counts toward something that isn't about to happen.
 */
export function leaveCountdown(leaveBySeconds: number, nowSeconds: number): LeaveCountdown | null {
  let diff = leaveBySeconds - nowSeconds;
  if (diff < -DAY / 2) diff += DAY; // leave time just after midnight, now just before
  if (diff > DAY / 2) diff -= DAY; // leave time just before midnight, now just after
  if (diff > 90 * 60 || diff < -10 * 60) return null;
  if (diff <= 0) return { text: "Time to go", tone: "go" };
  const minutes = Math.ceil(diff / 60);
  if (diff <= 60) return { text: "Leave in under a minute", tone: "soon" };
  return { text: `Leave in ${minutes} min`, tone: minutes <= 2 ? "soon" : "ahead" };
}
