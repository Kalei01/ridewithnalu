import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { busArrivals, type BusArrival } from "@/lib/bus-arrivals.functions";
import type { NearbyArrival } from "@/lib/commute-model";
import { BUS_POSITION_MAX_AGE_MS } from "@/lib/browse-stop-buses";
import type { BrowseDemo } from "./browse-demo";

/**
 * Live arrivals for the open bus-stop card, from TheBus (same server call and
 * answer as the trip screen). Refreshes on the card's own 60 s beat, only while
 * the card is open; nothing is fetched otherwise. A failed or empty answer is
 * just "no live data": the card shows scheduled times and no buses.
 */
export function useStopBuses(
  stop: { stopId: string; routeType: number; arrivals: NearbyArrival[] } | null,
  nowSeconds: number,
  demo?: BrowseDemo | null,
): BusArrival[] | undefined {
  const fetchArrivals = useServerFn(busArrivals);
  const isBus = Boolean(stop) && stop!.routeType !== 1;
  const scheduled = (stop?.arrivals ?? []).slice(0, 12).map((a) => ({
    routeShortName: a.route_short_name,
    headsign: a.headsign,
    scheduledSeconds: a.departure_seconds,
  }));
  const { data, dataUpdatedAt } = useQuery({
    queryKey: ["browse-stop-live", stop?.stopId, demo ? "demo" : "live"],
    enabled: isBus,
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: false,
    retry: false,
    queryFn: async (): Promise<BusArrival[]> => {
      if (demo?.busPositions) {
        // Sample data, labelled in the preview: the first departures run live at the sample spots.
        return scheduled.slice(0, demo.busPositions.length).map((s, i) => ({
          routeShortName: s.routeShortName ?? "",
          headsign: s.headsign ?? "",
          estimatedArrivalTime: null,
          scheduledArrivalTime: "",
          scheduledSeconds: s.scheduledSeconds,
          estimatedSeconds: s.scheduledSeconds + 60,
          isDelayed: false,
          delayMinutes: 1,
          minutesAway: Math.max(0, Math.ceil((s.scheduledSeconds + 60 - nowSeconds) / 60)),
          isLive: true,
          canceled: false,
          vehicle: { id: `demo-${i}`, ...demo.busPositions![i]! },
        }));
      }
      const result = await fetchArrivals({ data: { stopId: stop!.stopId, scheduled } });
      return result.error ? [] : result.arrivals;
    },
  });
  // A failed refresh keeps the old answer in React Query; positions older than ~2 min are dropped.
  const fresh = Date.now() - dataUpdatedAt <= BUS_POSITION_MAX_AGE_MS;
  return isBus && fresh ? data : undefined;
}
