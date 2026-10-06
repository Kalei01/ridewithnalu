/**
 * What transportation the rider has for THIS trip. It is an input to the
 * planner, never a verdict: it decides which kinds of itineraries Nalu may
 * build, and Nalu still compares them and picks the best.
 *
 *   tripAccess ──► resources ──► possible itineraries ──► compare ──► verdict
 *
 * The three answers are deliberately not routing modes. "I can drive" does not
 * mean Drive wins, "Getting dropped off" does not mean Park & ride, and
 * "Taking the bus" does not mean Bus wins. New answers (or combinations) can
 * be added later by describing what they allow in `accessResources`.
 */

export type TripAccess = "drive" | "dropOff" | "bus";

export const TRIP_ACCESS_OPTIONS: ReadonlyArray<{
  value: TripAccess;
  emoji: string;
  label: string;
}> = [
  { value: "drive", emoji: "🚗", label: "I can drive" },
  { value: "dropOff", emoji: "🚙", label: "Getting dropped off" },
  { value: "bus", emoji: "🚌", label: "Taking the bus" },
];

export const tripAccessLabel = (access: TripAccess) =>
  TRIP_ACCESS_OPTIONS.find((option) => option.value === access)?.label ?? "";

/** What the rider has available. Walking is always part of an itinerary, so it isn't listed. */
export type AccessResources = {
  /** The rider drives themselves and can park (at the destination or a station lot). */
  canDriveMyself: boolean;
  /** A car can carry the rider for part or all of the trip, whoever is driving. */
  canRideInCar: boolean;
};

export function accessResources(access: TripAccess): AccessResources {
  switch (access) {
    case "drive":
      return { canDriveMyself: true, canRideInCar: true };
    case "dropOff":
      return { canDriveMyself: false, canRideInCar: true };
    case "bus":
      return { canDriveMyself: false, canRideInCar: false };
  }
}

/**
 * How a vehicle may be used to reach a Skyline station:
 * - "park": the rider drives and parks, so only stations with a lot qualify.
 * - "dropOff": someone else drives, so any station can be a drop-off point.
 * - "none": no vehicle leg is built.
 */
export type VehicleToStation = "park" | "dropOff" | "none";

export function vehicleToStation(resources: AccessResources): VehicleToStation {
  if (resources.canDriveMyself) return "park";
  if (resources.canRideInCar) return "dropOff";
  return "none";
}

/** Whether a door-to-door car trip (driven or as a passenger) can be compared. */
export function carTripAvailable(resources: AccessResources): boolean {
  return resources.canRideInCar;
}

const STORAGE_KEY = "nalu-trip-access-v2";
const LEGACY_KEY = "nalu-trip-access-v1";
/** An answer is about one trip, so it is forgotten after a few hours. */
const ANSWER_TTL_MS = 4 * 60 * 60_000;
const MAX_REMEMBERED = 8;

/** One answer per destination, so the question isn't repeated while the same trip is under way. */
export function tripAccessKey(to: { lat: number | null; lon: number | null }): string | null {
  if (to.lat === null || to.lon === null) return null;
  return `${to.lat.toFixed(4)},${to.lon.toFixed(4)}`;
}

const isAccess = (value: unknown): value is TripAccess =>
  value === "drive" || value === "dropOff" || value === "bus";

type Stored = Record<string, { a: TripAccess; t: number }>;

function readAll(): Stored {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}");
    if (!parsed || typeof parsed !== "object") return {};
    const out: Stored = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      const entry = value as { a?: unknown; t?: unknown } | null;
      if (entry && isAccess(entry.a) && typeof entry.t === "number")
        out[key] = { a: entry.a, t: entry.t };
    }
    return out;
  } catch {
    return {};
  }
}

export function readTripAccess(key: string | null, nowMs: number): TripAccess | null {
  if (!key || typeof window === "undefined") return null;
  const entry = readAll()[key];
  return entry && nowMs - entry.t < ANSWER_TTL_MS ? entry.a : null;
}

export function writeTripAccess(key: string, access: TripAccess | null, nowMs: number) {
  try {
    const all = readAll();
    if (access === null) delete all[key];
    else all[key] = { a: access, t: nowMs };
    // Keep recent answers only, newest last, and never grow without bound.
    const kept = Object.entries(all)
      .filter(([, entry]) => nowMs - entry.t < ANSWER_TTL_MS)
      .sort((x, y) => x[1].t - y[1].t)
      .slice(-MAX_REMEMBERED);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(kept)));
    window.localStorage.removeItem(LEGACY_KEY);
  } catch {
    /* private mode: the answer still holds for this visit */
  }
}
