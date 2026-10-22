import { trafficStatus } from "@/components/commute/H1ConditionsCard";
import { checkRoadNames, routeDirectionOn, type RoadCheck } from "@/lib/browse-right-now";
import { standaloneIncidentCondition } from "@/lib/traffic-incidents";
import type { DriveTime } from "@/lib/drive.functions";

type Level = 0 | 1 | 2;
const DOT = ["nh-live-dot", "nb-now-dot bg-warning", "nb-now-dot bg-destructive"] as const;

/** One way's status in words, and how bad it is (0 fine, 1 slower, 2 incident or heavy). */
function wayStatus(drive: DriveTime): { label: string; className: string; level: Level } {
  const incident = drive.incidents[0];
  // The road is already named on the row: say what, not where.
  if (incident)
    return {
      label: standaloneIncidentCondition(incident),
      className: "text-destructive",
      level: 2,
    };
  const known = drive.typicalChecked !== false;
  const status = trafficStatus(drive.delayMinutes, undefined, known);
  const delay = Math.round(drive.delayMinutes);
  // Without the incident feed "Clear" would claim more than we know.
  if (known && delay <= 0 && drive.incidentsAvailable === false)
    return {
      label: "Moving normally · crash data limited",
      className: "text-muted-foreground",
      level: 0,
    };
  return {
    label: status.label,
    className: status.className,
    level: !known ? 0 : delay >= 10 ? 2 : delay > 0 ? 1 : 0,
  };
}

/**
 * "On the road": one row per checked road, both ways, with the live status in
 * words. Roads follow the rider (src/lib/browse-corridors.ts); this card never
 * says "H-1" unless H-1 is what was checked. Incidents and closures are in Right now,
 * and a failed or loading check is said there once, so this card then stays out of the way.
 */
export function RoadStatusRows({
  checks,
  loading,
  unavailable,
}: {
  checks: RoadCheck[];
  loading: boolean;
  unavailable: boolean;
}) {
  if (loading || unavailable || !checks.some((c) => c.forward || c.back)) return null;
  const sources = new Set(
    checks.flatMap((c) => [c.forward, c.back]).flatMap((d) => (d ? [d.provider ?? "tomtom"] : [])),
  );
  const providerLabel = sources.has("mapbox") ? "Mapbox (estimate)" : "TomTom";
  return (
    <div>
      {checks.map((check) => {
        const names = checkRoadNames(check);
        const main = names[0] ?? "";
        const ways = [check.forward, check.back].flatMap((drive, index) => {
          if (!drive) return [];
          const direction = routeDirectionOn(drive, main);
          const label = direction
            ? direction.charAt(0).toUpperCase() + direction.slice(1)
            : index === 0
              ? "Outbound"
              : "Return";
          const { label: text, ...status } = wayStatus(drive);
          return [{ label, text, ...status }];
        });
        const worst = ways.reduce<Level>((a, w) => (w.level > a ? w.level : a), 0);
        return (
          <div key={check.id} className="px-4 py-3">
            <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <span className={DOT[worst]} aria-hidden="true" />
              {names.join(" and ") || check.area}
              <span className="ml-auto text-xs font-normal text-muted-foreground">
                {check.area}
              </span>
            </p>
            <p className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs">
              {ways.map((way) => (
                <span key={way.label} className={`font-semibold ${way.className}`}>
                  <span className="font-normal text-muted-foreground">{way.label} · </span>
                  {way.text}
                </span>
              ))}
            </p>
          </div>
        );
      })}
      <p className="px-4 pb-3 text-xs text-muted-foreground">
        Traffic: {providerLabel} · live, compared with the usual time
      </p>
    </div>
  );
}
