import type { DriveIncident } from "./drive.functions";

const LOCAL_ROAD_NAMES: Array<[RegExp, string]> = [
  [/^(?:HI-|Route |Hwy )92$/i, "Nimitz Hwy"],
  [/^(?:HI-|Route )78$/i, "Moanalua Fwy"],
  [/^H-201$/i, "Moanalua Fwy"],
  [/^(?:HI-|Route )61$/i, "Pali Hwy"],
  [/^(?:HI-|Route )63$/i, "Likelike Hwy"],
  [/^(?:HI-|Route )72$/i, "Kalanianaʻole Hwy"],
  [/^(?:HI-|Route )(?:83|99)$/i, "Kamehameha Hwy"],
  [/^(?:HI-|Route )750$/i, "Kunia Rd"],
  [/^(?:HI-|Route )76$/i, "Fort Weaver Rd"],
  [/^(?:HI-|Route )93$/i, "Farrington Hwy"],
  [/^(?:(?:Interstate(?:\s+Highway)?)\s+)?H-?1(?:\s+(?:E|East|Eastbound))?$/i, "H-1 East"],
  [/^(?:(?:Interstate(?:\s+Highway)?)\s+)?H-?1(?:\s+(?:W|West|Westbound))$/i, "H-1 West"],
  [/^(?:(?:Interstate(?:\s+Highway)?)\s+)?H-?2(?:\s+(?:N|North|Northbound))?$/i, "H-2 North"],
  [/^(?:(?:Interstate(?:\s+Highway)?)\s+)?H-?2(?:\s+(?:S|South|Southbound))$/i, "H-2 South"],
  [/^(?:(?:Interstate(?:\s+Highway)?)\s+)?H-?3(?:\s+(?:E|East|Eastbound))?$/i, "H-3 East"],
  [/^(?:(?:Interstate(?:\s+Highway)?)\s+)?H-?3(?:\s+(?:W|West|Westbound))$/i, "H-3 West"],
];

/** Translate TomTom route codes into the names Oahu drivers commonly use. */
export function localRoadName(road: string | null): string | null {
  if (!road) return null;
  const formatted = road
    .trim()
    .replace(/^(?:North|South|East|West|N|S|E|W)\s+(?=Nimitz\b)/i, "")
    .replace(/\bHighway\b/gi, "Hwy")
    .replace(/\s+/g, " ");
  if (!formatted) return null;
  return LOCAL_ROAD_NAMES.find(([pattern]) => pattern.test(formatted))?.[1] ?? formatted;
}

/** Add useful context to TomTom's terse incident descriptions. */
export function incidentText(incident: DriveIncident): string {
  const road = localRoadName(incident.road);
  const location = road ? `on ${road}` : "on your route";
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