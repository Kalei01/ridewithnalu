import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Footprints } from "lucide-react";
import { distanceM } from "@/lib/commute-formatting";
import { WALK_LIMIT_MINUTES, walkTime } from "@/lib/walk.functions";

type Point = { lat: number; lon: number };

/** Opens the phone's own walking directions; Nalu doesn't rebuild those. */
function walkingDirectionsUrl(to: Point) {
  const ios = typeof navigator !== "undefined" && /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent);
  return ios
    ? `https://maps.apple.com/?daddr=${to.lat},${to.lon}&dirflg=w`
    : `https://www.google.com/maps/dir/?api=1&destination=${to.lat},${to.lon}&travelmode=walking`;
}

/**
 * For places close enough to walk, offer it: "Walk · 12 min". Hidden for
 * longer trips, so it only appears when it's a real option.
 */
export function WalkCard({ from, to }: { from: Point; to: Point }) {
  const lookup = useServerFn(walkTime);
  // Straight-line check first, so far trips never ask for a walking route.
  const close = distanceM(from, to) <= 2000;
  const { data } = useQuery({
    queryKey: ["walk", from.lat.toFixed(4), from.lon.toFixed(4), to.lat.toFixed(4), to.lon.toFixed(4)],
    enabled: close,
    staleTime: 10 * 60_000,
    queryFn: () => lookup({ data: { fromLat: from.lat, fromLon: from.lon, toLat: to.lat, toLon: to.lon } }),
  });
  if (!close || !data || data.minutes > WALK_LIMIT_MINUTES) return null;
  return (
    <section className="mt-4 flex items-center gap-3 rounded-2xl border border-border bg-background/40 p-4" aria-label="Walk there">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary">
        <Footprints className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-base font-semibold text-foreground">Close enough to walk · {data.minutes} min</p>
        <p className="text-sm text-muted-foreground">No parking needed.</p>
      </div>
      <a
        href={walkingDirectionsUrl(to)}
        className="flex h-11 shrink-0 items-center rounded-lg border border-border bg-background/60 px-4 text-base font-semibold text-foreground"
      >
        Walk
      </a>
    </section>
  );
}
