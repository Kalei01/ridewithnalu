import { useEffect, useState } from "react";
import { honoluluSeconds } from "@/lib/commute-formatting";
import { leaveCountdown } from "@/lib/leave-countdown";

/**
 * "Leave in 6 min" under the leave-by time, ticking on its own timer so the rest
 * of the screen never re-renders for it. Amber at two minutes and when it's time.
 * Counts only toward a real leave-by time; renders nothing when it is far off.
 */
export function LeaveCountdown({ leaveBySeconds }: { leaveBySeconds: number }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((n) => n + 1), 5_000);
    return () => window.clearInterval(id);
  }, []);
  const countdown = leaveCountdown(leaveBySeconds, honoluluSeconds(new Date()));
  if (!countdown) return null;
  return (
    <p
      className={`mt-1 whitespace-nowrap text-xs font-semibold tabular-nums transition-colors duration-300 ${
        countdown.tone === "ahead" ? "text-muted-foreground" : "leave-pulse text-warning"
      }`}
    >
      <span key={countdown.text} className="nalu-value-in">
        {countdown.text}
      </span>
    </p>
  );
}
