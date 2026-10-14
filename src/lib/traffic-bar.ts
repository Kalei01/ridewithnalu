export type TrafficBar = {
  /** Share of the bar to fill, 8 to 100. */
  fill: number;
  tone: "light" | "moderate" | "heavy";
  /** "+8 min over typical". */
  label: string;
};

/**
 * Same cut-offs as the verdict card's traffic level (5 and 10 minutes over typical).
 * Only a real delay of a minute or more draws a bar: a delay of 0 also happens when
 * TomTom's typical-time lookup failed (the typical time then equals the live one), so
 * it can't be told apart from "light traffic" and Nalu doesn't claim it.
 */
export function trafficBar(delayMinutes: number | null | undefined): TrafficBar | null {
  if (delayMinutes === null || delayMinutes === undefined || !Number.isFinite(delayMinutes)) {
    return null;
  }
  const delay = Math.round(delayMinutes);
  if (delay < 1) return null;
  const tone = delay >= 10 ? "heavy" : delay >= 5 ? "moderate" : "light";
  return {
    fill: Math.min(100, Math.max(8, Math.round((delay / 20) * 100))),
    tone,
    label: `+${delay} min over typical`,
  };
}
