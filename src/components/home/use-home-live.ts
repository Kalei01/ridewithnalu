import { useQuery } from "@tanstack/react-query";
import type { HomeLive, HomeRace } from "@/lib/home/home-types";

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(path, { headers: { accept: "application/json" } });
  if (!response.ok) throw new Error(`${path} ${response.status}`);
  return (await response.json()) as T;
}

/** The home page's live conditions (one shared server check), refreshed quietly every 2 minutes. */
export function useHomeLive() {
  return useQuery({
    queryKey: ["home-live"],
    queryFn: () => getJson<HomeLive>("/api/public/home-live"),
    staleTime: 60_000,
    refetchInterval: 2 * 60_000,
    refetchIntervalInBackground: false,
    retry: 1,
  });
}

/** The race demo's trip, checked when the map comes into view so the tap is instant. */
export function useHomeRace(enabled: boolean) {
  return useQuery({
    queryKey: ["home-race"],
    queryFn: () => getJson<HomeRace>("/api/public/home-race"),
    enabled,
    staleTime: 3 * 60_000,
    retry: 0,
  });
}

/** Honolulu seconds after midnight now, from the server's clock at `live` and the time since. */
export function honoluluNowSeconds(
  live: { generatedAt: number; serviceSeconds: number },
  nowMs = Date.now(),
) {
  return live.serviceSeconds + (nowMs - live.generatedAt) / 1000;
}
