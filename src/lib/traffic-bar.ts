export type TrafficBar = {
  /** Share of the bar to fill, 8 to 100. */
  fill: number;
  tone: "light" | "moderate" | "heavy";
  /** "Light traffic" or "+8 min over typical". */
  label: string;
};

/** Same cut-offs as the verdict card's traffic level (5 and 10 minutes over typical). */
export function trafficBar(delayMinutes: number | null | undefined): TrafficBar | null {
  if (delayMinutes === null || delayMinutes === undefined || !Number.isFinite(delayMinutes)) {
    return null;
  }
  const delay = Math.max(0, Math.round(delayMinutes));
  const tone = delay >= 10 ? "heavy" : delay >= 5 ? "moderate" : "light";
  return {
    fill: Math.min(100, Math.max(8, Math.round((delay / 20) * 100))),
    tone,
    label: delay === 0 ? "Light traffic" : `+${delay} min over typical`,
  };
}
