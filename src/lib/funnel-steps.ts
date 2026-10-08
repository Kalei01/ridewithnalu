/** Visitor-funnel steps counted anonymously (see the privacy page and docs/product/proposals.md P-1). */
export const FUNNEL_STEPS = [
  "landed_intro",
  "landed_guide",
  "landed_app",
  "trip_tried",
  "answer_shown",
  "answer_under_5s",
  "answer_5_to_10s",
  "answer_over_10s",
  "maps_opened",
  "installed",
] as const;

export type FunnelStep = (typeof FUNNEL_STEPS)[number];

/** Which speed bucket a time-to-answer falls in. */
export function answerSpeedStep(seconds: number): FunnelStep {
  if (seconds < 5) return "answer_under_5s";
  if (seconds <= 10) return "answer_5_to_10s";
  return "answer_over_10s";
}

/** Which landing step a page counts as. */
export function landingStep(pathname: string): FunnelStep {
  if (pathname === "/welcome" || pathname === "/install") return "landed_intro";
  if (pathname.startsWith("/guides") || pathname === "/oahu-commute" || pathname === "/roadwork")
    return "landed_guide";
  return "landed_app";
}
