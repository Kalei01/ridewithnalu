import { useEffect, useRef } from "react";
import { funnelAnswer, funnelStep } from "@/lib/funnel";

/**
 * Anonymous funnel counts for one trip lookup: it started, and an answer
 * appeared (with how many seconds that took). The destination is only used to
 * tell one lookup from the next; it is never sent anywhere.
 */
export function useFunnelTrip(destinationKey: string | null, loading: boolean, answered: boolean) {
  const startedAt = useRef<number | null>(null);
  const doneKey = useRef<string | null>(null);
  useEffect(() => {
    if (!destinationKey || doneKey.current === destinationKey) return;
    if (startedAt.current === null) {
      if (!loading && !answered) return;
      startedAt.current = Date.now();
      funnelStep("trip_tried");
    }
    if (!loading && answered) {
      funnelAnswer((Date.now() - startedAt.current) / 1000);
      doneKey.current = destinationKey;
      startedAt.current = null;
    }
  }, [destinationKey, loading, answered]);
  useEffect(() => {
    startedAt.current = null;
  }, [destinationKey]);
}
