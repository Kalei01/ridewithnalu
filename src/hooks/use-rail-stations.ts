import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { RailStation } from "@/lib/commute-model";

/**
 * One canonical rail-station query. Browse, the setup picker, the maps and trip
 * planning all read the same cached GTFS station list.
 */
export function useRailStations(enabled: boolean) {
  return useQuery({
    queryKey: ["rail-stations"],
    enabled,
    staleTime: 6 * 60 * 60_000,
    queryFn: async (): Promise<RailStation[]> => {
      const { data, error } = await supabase.rpc("rail_stations");
      if (error) throw error;
      return (data ?? []) as RailStation[];
    },
  });
}
