/**
 * The drive time on a Browse place chip ("Home · 32 min"): which number to show,
 * and whether to ask for one. Pure rules only; the query lives in
 * components/commute/browse/useChipDriveTimes.ts.
 *
 * - The origin is the rider's position, so nothing shows until it is known.
 * - A rider who is basically at the place (< 300 m) sees no time.
 * - Reuse comes first: any drive time the app already holds for the same trip
 *   (the main screen's Drive row, the Home <-> Work corridor check) is shown
 *   as is. Only Home and Work may ever cost a lookup, never other saved places.
 */
import { distanceBetweenM, type LatLon } from "@/lib/browse-corridors";

/** Closer than this to the place: the rider is there, a drive time would be silly. */
export const CHIP_HERE_METERS = 300;
/** A stored drive time counts as "from the rider" / "to the place" within this distance. */
export const CHIP_MATCH_METERS = 300;

/** A held drive time older than this is not shown: React Query keeps old data after a failed refetch. */
export const CHIP_MAX_AGE_MS = 10 * 60_000;

export type KnownDrive = {
  from: LatLon;
  to: LatLon;
  minutes: number;
  /** When the time was measured (ms). Missing means just now (sample data). */
  at?: number;
  /** A Mapbox fallback time has no usual-time comparison, so it is never shown on a chip. */
  provider?: string;
};

/** True when a drive time is fresh enough, and from a provider with a usual-time comparison, to show. */
export function chipTimeUsable(
  drive: { at?: number | undefined; provider?: string | undefined },
  now = Date.now(),
): boolean {
  if (drive.provider === "mapbox") return false;
  return drive.at === undefined || now - drive.at <= CHIP_MAX_AGE_MS;
}

export type ChipPlace = { id: string; lat: number; lon: number };

export type ChipTime =
  | { status: "hidden" }
  | { status: "known"; minutes: number }
  /** Not held anywhere yet and the place is Home or Work: one lookup is allowed. */
  | { status: "fetch" };

export function chipDriveTime(input: {
  rider: LatLon | null;
  place: ChipPlace;
  /** Ids of the rider's Home and Work places: the only chips allowed to trigger a lookup. */
  lookupIds: ReadonlySet<string>;
  known: readonly KnownDrive[];
  now?: number;
}): ChipTime {
  const { rider, place, lookupIds, known, now = Date.now() } = input;
  if (!rider) return { status: "hidden" };
  if (distanceBetweenM(rider, place) < CHIP_HERE_METERS) return { status: "hidden" };
  const reused = known.find(
    (drive) =>
      chipTimeUsable(drive, now) &&
      Number.isFinite(drive.minutes) &&
      drive.minutes > 0 &&
      distanceBetweenM(drive.from, rider) <= CHIP_MATCH_METERS &&
      distanceBetweenM(drive.to, place) <= CHIP_MATCH_METERS,
  );
  if (reused) return { status: "known", minutes: reused.minutes };
  return lookupIds.has(place.id) ? { status: "fetch" } : { status: "hidden" };
}

function held(from: LatLon, to: LatLon, d: HeldDrive): KnownDrive {
  return {
    from,
    to,
    minutes: d.trafficMinutes,
    ...(d.fetchedAt !== undefined ? { at: d.fetchedAt } : {}),
    ...(d.provider ? { provider: d.provider } : {}),
  };
}

/** Drive times the Browse road checks already hold, as trips (forward and back). */
type HeldDrive = { trafficMinutes: number; fetchedAt?: number; provider?: string };

export function knownFromCorridors(
  corridors: ReadonlyArray<{ a: LatLon; b: LatLon }> | null,
  checks: ReadonlyArray<{
    forward?: HeldDrive | undefined;
    back?: HeldDrive | undefined;
  }>,
): KnownDrive[] {
  const out: KnownDrive[] = [];
  (corridors ?? []).forEach((corridor, i) => {
    const check = checks[i];
    if (check?.forward) out.push(held(corridor.a, corridor.b, check.forward));
    if (check?.back) out.push(held(corridor.b, corridor.a, check.back));
  });
  return out;
}

/** Drive times already in the query cache under the main screen's ["drive", fromLat, fromLon, toLat, toLon]. */
export function knownFromDriveCache(
  entries: ReadonlyArray<[readonly unknown[], Partial<HeldDrive> | undefined]>,
): KnownDrive[] {
  const out: KnownDrive[] = [];
  for (const [key, value] of entries) {
    const [, fromLat, fromLon, toLat, toLon] = key;
    if (
      typeof fromLat === "number" &&
      typeof fromLon === "number" &&
      typeof toLat === "number" &&
      typeof toLon === "number" &&
      typeof value?.trafficMinutes === "number"
    ) {
      out.push(
        held(
          { lat: fromLat, lon: fromLon },
          { lat: toLat, lon: toLon },
          {
            ...value,
            trafficMinutes: value.trafficMinutes,
          },
        ),
      );
    }
  }
  return out;
}
