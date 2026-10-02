import type { HdotScheduledClosure } from "@/lib/hdot-lane-closures.functions";

type Props = {
  scheduledClosures?: HdotScheduledClosure[];
  variant?: "browse" | "commute";
  liveDriveMinutes?: number | null;
  delayMinutes?: number | null;
};

function humanSchedule(value: string) {
  return value.replace(/^\s*(?:on|from)\s+/i, "").replace(/\s+the following morning/gi, "").replace(/\s+the following day/gi, "").replace(/\s+on the evening of/gi, "").replace(/\s+/g, " ").trim();
}

function directionLabel(value: string | null) {
  if (!value) return "";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function trafficLabel(delayMinutes: number | null | undefined) {
  if (delayMinutes == null) return "Live traffic";
  if (delayMinutes >= 8) return "Heavy";
  if (delayMinutes >= 3) return "Moderate";
  return "Light";
}

export function HdotRoadworkNotice({
  scheduledClosures = [],
  variant = "commute",
  liveDriveMinutes = null,
  delayMinutes = null,
}: Props) {
  const scheduled = scheduledClosures.slice(0, 2);
  if (!scheduled.length) return null;

  if (variant === "browse") {
    const primary = scheduled[0];
    return (
      <aside className="mt-3 rounded-xl border border-border/60 bg-background/50 px-3.5 py-3" aria-label="Planned roadwork">
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 text-sm" aria-hidden="true">🛠️</span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-foreground">Roadwork tonight</p>
            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
              {primary.route} {directionLabel(primary.direction)} · {primary.laneSummary}
            </p>
            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{humanSchedule(primary.schedule)}</p>
          </div>
        </div>
      </aside>
    );
  }

  return (
    <aside className="mt-4 rounded-2xl border border-border/60 bg-background/45 px-4 py-4" aria-label="Planned roadwork on your route">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-warning/12 text-sm" aria-hidden="true">🛠️</span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Planned roadwork on your route</p>
          <div className="mt-2 space-y-3">
            {scheduled.map((closure, index) => (
              <div key={closure.route + "-" + closure.location + "-" + index}>
                <p className="text-sm font-bold leading-5 text-foreground">
                  {closure.route} {closure.direction ? directionLabel(closure.direction) + " — " : "— "}{closure.location}
                </p>
                <p className="mt-1 text-xs font-semibold text-warning">
                  {closure.laneSummary} · {humanSchedule(closure.schedule)}
                </p>
                {closure.work ? <p className="mt-1 text-[11px] leading-4 text-muted-foreground">{closure.work}</p> : null}
              </div>
            ))}
          </div>
          {liveDriveMinutes != null && (
            <div className="mt-4 grid grid-cols-2 gap-2 border-t border-border/60 pt-3">
              <div className="rounded-xl bg-muted/35 px-3 py-2.5">
                <p className="text-[10px] font-medium text-muted-foreground">Your live drive time</p>
                <p className="mt-0.5 text-base font-bold tabular-nums text-foreground">{Math.round(liveDriveMinutes)} min</p>
              </div>
              <div className="rounded-xl bg-muted/35 px-3 py-2.5">
                <p className="text-[10px] font-medium text-muted-foreground">Live traffic</p>
                <p className="mt-0.5 text-base font-bold text-foreground">{trafficLabel(delayMinutes)}</p>
              </div>
            </div>
          )}
          <div className="mt-3 flex items-center justify-between gap-3">
            <span className="text-[10px] text-muted-foreground">Official Hawaiʻi DOT</span>
            <a className="text-[11px] font-semibold text-primary underline-offset-2 hover:underline" href="https://hidot.hawaii.gov/highways/roadwork/oahu/" target="_blank" rel="noreferrer">HDOT schedule →</a>
          </div>
        </div>
      </div>
    </aside>
  );
}
