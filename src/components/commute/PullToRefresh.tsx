import { useEffect, useRef, useState } from "react";
import { WaveMark } from "@/components/commute/NaluPersonalityStrip";

const THRESHOLD = 90;

/**
 * Pull down from the top of the app screen to re-check. A small Nalu wave follows
 * the finger and curls while the trip re-checks. Ignores touches on the map and in
 * fields, never blocks scrolling (passive listeners), and does nothing on mouse.
 */
export function PullToRefresh({
  onRefresh,
  refreshing,
  enabled,
}: {
  onRefresh: () => void;
  refreshing: boolean;
  enabled: boolean;
}) {
  const [pull, setPull] = useState(0);
  const start = useRef<number | null>(null);
  const latest = useRef({ onRefresh, refreshing });
  latest.current = { onRefresh, refreshing };
  const pullRef = useRef(0);
  pullRef.current = pull;

  useEffect(() => {
    if (!enabled) return;
    const root = document.documentElement;
    root.setAttribute("data-ptr", "true");
    const reset = () => {
      start.current = null;
      setPull(0);
    };
    const onStart = (event: TouchEvent) => {
      const target = event.target as Element | null;
      if (
        window.scrollY > 0 ||
        target?.closest(".leaflet-container, input, textarea, [role=dialog]")
      ) {
        start.current = null;
        return;
      }
      start.current = event.touches[0]?.clientY ?? null;
    };
    const onMove = (event: TouchEvent) => {
      if (start.current === null) return;
      const dy = (event.touches[0]?.clientY ?? 0) - start.current;
      if (dy <= 0 || window.scrollY > 0) return reset();
      setPull(Math.min(1, dy / THRESHOLD));
    };
    const onEnd = () => {
      if (start.current !== null && pullRef.current >= 1 && !latest.current.refreshing) {
        latest.current.onRefresh();
      }
      reset();
    };
    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onEnd, { passive: true });
    window.addEventListener("touchcancel", reset, { passive: true });
    return () => {
      root.removeAttribute("data-ptr");
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", reset);
    };
  }, [enabled]);

  const visible = refreshing || pull > 0;
  if (!enabled || !visible) return null;
  return (
    <div
      aria-hidden="true"
      className="ptr-indicator pointer-events-none fixed left-1/2 top-3 z-50 text-primary"
      style={{
        opacity: refreshing ? 1 : pull,
        transform: `translate(-50%, ${refreshing ? 8 : pull * 24}px)`,
      }}
    >
      <WaveMark className={`h-8 w-12 ${refreshing ? "ptr-curl" : ""}`} />
    </div>
  );
}
