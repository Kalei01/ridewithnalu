export type PlaceKind = "home" | "work" | "school" | "gym" | "custom";

export type SavedPlace = {
  id: string;
  kind: PlaceKind;
  label: string;
  name: string;
  address: string;
  lat: number;
  lon: number;
  typicalArrivalSeconds: number | null;
  createdAt: string;
  updatedAt: string;
};

export type LegacySetup = {
  homeLat?: unknown;
  homeLon?: unknown;
  destinationName?: unknown;
  destinationAddress?: unknown;
  destLat?: unknown;
  destLon?: unknown;
};

export const SAVED_PLACES_KEY = "nalu-places-v2";
export const LEGACY_SAVED_PLACES_KEY = "nalu-places-v1";
export const PLACE_KINDS: PlaceKind[] = ["home", "work", "school", "gym", "custom"];

export function kindLabel(kind: PlaceKind): string {
  if (kind === "home") return "Home";
  if (kind === "work") return "Work";
  if (kind === "school") return "School";
  if (kind === "gym") return "Gym";
  return "Saved place";
}

export function hasValidCoordinates<T extends { lat?: unknown; lon?: unknown }>(point: T): point is T & { lat: number; lon: number } {
  return typeof point.lat === "number" && Number.isFinite(point.lat)
    && typeof point.lon === "number" && Number.isFinite(point.lon);
}

function normalizePlace(value: unknown, index: number, now: string): SavedPlace | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (!hasValidCoordinates(row)) return null;
  if (typeof row.name !== "string" || !row.name.trim()) return null;
  const kind = PLACE_KINDS.includes(row.kind as PlaceKind) ? row.kind as PlaceKind : "custom";
  const legacyArrival = row.arriveBySeconds;
  const arrival = typeof row.typicalArrivalSeconds === "number"
    ? row.typicalArrivalSeconds
    : typeof legacyArrival === "number" ? legacyArrival : null;
  return {
    id: typeof row.id === "string" && row.id ? row.id : `${kind}-${index}-${row.lat},${row.lon}`,
    kind,
    label: typeof row.label === "string" && row.label.trim() ? row.label : kindLabel(kind),
    name: row.name,
    address: typeof row.address === "string" && row.address.trim() ? row.address : row.name,
    lat: row.lat,
    lon: row.lon,
    typicalArrivalSeconds: arrival !== null && Number.isFinite(arrival) ? arrival : null,
    createdAt: typeof row.createdAt === "string" ? row.createdAt : now,
    updatedAt: typeof row.updatedAt === "string" ? row.updatedAt : now,
  };
}

export function parseSavedPlaces(raw: string | null, now = new Date().toISOString()): SavedPlace[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((value, index) => {
      const place = normalizePlace(value, index, now);
      return place ? [place] : [];
    });
  } catch {
    return [];
  }
}

export function migrateSavedPlaces(currentRaw: string | null, legacyRaw: string | null, legacySetupRaw: string | null, now = new Date().toISOString()): SavedPlace[] {
  const current = parseSavedPlaces(currentRaw, now);
  if (current.length) return current;
  let migrated = parseSavedPlaces(legacyRaw, now);
  if (legacySetupRaw) {
    try {
      const setup = JSON.parse(legacySetupRaw) as LegacySetup;
      if (hasValidCoordinates({ lat: setup.homeLat, lon: setup.homeLon }) && !findByKind(migrated, "home")) {
        migrated = upsertPlace(migrated, makeSavedPlace({ kind: "home", name: "Home", address: "Home", lat: setup.homeLat, lon: setup.homeLon }, now));
      }
      if (hasValidCoordinates({ lat: setup.destLat, lon: setup.destLon }) && !findByKind(migrated, "work")) {
        const name = typeof setup.destinationName === "string" && setup.destinationName.trim()
          ? setup.destinationName : "Work";
        const address = typeof setup.destinationAddress === "string" && setup.destinationAddress.trim()
          ? setup.destinationAddress : name;
        migrated = upsertPlace(migrated, makeSavedPlace({ kind: "work", name, address, lat: setup.destLat, lon: setup.destLon }, now));
      }
    } catch {
      // Keep valid legacy places. Never destroy source data after a failed migration.
    }
  }
  return migrated;
}

export function makeSavedPlace(input: {
  id?: string; kind: PlaceKind; label?: string; name: string; address: string;
  lat: number; lon: number; typicalArrivalSeconds?: number | null;
}, now = new Date().toISOString()): SavedPlace {
  return {
    id: input.id ?? `${input.kind}-${Date.now()}`,
    kind: input.kind,
    label: input.label?.trim() || kindLabel(input.kind),
    name: input.name,
    address: input.address || input.name,
    lat: input.lat,
    lon: input.lon,
    typicalArrivalSeconds: input.typicalArrivalSeconds ?? null,
    createdAt: now,
    updatedAt: now,
  };
}

export function upsertPlace(list: SavedPlace[], place: SavedPlace, now = new Date().toISOString()): SavedPlace[] {
  const previous = list.find((item) => item.id === place.id);
  const next = { ...place, createdAt: previous?.createdAt ?? place.createdAt ?? now, updatedAt: now };
  const singleton = next.kind === "home" || next.kind === "work";
  return list.filter((item) => item.id !== next.id && !(singleton && item.kind === next.kind)).concat(next).sort(byKindOrder);
}

export function removePlace(list: SavedPlace[], id: string): SavedPlace[] { return list.filter((item) => item.id !== id); }
export function findByKind(list: SavedPlace[], kind: PlaceKind): SavedPlace | null { return list.find((item) => item.kind === kind) ?? null; }
function byKindOrder(a: SavedPlace, b: SavedPlace) { return PLACE_KINDS.indexOf(a.kind) - PLACE_KINDS.indexOf(b.kind); }

export function swapHomeWork(list: SavedPlace[], now = new Date().toISOString()): SavedPlace[] {
  const home = findByKind(list, "home");
  const work = findByKind(list, "work");
  if (!home || !work) return list;
  return list.map((item) => item.id === home.id
    ? { ...item, kind: "work" as const, label: "Work", updatedAt: now }
    : item.id === work.id
      ? { ...item, kind: "home" as const, label: "Home", updatedAt: now }
      : item).sort(byKindOrder);
}

export type CommutePreset = { id: string; label: string; from: SavedPlace; to: SavedPlace };
export function commutePresets(list: SavedPlace[]): CommutePreset[] {
  const home = findByKind(list, "home");
  if (!home) return [];
  return list.filter((place) => place.id !== home.id).flatMap((place) => [
    { id: `${home.id}->${place.id}`, label: `${home.label} → ${place.label}`, from: home, to: place },
    { id: `${place.id}->${home.id}`, label: `${place.label} → ${home.label}`, from: place, to: home },
  ]);
}

export function parseClockInput(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours <= 23 && minutes <= 59 ? hours * 3600 + minutes * 60 : null;
}
export function clockInputValue(seconds: number | null | undefined): string {
  if (typeof seconds !== "number" || !Number.isFinite(seconds)) return "";
  const total = ((Math.round(seconds / 60) % 1440) + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}
