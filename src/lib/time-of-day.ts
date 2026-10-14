export type TimeOfDay = "sunrise" | "day" | "sunset" | "night";

const HONOLULU = "Pacific/Honolulu";

/** Minutes after midnight in Honolulu (no daylight saving there). */
export function honoluluMinutes(now: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: HONOLULU,
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return (get("hour") % 24) * 60 + get("minute");
}

/**
 * Broad look-and-feel period by Honolulu clock time (not a claim about the sun):
 * sunrise 5:30-7:30, day until 5:15 PM, sunset until 7:15 PM, otherwise night.
 */
export function timeOfDay(now: Date = new Date()): TimeOfDay {
  const m = honoluluMinutes(now);
  if (m >= 5 * 60 + 30 && m < 7 * 60 + 30) return "sunrise";
  if (m >= 7 * 60 + 30 && m < 17 * 60 + 15) return "day";
  if (m >= 17 * 60 + 15 && m < 19 * 60 + 15) return "sunset";
  return "night";
}
