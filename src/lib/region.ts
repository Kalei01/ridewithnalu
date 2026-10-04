/**
 * Where Nalu is answering for. Oʻahu is the real product; San Francisco is a
 * developer-only test (driving, Uber/Lyft and walking; no SF transit data yet).
 * The choice lives on this phone only, and the server always assumes Oʻahu.
 */
export type RegionId = "oahu" | "sf";

export type Region = {
  id: RegionId;
  name: string;
  timeZone: string;
  center: { lat: number; lon: number };
  /** Place-search bounds as TomTom "lat,lon" corners. */
  searchBox: { topLeft: string; btmRight: string };
  /** Whether Nalu has bus and rail data here. */
  hasTransit: boolean;
};

export const REGIONS: Record<RegionId, Region> = {
  oahu: {
    id: "oahu",
    name: "Oʻahu",
    timeZone: "Pacific/Honolulu",
    center: { lat: 21.4389, lon: -157.9 },
    searchBox: { topLeft: "21.75,-158.35", btmRight: "21.20,-157.60" },
    hasTransit: true,
  },
  sf: {
    id: "sf",
    name: "San Francisco Bay Area",
    timeZone: "America/Los_Angeles",
    center: { lat: 37.7793, lon: -122.4193 },
    searchBox: { topLeft: "38.32,-122.75", btmRight: "37.20,-121.70" },
    hasTransit: false,
  },
};

const KEY = "nalu-region-v1";

function readStored(): RegionId {
  try {
    if (typeof window === "undefined") return "oahu";
    return window.localStorage.getItem(KEY) === "sf" ? "sf" : "oahu";
  } catch {
    return "oahu";
  }
}

let active: RegionId | null = null;

export function activeRegion(): Region {
  if (active === null || typeof window === "undefined") active = readStored();
  return REGIONS[active];
}

export function regionTimeZone() {
  return activeRegion().timeZone;
}

export function isTestRegion() {
  return activeRegion().id !== "oahu";
}

/** Switch region and reload, so every screen starts fresh in the new place. */
export function switchRegion(id: RegionId) {
  try {
    if (id === "oahu") window.localStorage.removeItem(KEY);
    else window.localStorage.setItem(KEY, id);
  } catch {
    /* private mode */
  }
  window.location.reload();
}

/** UTC offset like "-07:00" for a time zone at a given moment. */
export function zoneOffset(timeZone: string, at = new Date()) {
  const name =
    new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "longOffset" })
      .formatToParts(at)
      .find((part) => part.type === "timeZoneName")?.value ?? "GMT";
  const match = /GMT([+-]\d{2}):?(\d{2})?/.exec(name);
  return match ? `${match[1]}:${match[2] ?? "00"}` : "+00:00";
}

/** Whether a point falls inside a region's search area. */
export function regionContains(region: Region, lat: number, lon: number) {
  const [top, left] = region.searchBox.topLeft.split(",").map(Number) as [number, number];
  const [bottom, right] = region.searchBox.btmRight.split(",").map(Number) as [number, number];
  return lat <= top && lat >= bottom && lon >= left && lon <= right;
}

/**
 * Well-known places for the test region. They're looked up live when tapped,
 * so no coordinates are guessed here.
 */
export const TEST_REGION_POPULAR: Record<Exclude<RegionId, "oahu">, string[]> = {
  sf: [
    "San Francisco International Airport",
    "Fisherman's Wharf",
    "Golden Gate Bridge Welcome Center",
    "Union Square San Francisco",
    "Ferry Building Marketplace",
    "California Academy of Sciences",
  ],
};
