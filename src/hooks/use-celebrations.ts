import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { addMorning, streakToCelebrate, type MorningLog } from "@/lib/morning-streak";

const KEY = "nalu-mornings-v1";

function read(): MorningLog {
  try {
    const raw = JSON.parse(
      window.localStorage.getItem(KEY) ?? "null",
    ) as Partial<MorningLog> | null;
    const days = Array.isArray(raw?.days) ? raw.days.filter((d) => typeof d === "string") : [];
    return { days, celebrated: typeof raw?.celebrated === "number" ? raw.celebrated : 0 };
  } catch {
    return { days: [], celebrated: 0 };
  }
}

function write(log: MorningLog) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(log));
  } catch {
    // Storage can be blocked; the celebration is a nicety.
  }
}

function honolulu(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Pacific/Honolulu",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "numeric",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return { iso: `${get("year")}-${get("month")}-${get("day")}`, hour: Number(get("hour")) };
}

/**
 * Small, local-only moments of warmth (counts never leave this device):
 * - a shaka after 5 mornings in a row with an answer, and again at 10, 15...;
 * - a quick wave of the Nalu mark when Skyline beats the drive for a trip.
 * Quiet by design: one toast per milestone, one wave per trip.
 */
export function useCelebrations({
  answered,
  skylineBeatsDrive,
  tripKey,
}: {
  answered: boolean;
  skylineBeatsDrive: boolean;
  tripKey: string;
}) {
  useEffect(() => {
    if (!answered) return;
    const { iso, hour } = honolulu();
    if (hour >= 12) return;
    const log = addMorning(read(), iso);
    const milestone = streakToCelebrate(log, iso);
    write(milestone ? { ...log, celebrated: milestone } : log);
    if (milestone) {
      toast(`🤙 ${milestone} mornings in a row with Nalu`, {
        description: "Shaka. Your commute, figured out.",
      });
    }
  }, [answered]);

  const waved = useRef<string | null>(null);
  useEffect(() => {
    if (!skylineBeatsDrive || waved.current === tripKey) return;
    waved.current = tripKey;
    const root = document.documentElement;
    root.setAttribute("data-celebrate", "wave");
    const id = window.setTimeout(() => root.removeAttribute("data-celebrate"), 1600);
    return () => {
      window.clearTimeout(id);
      root.removeAttribute("data-celebrate");
    };
  }, [skylineBeatsDrive, tripKey]);
}
