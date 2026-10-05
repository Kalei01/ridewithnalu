import { createServerFn } from "@tanstack/react-start";
import type { HdotScheduledClosure } from "./hdot-lane-closures.functions";

export type RoadworkWeek = {
  ok: boolean;
  /** When Nalu last read the state's list (ISO). */
  fetchedAt: string;
  closures: HdotScheduledClosure[];
};

const CACHE_MS = 30 * 60_000;
let cache: RoadworkWeek | null = null;

/**
 * Every planned Oʻahu lane closure on the state's HDOT weekly list, for the
 * public /roadwork page. Read at most every 30 minutes per server instance.
 */
export const getOahuRoadwork = createServerFn({ method: "GET" }).handler(async (): Promise<RoadworkWeek> => {
  if (cache && Date.now() - new Date(cache.fetchedAt).getTime() < CACHE_MS) return cache;
  const { HDOT_OAHU_ROADWORK_URL, parseHdotOahuRoadwork } = await import("./hdot-lane-closures.functions");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    const response = await fetch(HDOT_OAHU_ROADWORK_URL, { headers: { Accept: "text/html" }, signal: controller.signal });
    if (!response.ok) throw new Error(`HDOT ${response.status}`);
    const closures = parseHdotOahuRoadwork(await response.text());
    cache = { ok: true, fetchedAt: new Date().toISOString(), closures };
    return cache;
  } catch {
    // Keep showing the last good list if there is one.
    return cache ?? { ok: false, fetchedAt: new Date().toISOString(), closures: [] };
  } finally {
    clearTimeout(timer);
  }
});
