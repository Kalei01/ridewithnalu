import { useEffect, useState } from "react";
import {
  activeSeason,
  onSeasonalTouchesChange,
  seasonalTouchesEnabled,
  type ActiveSeason,
} from "@/lib/seasons";

/**
 * Today's season (Honolulu date), or null when none applies or the rider
 * turned seasonal touches off. The date alone decides the first render, so the
 * server HTML already holds the seasonal line and nothing shifts when the page
 * wakes up; the device's "off" switch is applied right after hydration.
 */
export function useSeason(): ActiveSeason | null {
  const [active, setActive] = useState<ActiveSeason | null>(() => activeSeason(new Date()));
  useEffect(() => {
    const read = () => {
      const next = seasonalTouchesEnabled() ? activeSeason(new Date()) : null;
      // Keep the same object when nothing changed, so the hourly check never rerenders.
      setActive((prev) =>
        prev?.season.id === next?.season.id && prev?.phase === next?.phase ? prev : next,
      );
    };
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
