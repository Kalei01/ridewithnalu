import type { HdotLaneClosureRoute, HdotScheduledClosure } from "@/lib/hdot-lane-closures.functions";

type Props = {
  closures: HdotLaneClosureRoute[];
  scheduledClosures?: HdotScheduledClosure[];
};

function cleanDirection(value: string | null | undefined) {
  if (!value) return null;
  const normalized = value.trim().toUpperCase();
  if (normalized === "WB") return "westbound";
  if (normalized === "EB") return "eastbound";
  if (normalized === "NB") return "northbound";
  if (normalized === "SB") return "southbound";
  return value.trim();
}

function cleanRouteName(value: string | null | undefined) {
  if (!value) return null;
  const name = value.trim();
  if (!name) return null;
  const match = name.match(/^(.+?)_(WB|EB|NB|SB)(?:_|$)/i);
  if (match) return match[1] + " " + cleanDirection(match[2]);
  return name;
}

function labelFor(closure: HdotLaneClosureRoute) {
  const routeName = cleanRouteName(closure.routeName);
  const route = cleanRouteName(closure.route);
  const direction = cleanDirection(closure.direction);
  if (routeName && !routeName.includes("_")) return routeName;
  if (route && direction) return route + " · " + direction;
  return routeName ?? route ?? "State roadway";
}

function humanSchedule(value: string) {
  return value
    .replace(/^\s*(?:on|from)\s+/i, "")
    .replace(/\s+the following morning/gi, "")
    .replace(/\s+the following day/gi, "")
    .replace(/\s+on the evening of/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function closureTitle(closure: HdotScheduledClosure) {
  const direction = closure.direction ? " · " + closure.direction : "";
  return closure.location + direction;
}

/** Official HDOT schedule context; TomTom remains the live travel-time source. */
export function HdotRoadworkNotice({ closures, scheduledClosures = [] }: Props) {
  const scheduled = scheduledClosures.slice(0, 3);
  const labels = Array.from(new Set(closures.map(labelFor).filter(Boolean))).slice(0, 3);
  if (!scheduled.length && !labels.length) return null;

  return (
    <aside
      className="mt-4 rounded-2xl border border-border/60 bg-background/45 px-4 py-3.5"
      aria-label="HDOT planned roadwork"
    >
      <div className="flex items-start gap-3">
        <span className="mt-1 flex size-7 shrink-0 items-center justify-center rounded-full bg-warning/12 text-warning" aria-hidden="true">!
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-bold text-foreground">{scheduled.length ? "Planned roadwork" : "HDOT roadwork"}</p>
            <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">HDOT</span>
          </div>
          {scheduled.length ? (
            <div className="mt-2.5 space-y-2">
              {scheduled.map((closure, index) => (
                <div key={closure.route + "-" + closure.location + "-" + (closure.direction ?? "any") + "-" + index} className="rounded-xl border border-border/50 bg-muted/30 px-3 py-2.5">
                  <p className="text-xs font-bold text-foreground">{closureTitle(closure)}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]">
                    <span className="font-semibold text-warning">{closure.laneSummary}</span>
                    <span className="text-muted-foreground">•</span>
                    <span className="text-muted-foreground">{humanSchedule(closure.schedule)}</span>
                  </div>
                  {closure.work ? <p className="mt-1 text-[10px] leading-4 text-muted-foreground">{closure.work}</p> : null}
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {labels.map((label) => <span key={label} className="rounded-lg border border-border/60 bg-muted/40 px-2 py-1 text-[11px] font-medium text-foreground">{label}</span>)}
            </div>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
            <a className="text-[11px] font-semibold text-primary underline-offset-2 hover:underline" href="https://hidot.hawaii.gov/highways/roadwork/oahu/" target="_blank" rel="noreferrer">Check HDOT schedule →</a>
            <span className="text-[10px] text-muted-foreground">Official Hawaiʻi DOT weekly roadwork</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
