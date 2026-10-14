import { naluHomeLine } from "@/lib/nalu-voice";
import { commutePeriod, featuredTraffic, nextSkyline, skylineEveryMinutes } from "./home-now";
import type { HomeLive } from "./home-types";

/** Nalu's one friendly line for the home page, from the live checks only (null without evidence). */
export function homeLineFor(live: HomeLive, seconds: number): string | null {
  const traffic = featuredTraffic(live, seconds);
  const westward = seconds >= 12 * 3600;
  const trains = live.skyline ? (westward ? live.skyline.westbound : live.skyline.eastbound) : [];
  const later = live.skyline ? nextSkyline(live.skyline, seconds) : null;
  return naluHomeLine({
    period: commutePeriod(seconds),
    direction: traffic?.direction ?? (westward ? "westbound" : "eastbound"),
    delayMinutes: traffic ? traffic.delayMinutes : null,
    onH1: traffic?.corridor ? /\bH-1\b/.test(traffic.corridor) : false,
    skylineEvery: live.skyline ? skylineEveryMinutes(trains, seconds) : null,
    // Stopped only when the timetable was read and shows no later train from either end.
    skylineStopped: Boolean(
      live.skyline &&
      !later &&
      seconds >= 20 * 3600 &&
      !live.skyline.eastbound.some((t) => t.departSeconds >= seconds) &&
      !live.skyline.westbound.some((t) => t.departSeconds >= seconds),
    ),
    showersArea: live.showers?.area ?? null,
  });
}
