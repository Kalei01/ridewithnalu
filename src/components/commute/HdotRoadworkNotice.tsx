import type { HdotLaneClosureRoute } from "@/lib/hdot-lane-closures.functions";

type Props = {
  closures: HdotLaneClosureRoute[];
};

function labelFor(closure: HdotLaneClosureRoute) {
  const routeName = typeof closure.routeName === "string" ? closure.routeName : null;
  const direction = typeof closure.direction === "string" ? closure.direction : null;
  if (routeName && direction) return `${routeName} · ${direction}`;
  return routeName ?? "State roadway";
}

/**
 * Official-state-source context only. This does not modify the TomTom ETA.
 * Dates/times are intentionally not inferred from the spatial ArcGIS layer.
 */
export function HdotRoadworkNotice({ closures }: Props) {
  const labels = Array.from(new Set(closures.map(labelFor))).slice(0, 3);
  if (!labels.length) return null;

  return (
    <aside
      className="mt-4 rounded-xl border border-border/60 bg-background/35 px-3.5 py-3"
      aria-label="Hawaii DOT roadwork information"
    >
      <div className="flex items-start gap-2.5">
        <span className="mt-1 size-2 shrink-0 rounded-full bg-warning" aria-hidden="true" />
        <div className="min-w-0">
          <p className="text-sm font-bold text-foreground">HDOT roadwork information</p>
          <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
            Nalu found a state lane-closure segment on or along this drive. This is supplemental
            information and does not change your TomTom travel time.
          </p>
          <p className="mt-2 text-xs font-semibold text-foreground">{labels.join(" · ")}</p>
          <p className="mt-2 text-[10px] leading-4 text-muted-foreground">
            Source: Hawaiʻi Department of Transportation · planned roadwork data
          </p>
          <a
            className="mt-0.5 inline-block text-[10px] font-semibold text-primary underline-offset-2 hover:underline"
            href="https://hidot.hawaii.gov/highways/roadwork/"
            target="_blank"
            rel="noreferrer"
          >
            View official HDOT roadwork schedule
          </a>
        </div>
      </div>
    </aside>
  );
}
