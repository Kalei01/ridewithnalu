/**
 * Saved locations (Home, Work, School, Gym, custom) kept on the device.
 * Pure helpers so the commute screen stays thin and the rules stay testable.
 */

export type PlaceKind = "home" | "work" | "school" | "gym" | "custom";

export type SavedPlace = {
  id: string;
  kind: PlaceKind;
  /** Display label; defaults to the kind's name but the rider can rename it. */
  label: string;
  name: string;
  address: string;
  lat: number;
  lon: number;
  /** Typical arrival time in Honolulu seconds-since-midnight, when set. */
  arriveBySeconds: number | null;
};

export const SAVED_PLACES_KEY = "nalu-places-v1";

export const PLACE_KINDS: PlaceKind[] = ["home", "work", "school", "gym", "custom"];

export function kindLabel(kind: PlaceKind): string {
  switch (kind) {
    case "home":
      return "Home";
    case "work":
      return "Work";
    case "school":
      return "School";
    case "gym":
      return "Gym";
    default:
      return "Saved place";
  }
}

function isFinitePoint(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/** Tolerant parse: anything malformed is dropped rather than breaking the app. */
export function parseSavedPlaces(raw: string | null): SavedPlace[] {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const out: SavedPlace[] = [];
  for (const entry of parsed) {
    if (!entry || typeof entry !== "object") continue;
    const row = entry as Partial<SavedPlace>;
    if (!isFinitePoint(row.lat) || !isFinitePoint(row.lon)) continue;
    if (typeof row.name !== "string" || !row.name) continue;
    const kind: PlaceKind = PLACE_KINDS.includes(row.kind as PlaceKind) ? (row.kind as PlaceKind) : "custom";
    out.push({
      id: typeof row.id === "string" && row.id ? row.id : `${kind}-${row.lat},${row.lon}`,
      kind,
      label: typeof row.label === "string" && row.label ? row.label : kindLabel(kind),
      name: row.name,
      address: typeof row.address === "string" ? row.address : row.name,
      lat: row.lat,
      lon: row.lon,
      arriveBySeconds:
        typeof row.arriveBySeconds === "number" && Number.isFinite(row.arriveBySeconds)
          ? row.arriveBySeconds
          : null,
    });
  }
  return out;
}

/**
 * Add or replace a place. Home and Work are singletons — saving a new one
 * replaces the old, which is what "swap" and "update" both rely on.
 */
export function upsertPlace(list: SavedPlace[], place: SavedPlace): SavedPlace[] {
  const singleton = place.kind === "home" || place.kind === "work";
  const kept = list.filter((item) =>
    item.id !== place.id && !(singleton && item.kind === place.kind),
  );
  return [...kept, place].sort(byKindOrder);
}

export function removePlace(list: SavedPlace[], id: string): SavedPlace[] {
  return list.filter((item) => item.id !== id);
}

export function findByKind(list: SavedPlace[], kind: PlaceKind): SavedPlace | null {
  return list.find((item) => item.kind === kind) ?? null;
}

function byKindOrder(a: SavedPlace, b: SavedPlace) {
  return PLACE_KINDS.indexOf(a.kind) - PLACE_KINDS.indexOf(b.kind);
}

/** Swap which saved place is Home and which is Work, keeping everything else. */
export function swapHomeWork(list: SavedPlace[]): SavedPlace[] {
  const home = findByKind(list, "home");
  const work = findByKind(list, "work");
  if (!home || !work) return list;
  const swapped = list.map((item) => {
    if (item.id === home.id) return { ...item, kind: "work" as PlaceKind, label: work.label };
    if (item.id === work.id) return { ...item, kind: "home" as PlaceKind, label: home.label };
    return item;
  });
  return [...swapped].sort(byKindOrder);
}

export type CommutePreset = {
  id: string;
  label: string;
  from: SavedPlace;
  to: SavedPlace;
};

/**
 * Automatic presets: Home to every other saved place, plus the trip back.
 * Derived from the saved list, so nothing is hardcoded.
 */
export function commutePresets(list: SavedPlace[]): CommutePreset[] {
  const home = findByKind(list, "home");
  if (!home) return [];
  const presets: CommutePreset[] = [];
  for (const place of list) {
    if (place.id === home.id) continue;
    presets.push({ id: `${home.id}->${place.id}`, label: `${home.label} → ${place.label}`, from: home, to: place });
    presets.push({ id: `${place.id}->${home.id}`, label: `${place.label} → ${home.label}`, from: place, to: home });
  }
  return presets;
}

/** "07:30" -> 27000 seconds. Returns null for anything unusable. */
export function parseClockInput(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 3600 + minutes * 60;
}

/** 27000 -> "07:30", for an <input type="time"> value. */
export function clockInputValue(seconds: number | null | undefined): string {
  if (typeof seconds !== "number" || !Number.isFinite(seconds)) return "";
  const total = ((Math.round(seconds / 60) % 1440) + 1440) % 1440;
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}
