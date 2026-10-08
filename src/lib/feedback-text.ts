/** Rules for rider feedback text, shared by the form and the server. */
export const FEEDBACK_CATEGORIES = ["wrong_answer", "idea", "other"] as const;
export type FeedbackCategory = (typeof FEEDBACK_CATEGORIES)[number];
export const FEEDBACK_MAX = 500;
export const FEEDBACK_TRIP_MAX = 200;

/** Plain text only: control characters removed, spaces tidied, length capped. */
export function cleanFeedbackText(text: string, max: number): string {
  return Array.from(text)
    .filter((ch) => {
      const code = ch.charCodeAt(0);
      return ch === "\n" || ch === "\t" || (code >= 32 && code !== 127);
    })
    .join("")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, max);
}

/** Notes that carry more than one link are almost always spam. */
export function looksLikeSpam(text: string): boolean {
  const links = text.match(/https?:\/\/|www\./gi) ?? [];
  return links.length > 1;
}
