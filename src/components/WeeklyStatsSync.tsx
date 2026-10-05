import { useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/use-auth";
import { saveWeeklyStats } from "@/lib/email.functions";
import { thisWeekSoFar } from "@/lib/trip-log";

const KEY = "nalu-weekly-stats-sent-v1";

/**
 * Sends this week's trip totals (numbers only) for the Sunday email, at most
 * once per change. The server drops them unless the rider turned emails on.
 */
export function WeeklyStatsSync() {
  const { user } = useAuth();
  const save = useServerFn(saveWeeklyStats);

  useEffect(() => {
    if (!user?.email) return;
    const userId = user.id;
    function sync() {
      const { key, digest } = thisWeekSoFar();
      if (!digest) return;
      const payload = {
        week: key,
        trips: digest.trips,
        driveTrips: digest.driveTrips,
        transitTrips: digest.transitTrips,
        minutesSaved: digest.minutesSaved,
        averageMinutes: digest.averageMinutes,
      };
      const fingerprint = `${userId}:${JSON.stringify(payload)}`;
      try {
        if (window.localStorage.getItem(KEY) === fingerprint) return;
      } catch {
        /* storage blocked: send anyway */
      }
      void save({ data: payload })
        .then((result) => {
          // Only remember it once it's stored, so turning emails on later still sends it.
          if (!result.saved) return;
          try {
            window.localStorage.setItem(KEY, fingerprint);
          } catch {
            /* ignore */
          }
        })
        .catch(() => {});
    }
    sync();
    // A trip may end while Nalu stays open; catch up when it comes back to the front.
    const onVisible = () => document.visibilityState === "visible" && sync();
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  return null;
}
