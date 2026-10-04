/**
 * Shared helpers for the Problems list: group repeats of the same error into
 * one row, and name where it happened in plain words.
 */

/** Same error, different numbers or ids: one problem. */
export function problemFingerprint(source: string, area: string, message: string) {
  const normalized = message
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, "<url>")
    .replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/g, "<id>")
    .replace(/\d+(\.\d+)?/g, "#")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
  return `${source}|${area}|${normalized}`;
}

const AREA_NAMES: Record<string, string> = {
  server: "Server",
  ssr: "Loading a page",
  "leave-alerts": "Leave alerts",
  "dev-test": "Test from the Dev panel",
};

export function areaName(area: string) {
  if (AREA_NAMES[area]) return AREA_NAMES[area];
  if (area.startsWith("/")) return area === "/" ? "Home screen" : `Page ${area}`;
  return area;
}
