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
  /^(?:(?:HI|H|I|SR|Rte|Route|Hwy)[-\s]?)?(\d{1,4})(?:[-\s]?(E|W|N|S|East|West|North|South|Eastbound|Westbound|Northbound|Southbound))?$/i;

function tidyRoadText(road: string): string {
  return road
    .trim()
    // Drop bureaucratic prefixes: "Interstate Hwy H201 E", "State Rte 92".
    .replace(/\b(?:Interstate|State|Federal)\s+(?:Highway|Hwy|Route|Rte|Rd)\b/gi, " ")
    .replace(/\bInterstate\b/gi, " ")
    .replace(/\bHighway\b/gi, "Hwy")
    .replace(/\bFreeway\b/gi, "Fwy")
    .replace(/^(?:North|South|East|West|N|S|E|W)\s+(?=Nimitz\b)/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * The local name for a route code, or null when the text is not a code we know.
 * Bare "1"/"2"/"3" are ordinary numbers, not the H-1/H-2/H-3 freeways: those are
 * only ever written H1/H-1/I-H1 in the feed, so a plain "3" must not become H-3.
 */
export function routeCodeName(road: string | null): string | null {
  if (!road) return null;
  const cleaned = tidyRoadText(road);
  const match = ROUTE_CODE.exec(cleaned);
  const entry = match?.[1] ? ROAD_BY_NUMBER[match[1]] : undefined;
  if (!match || !entry) return null;
  if (entry.freewayCode && !/^(?:H|I)[-\s]?\d/i.test(cleaned)) return null;
  const direction = match[2] ? DIRECTION_WORDS[match[2].toLowerCase()] : undefined;
  return entry.directional && direction ? `${entry.name} ${direction}` : entry.name;
}

/** Translate TomTom route codes into the names Oahu drivers commonly use. */
export function localRoadName(road: string | null): string | null {
  if (!road) return null;
  const mapped = routeCodeName(road);
  if (mapped) return mapped;
  const cleaned = tidyRoadText(road);
  return cleaned || null;
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
  // Geometry can confirm proximity to the calculated route, but without a
  // provider road name it cannot prove freeway vs ramp vs parallel frontage road.
  if (!road) return "near your calculated route";
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

export function incidentCategoryLabel(incident: DriveIncident): string | null {
  const labels: Record<string, string> = {
    "1": "Accident", "2": "Fog", "3": "Hazardous conditions", "4": "Rain", "5": "Ice",
    "6": "Traffic jam", "7": "Lane closure", "8": "Road closure", "9": "Roadwork",
    "10": "Wind", "11": "Flooding", "14": "Disabled vehicle",
    accident: "Accident", fog: "Fog", dangerousConditions: "Hazardous conditions", rain: "Rain",
    ice: "Ice", jam: "Traffic jam", laneClosed: "Lane closure", roadClosed: "Road closure",
    roadWorks: "Roadwork", wind: "Wind", flooding: "Flooding", brokenDownVehicle: "Disabled vehicle",
  };
  return incident.category ? labels[incident.category] ?? null : null;
}

/** Prefer TomTom's structured category, then fall back to its event description. */
export function incidentHeadline(incident: DriveIncident): string {
  const category = incidentCategoryLabel(incident);
  const road = localRoadName(incident.road);
  const where = road ? " on " + road : "";
  const delay = Math.max(0, Math.round(incident.delayMinutes ?? 0));
  const fallback = incidentText(incident).replace(/^Reported |^Heavy traffic /, "");
  return (category ?? fallback) + where + (delay > 0 ? " · +" + delay + " min" : "");
}

/** More detail only when TomTom actually supplies an affected stretch. */
export function incidentDetailText(incident: DriveIncident): string | null {
  const from = incident.from?.trim();
  const to = incident.to?.trim();
  if (from && to && from !== to) return "Backup reported from " + from + " to " + to + ".";
  if (from) return "Reported near " + from + ".";
  return null;
}

/** Blocking events matter on your route even before a delay is measured. */
function isBlockingDescription(description: string): boolean {
  return /\b(closed|closure|accident|crash|blocked|road closed)\b/i.test(description);
}

/**
 * True only when an alert should reach the commuter: it either adds measurable
 * time to this trip, or it blocks an identified road the route travels.
 * Anything else is noise on a corridor the drive time already accounts for.
 */
export function incidentAffectsTrip(incident: DriveIncident): boolean {
  const delay = Math.max(0, Math.round(incident.delayMinutes ?? 0));
  if (delay >= 1) return true;
  return Boolean(localRoadName(incident.road)) && isBlockingDescription(incident.description);
}

/** Plain-language trip impact shown beneath an incident, never inferred from severity alone. */
export function incidentImpactText(incident: DriveIncident): string {
  const delay = Math.max(0, Math.round(incident.delayMinutes ?? 0));
  if (delay > 0) return `Expected to add about ${delay} min to this trip.`;
  const road = localRoadName(incident.road);
  return road
    ? `Lanes are blocked on ${road}, but your drive time is not slower yet. Expect possible backups.`
    : "Your drive time is not slower right now.";
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
    : "H-1 mainline is clear; TomTom did not identify the nearby road.";
}
