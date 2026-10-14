import { useEffect, useState } from "react";
import {
  activeSeason,
  onSeasonalTouchesChange,
  seasonalTouchesEnabled,
  type ActiveSeason,
} from "@/lib/seasons";

/**
 * Today's season (Honolulu date), or null when none applies or the rider
 * turned seasonal touches off. Starts null so server and first client render
 * match, then reads the date and the device setting.
 */
export function useSeason(): ActiveSeason | null {
  const [active, setActive] = useState<ActiveSeason | null>(null);
  useEffect(() => {
    const read = () => setActive(seasonalTouchesEnabled() ? activeSeason(new Date()) : null);
    read();
    // Re-check hourly so a tab left open across midnight switches itself.
    const id = window.setInterval(read, 60 * 60 * 1000);
    const off = onSeasonalTouchesChange(read);
    return () => {
      window.clearInterval(id);
      off();
    };
  }, []);
  return active;
}
