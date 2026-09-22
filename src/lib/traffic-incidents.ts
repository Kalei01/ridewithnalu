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
  [/^(?:Interstate\s+)?H-?1$/i, "H-1"],
  [/^(?:Interstate\s+)?H-?2$/i, "H-2"],
  [/^(?:Interstate\s+)?H-?3$/i, "H-3"],
];

/** Translate TomTom route codes into the names Oahu drivers commonly use. */
export function localRoadName(road: string | null): string | null {
  if (!road) return null;
  const formatted = road.trim();
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