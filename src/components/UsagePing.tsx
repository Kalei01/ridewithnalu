import { useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useRealTier } from "@/hooks/use-tier";
import { debugDeviceId } from "@/lib/debug-log";
import { honoluluDateKey } from "@/lib/commute-formatting";
import { recordAppOpen } from "@/lib/usage.functions";

const KEY = "nalu-counted-day-v1";

/** Counts this phone once a day for the private weekly-users number. */
export function UsagePing() {
  const tier = useRealTier();
  const record = useServerFn(recordAppOpen);
  useEffect(() => {
    const day = honoluluDateKey(new Date());
    let counted: string | null = null;
    try {
      counted = window.localStorage.getItem(KEY);
    } catch {
      /* private mode */
    }
    if (counted === `${day}|${tier}`) return;
    const timer = window.setTimeout(() => {
      void record({ data: { device: debugDeviceId(), tier } })
        .then(() => {
          try {
            window.localStorage.setItem(KEY, `${day}|${tier}`);
          } catch {
            /* private mode */
          }
        })
        .catch(() => undefined);
    }, 3000);
    return () => window.clearTimeout(timer);
  }, [tier]);
  return null;
}
