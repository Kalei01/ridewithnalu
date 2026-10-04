/**
 * Recent destinations (on this phone only, never sent anywhere) and a few
 * well-known Oahu places for visitors and first-timers.
 */
export type RecentPlace = { name: string; address: string; lat: number; lon: number };

const KEY = "nalu-recent-places-v1";
export const MAX_RECENTS = 5;

const keyOf = (place: { lat: number; lon: number }) => `${place.lat.toFixed(4)},${place.lon.toFixed(4)}`;

export function readRecents(): RecentPlace[] {
  try {
    const list = JSON.parse(window.localStorage.getItem(KEY) ?? "[]") as unknown;
    return Array.isArray(list)
      ? (list as RecentPlace[]).filter((p) => typeof p?.lat === "number" && typeof p?.lon === "number" && p.name)
      : [];
  } catch {
    return [];
  }
}

function write(list: RecentPlace[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX_RECENTS)));
  } catch {
    /* private mode */
  }
}

/** Newest first, no duplicates, at most five. */
export function addRecent(place: RecentPlace) {
  write([place, ...readRecents().filter((item) => keyOf(item) !== keyOf(place))]);
}

export function removeRecent(place: { lat: number; lon: number }) {
  write(readRecents().filter((item) => keyOf(item) !== keyOf(place)));
}

export function clearRecents() {
  write([]);
}

/** Common Oahu destinations; coordinates at the main entrance or center. */
export const POPULAR_PLACES: RecentPlace[] = [
  { name: "Daniel K. Inouye International Airport", address: "300 Rodgers Blvd, Honolulu", lat: 21.3317, lon: -157.9214 },
  { name: "Ala Moana Center", address: "1450 Ala Moana Blvd, Honolulu", lat: 21.2911, lon: -157.8435 },
  { name: "Waikīkī Beach", address: "Kalākaua Ave, Honolulu", lat: 21.2766, lon: -157.827 },
  { name: "UH Mānoa", address: "2500 Campus Rd, Honolulu", lat: 21.2969, lon: -157.8171 },
  { name: "Downtown Honolulu", address: "Bishop St, Honolulu", lat: 21.3099, lon: -157.8628 },
  { name: "Pearl Harbor National Memorial", address: "1 Arizona Memorial Pl, Honolulu", lat: 21.3672, lon: -157.9389 },
];
