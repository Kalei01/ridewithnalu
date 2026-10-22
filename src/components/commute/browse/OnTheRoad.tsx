import { trafficStatus } from "@/components/commute/H1ConditionsCard";
import { checkRoadNames, netDirection, type RoadCheck } from "@/lib/browse-right-now";

/**
 * "On the road": one row per checked road, both ways, with the live status in
 * words. Roads follow the rider (src/lib/browse-corridors.ts); this card never
 * says "H-1" unless H-1 is what was checked. Incidents and closures are in Right now.
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
  if (loading) return <p className="px-4 py-3 text-sm text-muted-foreground">Checking traffic…</p>;
  if (unavailable || !checks.some((c) => c.forward || c.back))
    return (
      <p className="px-4 py-3 text-sm text-muted-foreground">
        Traffic isn’t available right now. Roadwork and the map still work.
      </p>
    );
  const sources = new Set(
    checks.flatMap((c) => [c.forward, c.back]).flatMap((d) => (d ? [d.provider ?? "tomtom"] : [])),
  );
  const providerLabel = sources.has("mapbox") ? "Mapbox (estimate)" : "TomTom";
  return (
    <div>
      {checks.map((check) => {
        const names = checkRoadNames(check).join(" and ") || check.area;
        const ways = [check.forward, check.back].flatMap((drive) => {
          if (!drive) return [];
          const status = trafficStatus(
            drive.delayMinutes,
            drive.incidents[0],
            drive.typicalChecked !== false,
          );
          const direction = netDirection(drive.path);
          return [{ key: direction ?? "x", direction, status }];
        });
        return (
          <div key={check.id} className="px-4 py-3">
            <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <span className="nh-live-dot" aria-hidden="true" />
              {names}
              <span className="ml-auto text-xs font-normal text-muted-foreground">
                {check.area}
              </span>
            </p>
            <p className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs">
              {ways.map((way, index) => (
                <span
                  key={`${way.key}-${index}`}
                  className={`font-semibold ${way.status.className}`}
                >
                  <span className="font-normal text-muted-foreground">
                    {way.direction
                      ? way.direction.charAt(0).toUpperCase() + way.direction.slice(1)
                      : "This way"}
                    {" · "}
                  </span>
                  {way.status.label}
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
