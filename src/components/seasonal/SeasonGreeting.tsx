import { useMemo } from "react";
import { useSeason } from "@/hooks/use-season";
import { seasonGreeting } from "@/lib/seasons";
import "./seasonal.css";

/**
 * One quiet seasonal line (motif + words) for a low-priority spot such as the
 * welcome page. Renders nothing when no season applies, the afterglow has no
 * line, or the rider turned seasonal touches off.
 */
export function SeasonGreeting({ className = "" }: { className?: string }) {
  const active = useSeason();
  const line = useMemo(() => (active ? seasonGreeting(active, new Date()) : null), [active]);
  if (!active || !line) return null;
  return (
    <p className={`nalu-season-line ${className}`} data-season-phase={active.phase}>
      <span
        className="nalu-season-motif"
        aria-hidden="true"
        dangerouslySetInnerHTML={{ __html: active.season.motif }}
      />
      <span suppressHydrationWarning>{line}</span>
    </p>
  );
}
