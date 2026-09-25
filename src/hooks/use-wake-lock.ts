import { useEffect } from "react";

type Sentinel = { release: () => Promise<void>; released?: boolean };

/** Keeps the screen awake while `active`; re-acquires when the tab returns. */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || typeof navigator === "undefined") return;
    const api = (navigator as Navigator & {
      wakeLock?: { request: (type: "screen") => Promise<Sentinel> };
    }).wakeLock;
    if (!api) return;
    let sentinel: Sentinel | null = null;
    let cancelled = false;
    const acquire = async () => {
      try {
        if (document.visibilityState !== "visible") return;
        const next = await api.request("screen");
        if (cancelled) void next.release();
        else sentinel = next;
      } catch {
        // Battery saver or an unsupported browser: the trip still works.
      }
    };
    const onVisible = () => {
      if (document.visibilityState === "visible" && (!sentinel || sentinel.released)) void acquire();
    };
    void acquire();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      void sentinel?.release().catch(() => {});
    };
  }, [active]);
}
