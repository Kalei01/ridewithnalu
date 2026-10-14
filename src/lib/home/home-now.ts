/**
 * Pure helpers for the home page's live parts: where each Skyline train is
 * as scheduled, and the plain-English items of the "Right now on Oʻahu"
 * strip. Every item comes from a real check; with no evidence there is no item.
 */
import { clockFromSeconds } from "@/lib/commute-formatting";
import { formatDriveMinutes } from "@/lib/drive/traffic-summary";
import { skylineStationName } from "@/lib/rail/station-names";
import type { HomeLive, HomeSkyline, HomeTraffic, HomeTrain } from "./home-types";

/** What a station needs for placing trains: line order, distance along the line, scheduled times. */
export type TimedStation = {
  id: string;
  along: number;
  east: [number, number];
  west: [number, number];
};

export type TrainPosition = {
  key: string;
  direction: "eastbound" | "westbound";
  /** Distance along the drawn line (from the East Kapolei end). */
  along: number;
  /** At a station (doors open) rather than between two. */
  atStation: boolean;
};

/** Where one train is `elapsed` seconds after leaving its first station, or null when not on the line. */
export function trainAlong(
  stations: ReadonlyArray<TimedStation>,
  direction: "eastbound" | "westbound",
  elapsed: number,
  endStopId: string | null,
): { along: number; atStation: boolean } | null {
  if (elapsed < 0) return null;
  const ordered = direction === "eastbound" ? stations : [...stations].reverse();
  const times = (s: TimedStation) => (direction === "eastbound" ? s.east : s.west);
  const endIndex = endStopId ? ordered.findIndex((s) => s.id === endStopId) : -1;
  const last = endIndex > 0 ? endIndex : ordered.length - 1;
  for (let i = 0; i <= last; i += 1) {
    const station = ordered[i]!;
    const [arrive, depart] = times(station);
    if (elapsed < arrive) {
      const previous = ordered[i - 1];
      if (!previous) return null;
      const leftAt = times(previous)[1];
      const fraction = (elapsed - leftAt) / Math.max(1, arrive - leftAt);
      return {
        along:
          previous.along + (station.along - previous.along) * Math.min(1, Math.max(0, fraction)),
        atStation: false,
      };
    }
    // Doors open at this station; trains wait at the end of their run for a moment only.
    if (elapsed <= depart || (i === last && elapsed <= arrive + 30))
      return { along: station.along, atStation: true };
  }
  return null;
}

/** Every Skyline train on the line at `nowSeconds`, as scheduled. */
export function trainPositions(
  skyline: HomeSkyline,
  stations: ReadonlyArray<TimedStation>,
  nowSeconds: number,
): TrainPosition[] {
  const out: TrainPosition[] = [];
  const add = (direction: "eastbound" | "westbound", trains: HomeTrain[]) => {
    for (const train of trains) {
      const at = trainAlong(stations, direction, nowSeconds - train.departSeconds, train.endStopId);
      if (at) out.push({ key: `${direction}:${train.departSeconds}`, direction, ...at });
    }
  };
  add("eastbound", skyline.eastbound);
  add("westbound", skyline.westbound);
  return out;
}

/** Morning rush (town-bound) or the afternoon drive home, by Honolulu time. */
export function commutePeriod(nowSeconds: number): "morning" | "evening" | "other" {
  const hour = nowSeconds / 3600;
  if (hour >= 5 && hour < 10) return "morning";
  if (hour >= 14.5 && hour < 19) return "evening";
  return "other";
}

/** The drive worth talking about now: town-bound in the morning, home-bound in the afternoon, else the slower one. */
export function featuredTraffic(live: HomeLive, nowSeconds: number): HomeTraffic | null {
  const { eastbound, westbound } = live.traffic;
  const period = commutePeriod(nowSeconds);
  if (period === "morning") return eastbound ?? westbound;
  if (period === "evening") return westbound ?? eastbound;
  if (eastbound && westbound)
    return westbound.delayMinutes > eastbound.delayMinutes ? westbound : eastbound;
  return eastbound ?? westbound;
}

/** "9 min slower than usual", "about usual", "3 min faster than usual". */
export function delayPhrase(delayMinutes: number): string {
  const delay = Math.round(delayMinutes);
  if (Math.abs(delay) <= 1) return "about usual";
  return delay > 0
    ? `${formatDriveMinutes(delay)} slower than usual`
    : `${formatDriveMinutes(-delay)} faster than usual`;
}

/** The next scheduled departure from the end of the line people are heading out from now. */
export function nextSkyline(
  skyline: HomeSkyline,
  nowSeconds: number,
): { from: string; toward: string; departSeconds: number; shortTrip: boolean } | null {
  const westward = commutePeriod(nowSeconds) === "evening" || nowSeconds >= 12 * 3600;
  const trains = westward ? skyline.westbound : skyline.eastbound;
  const next = trains.find((train) => train.departSeconds >= nowSeconds);
  if (!next) return null;
  const [from, farEnd] = westward ? ["10030", "10047"] : ["10047", "10030"];
  const toward = next.endStopId ?? farEnd;
  const fromName = skylineStationName(from);
  const towardName = skylineStationName(toward);
  if (!fromName || !towardName) return null;
  return {
    from: fromName,
    toward: towardName,
    departSeconds: next.departSeconds,
    shortTrip: toward !== farEnd,
  };
}

/** Minutes between scheduled trains around now (from one end), when the timetable shows a steady gap. */
export function skylineEveryMinutes(trains: HomeTrain[], nowSeconds: number): number | null {
  const upcoming = trains.filter((t) => t.departSeconds >= nowSeconds - 1800).slice(0, 4);
  if (upcoming.length < 3) return null;
  const gaps = upcoming.slice(1).map((t, i) => t.departSeconds - upcoming[i]!.departSeconds);
  const shortest = Math.min(...gaps);
  const longest = Math.max(...gaps);
  // Only a steady service reads as "every N min".
  if (longest - shortest > 120) return null;
  return Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length / 60);
}

export type StripItem = { id: "traffic" | "skyline" | "showers"; label: string; text: string };

/** The "Right now on Oʻahu" items, real data only: an item without evidence is left out. */
export function stripItems(live: HomeLive, nowSeconds: number): StripItem[] {
  const items: StripItem[] = [];
  const traffic = featuredTraffic(live, nowSeconds);
  if (traffic) {
    const trip = traffic.direction === "eastbound" ? "Kapolei → town" : "Town → Kapolei";
    const onH1 = traffic.corridor ? /\bH-1\b/.test(traffic.corridor) : false;
    items.push({
      id: "traffic",
      label: onH1 ? "H-1" : "Drive",
      text: `${trip} ${formatDriveMinutes(traffic.minutes)}, ${delayPhrase(traffic.delayMinutes)}`,
    });
  }
  if (live.skyline) {
    const next = nextSkyline(live.skyline, nowSeconds);
    if (next)
      items.push({
        id: "skyline",
        label: "Skyline",
        // From an end of the line every train runs the same way; only a short trip names where it ends.
        text: `Next train from ${next.from}: ${clockFromSeconds(next.departSeconds)}${next.shortTrip ? `, to ${next.toward}` : ""}`,
      });
  }
  if (live.showers) {
    const chance =
      live.showers.percent !== null ? `, ${live.showers.percent}% chance this hour` : "";
    items.push({ id: "showers", label: "Showers", text: `Near ${live.showers.area}${chance}` });
  }
  return items;
}
