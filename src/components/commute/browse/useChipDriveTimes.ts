import { useMemo } from "react";
import { useQueries, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { driveTime, type DriveTime } from "@/lib/drive.functions";
import {
  chipDriveTime,
  knownFromCorridors,
  knownFromDriveCache,
  type KnownDrive,
} from "@/lib/browse-chip-time";
import type { LatLon } from "@/lib/browse-corridors";
import type { SavedPlace } from "@/lib/places/saved-places";
import type { BrowseDemo } from "./browse-demo";

/**
 * Drive minutes for the place chips ("Home · 32 min"), by place id.
 * Reuses what the app already holds (the Drive row's ["drive", ...] cache, the
 * Home <-> Work corridor check) and only looks up Home or Work when neither
 * has it: the same driveTime call as the Drive row, 5 min stale time, no
 * polling, no refetch on focus. At most 2 lookups per rider position; nothing
 * for other saved places. Unknown or failed shows nothing.
 */
export function useChipDriveTimes(input: {
  places: readonly SavedPlace[];
  home: { id: string } | null;
  work: { id: string } | null;
  rider: LatLon | null;
  corridors: ReadonlyArray<{ a: LatLon; b: LatLon }> | null;
  roadChecks: ReadonlyArray<{
    forward?: { trafficMinutes: number } | undefined;
    back?: { trafficMinutes: number } | undefined;
  }>;
  demo?: BrowseDemo | null;
}): Map<string, number> {
  const { places, home, work, rider, corridors, roadChecks, demo } = input;
  const queryClient = useQueryClient();
  const rawFetch = useServerFn(driveTime);
  const lookupIds = useMemo(
    () => new Set([home?.id, work?.id].filter((id): id is string => Boolean(id))),
    [home?.id, work?.id],
  );
  const visible = places.slice(0, 4);

  const known: KnownDrive[] = [
    ...knownFromCorridors(corridors, roadChecks),
    ...knownFromDriveCache(
      queryClient.getQueriesData<DriveTime>({ queryKey: ["drive"] }) as Array<
        [readonly unknown[], DriveTime | undefined]
      >,
    ),
    ...(demo?.chipMinutes && rider
      ? visible.flatMap((place) => {
          const minutes = demo.chipMinutes?.[place.kind as "home" | "work"];
          return minutes ? [{ from: rider, to: place, minutes }] : [];
        })
      : []),
  ];
  const picks = visible.map((place) => ({
    place,
    pick: chipDriveTime({ rider, place, lookupIds, known }),
  }));
  const toFetch = demo ? [] : picks.filter((p) => p.pick.status === "fetch").map((p) => p.place);

  // The rider's spot matters to about a kilometre (as for the road checks), not every GPS tick.
  const riderKey = rider ? `${rider.lat.toFixed(2)},${rider.lon.toFixed(2)}` : null;
  const fetched = useQueries({
    queries: toFetch.map((place) => ({
      queryKey: ["browse-chip-drive", riderKey, place.id, place.lat, place.lon],
      staleTime: 5 * 60_000,
      gcTime: 10 * 60_000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      retry: false,
      queryFn: async () => {
        const result = await rawFetch({
          data: {
            fromLat: rider!.lat,
            fromLon: rider!.lon,
            toLat: place.lat,
            toLon: place.lon,
            forceRefresh: false,
          },
        });
        if (!result) throw new Error("Drive routing temporarily unavailable");
        return result.trafficMinutes;
      },
    })),
  });

  const out = new Map<string, number>();
  for (const { place, pick } of picks) {
    if (pick.status === "known") out.set(place.id, pick.minutes);
  }
  toFetch.forEach((place, i) => {
    const minutes = fetched[i]?.data;
    if (typeof minutes === "number" && minutes > 0) out.set(place.id, minutes);
  });
  return out;
}
