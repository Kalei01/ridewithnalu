import type { DriveIncident } from "./drive.functions";

/**
 * Route number → the name Oahu drivers use. `directional` roads keep the
 * heading the feed states ("Moanalua Fwy West"); the rest read better without
 * one, because nobody says "Pali Hwy North".
 */
const ROAD_BY_NUMBER: Record<
  string,
  { name: string; directional: boolean; /** Only an H/I-prefixed code means this freeway. */ freewayCode?: boolean }
> = {
  "1": { name: "H-1", directional: true, freewayCode: true },
  "2": { name: "H-2", directional: true, freewayCode: true },
  "3": { name: "H-3", directional: true, freewayCode: true },
  "78": { name: "Moanalua Fwy", directional: true },
  "201": { name: "Moanalua Fwy", directional: true },
  "92": { name: "Nimitz Hwy", directional: true },
  "61": { name: "Pali Hwy", directional: false },
  "63": { name: "Likelike Hwy", directional: false },
  "72": { name: "Kalanianaʻole Hwy", directional: false },
  "83": { name: "Kamehameha Hwy", directional: false },
  "99": { name: "Kamehameha Hwy", directional: false },
  "93": { name: "Farrington Hwy", directional: false },
  "80": { name: "Kamehameha Hwy", directional: false },
  "76": { name: "Fort Weaver Rd", directional: false },
  "750": { name: "Kunia Rd", directional: false },
  "95": { name: "Kualakaʻi Pkwy", directional: false },
  "8930": { name: "Farrington Hwy", directional: false },
};

const DIRECTION_WORDS: Record<string, string> = {
  e: "East",
  w: "West",
  n: "North",
  s: "South",
  east: "East",
  west: "West",
  north: "North",
  south: "South",
  eastbound: "East",
  westbound: "West",
  northbound: "North",
  southbound: "South",
};

/** Matches a bare route code with an optional stated heading, in any feed format. */
const ROUTE_CODE =
  /^(?:(?:HI|H|I|SR|Rte|Route|Hwy)[-\s]?)?(\d{1,3})(?:[-\s]?(E|W|N|S|East|West|North|South|Eastbound|Westbound|Northbound|Southbound))?$/i;

/** Translate TomTom route codes into the names Oahu drivers commonly use. */
export function localRoadName(road: string | null): string | null {
  if (!road) return null;
  const cleaned = road
    .trim()
    // Drop bureaucratic prefixes: "Interstate Hwy H201 E", "State Rte 92".
    .replace(/\b(?:Interstate|State|Federal)\s+(?:Highway|Hwy|Route|Rte|Rd)\b/gi, " ")
    .replace(/\bInterstate\b/gi, " ")
    .replace(/\bHighway\b/gi, "Hwy")
    .replace(/\bFreeway\b/gi, "Fwy")
    .replace(/^(?:North|South|East|West|N|S|E|W)\s+(?=Nimitz\b)/i, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return null;

  const match = ROUTE_CODE.exec(cleaned);
  const entry = match?.[1] ? ROAD_BY_NUMBER[match[1]] : undefined;
  if (match && entry) {
    const direction = match[2] ? DIRECTION_WORDS[match[2].toLowerCase()] : undefined;
    return entry.directional && direction ? `${entry.name} ${direction}` : entry.name;
  }
  return cleaned;
}

/** True only for the H-1/H-2/H-3 freeway mainline, not ramps or surface streets. */
export function isFreewayMainline(road: string | null): boolean {
  const name = localRoadName(road);
  if (!name) return false;
  if (/\b(?:ramp|exit|on-?ramp|off-?ramp|onramp|offramp)\b/i.test(name)) return false;
  return /^H-[123](?:\s+(?:East|West|North|South))?$/.test(name);
}

/** Describes where an incident sits relative to the freeway, for clear copy. */
export function incidentPlace(incident: DriveIncident): string {
  const road = localRoadName(incident.road);
  if (!road) return "on a connecting road on your route";
  if (/\b(?:ramp|on-?ramp|off-?ramp|onramp|offramp)\b/i.test(road)) return `on the ${road}`;
  return `on ${road}`;
}

/** Add useful context to TomTom's terse incident descriptions. */
export function incidentText(incident: DriveIncident): string {
  const location = incidentPlace(incident);
  const description = incident.description.trim();

  switch (description.toLowerCase()) {
    case "closed":
      return `Reported closure ${location}`;
    case "accident":
      return `Reported accident ${location}`;
    case "roadworks":
      return `Roadwork ${location}`;
    case "jam":
    case "slow traffic":
      return `Heavy traffic ${location}`;
    case "queuing traffic":
      return `Queuing traffic ${location}`;
    default:
      return `${description || "Reported incident"} ${location}`;
  }
}

/** One compact, readable line for congestion confirmed on the driven route. */
export function trafficDelayText(incident: DriveIncident, fallbackDelayMinutes = 0): string {
  const delay = incident.delayMinutes ?? fallbackDelayMinutes;
  return `${incidentText(incident)}${delay > 0 ? ` · +${delay} min` : ""}`;
}
/**
 * Explains a "Clear" freeway reading shown next to an on-route alert, so a
 * commuter is not left guessing which road the closure is actually on.
 */
export function mainlineClearNote(
  incident: DriveIncident | undefined,
  mainlineDelayMinutes: number | null | undefined,
): string | null {
  if (!incident) return null;
  const delay = Math.max(0, Math.round(mainlineDelayMinutes ?? 0));
  if (delay >= 10) return null;
  if (isFreewayMainline(incident.road)) return null;
  const road = localRoadName(incident.road);
  return road
    ? `H-1 mainline is clear; this alert is on ${road}, a connecting road.`
    : "H-1 mainline is clear; this alert is on a connecting road, not the freeway.";
}
