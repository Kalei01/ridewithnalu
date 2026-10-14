/**
 * How riders know each Skyline station: the English name used on the trains
 * and signs, then the Hawaiian name. Confirmed by Josh, October 11, 2026
 * (docs/product/direction.md). Keys are TheBus GTFS stop ids, west to east.
 */
const STATIONS: ReadonlyArray<{
  stopId: string;
  /** The Hawaiian name, as it starts GTFS names (no ʻokina, capitals). */
  key: string;
  /** Words that must also appear in a longer GTFS name, so a bus stop on a street with the same name never matches. */
  place: string;
  english: string;
  hawaiian: string;
}> = [
  {
    stopId: "10047",
    key: "KUALAKAI",
    place: "KAPOLEI",
    english: "East Kapolei",
    hawaiian: "Kualakaʻi",
  },
  {
    stopId: "10046",
    key: "KEONEAE",
    place: "WEST OAHU",
    english: "UH West Oʻahu",
    hawaiian: "Keoneʻae",
  },
  {
    stopId: "10045",
    key: "HONOULIULI",
    place: "HOOPILI",
    english: "Hoʻopili",
    hawaiian: "Honouliuli",
  },
  {
    stopId: "10044",
    key: "HOAEAE",
    place: "WEST LOCH",
    english: "West Loch",
    hawaiian: "Hōʻaeʻae",
  },
  {
    stopId: "10043",
    key: "POUHALA",
    place: "WAIPAHU",
    english: "Waipahu Transit Center",
    hawaiian: "Pouhala",
  },
  {
    stopId: "10056",
    key: "HALAULANI",
    place: "LEEWARD",
    english: "Leeward Community College",
    hawaiian: "Halaulani",
  },
  {
    stopId: "10053",
    key: "WAIAWA",
    place: "PEARL HIGHLANDS",
    english: "Pearl Highlands",
    hawaiian: "Waiawa",
  },
  {
    stopId: "10054",
    key: "KALAUAO",
    place: "PEARLRIDGE",
    english: "Pearlridge",
    hawaiian: "Kalauao",
  },
  {
    stopId: "10055",
    key: "HALAWA",
    place: "ALOHA STADIUM",
    english: "Aloha Stadium",
    hawaiian: "Hālawa",
  },
  {
    stopId: "10033",
    key: "MAKALAPA",
    place: "PEARL HARBOR",
    english: "Joint Base Pearl Harbor–Hickam",
    hawaiian: "Makalapa",
  },
  {
    stopId: "10032",
    key: "LELEPAUA",
    place: "AIRPORT",
    english: "Daniel K. Inouye International Airport",
    hawaiian: "Lelepaua",
  },
  { stopId: "10031", key: "AHUA", place: "LAGOON", english: "Lagoon Drive", hawaiian: "Ahua" },
  {
    stopId: "10030",
    key: "KAHAUIKI",
    place: "KALIHI",
    english: "Kalihi Transit Center",
    hawaiian: "Kahauiki",
  },
];

const riderName = (station: (typeof STATIONS)[number]) =>
  `${station.english} (${station.hawaiian})`;

/** A Skyline station's two names, for screens that show the Hawaiian name on its own line. */
export type StationParts = { english: string; hawaiian: string };

/**
 * A station label as a place to go: "Kalihi Transit Center (Kahauiki)" stays as
 * it is; any other name gets " Station" ("Lelepaua Station").
 */
export function withStation(label: string): string {
  return label.endsWith(")") ? label : `${label} Station`;
}

/** "Kalihi Transit Center (Kahauiki)" for a Skyline stop id, or undefined. */
export function skylineStationName(stopId: string | null | undefined): string | undefined {
  const station = stopId ? STATIONS.find((s) => s.stopId === stopId) : undefined;
  return station ? riderName(station) : undefined;
}

/**
 * The rider name for a Skyline station written any way GTFS or the planner has
 * it ("KAHAUIKI KALIHI TRN CTR SKYLINE STATION", "KUALAKA'I", "Hālawa"), or
 * undefined when the text isn't a Skyline station.
 */
export function skylineStationFromText(value: string | null | undefined): string | undefined {
  const station = findStation(value);
  return station ? riderName(station) : undefined;
}

/** The GTFS stop id of a Skyline station written any way GTFS has it (e.g. a trip headsign), or undefined. */
export function skylineStationIdFromText(value: string | null | undefined): string | undefined {
  return findStation(value)?.stopId;
}

/** The English and Hawaiian names apart ("Kalihi Transit Center", "Kahauiki"), or undefined. */
export function skylineStationParts(value: string | null | undefined): StationParts | undefined {
  const station = findStation(value);
  return station ? { english: station.english, hawaiian: station.hawaiian } : undefined;
}

function findStation(value: string | null | undefined) {
  if (!value) return undefined;
  const text = value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/['ʻ‘’.]/g, "")
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
  for (const station of STATIONS) {
    if (text === station.key) return station;
    if (!text.startsWith(`${station.key} `)) continue;
    const rest = text.slice(station.key.length + 1);
    // Only a station's own name: a bus stop like "KUALAKAI PKWY KAPOLEI" stays a street.
    const stationWord = /\b(STATION|STN|SKYLINE)\b/.test(rest);
    if (stationWord && (rest.includes(station.place) || /^(SKYLINE )?(STATION|STN)$/.test(rest)))
      return station;
  }
  return undefined;
}
