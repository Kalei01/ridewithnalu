import { MapPin } from "lucide-react";
import { regionTimeZone } from "@/lib/region";
import { ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { type BusArrival, type BusArrivalsResult } from "@/lib/bus-arrivals.functions";
import { confirmedLiveBus } from "@/lib/bus-match";
import { FareNotice, LandmarkHint } from "@/components/commute/TransitNotices";
import { TONE_CLASS, type WeatherLine } from "@/components/commute/H1ConditionsCard";
import {
  clockFromSeconds,
  distanceM,
  formatDistance,
  stationLabel,
  titleCase,
  transitStopName,
} from "@/lib/commute-formatting";
import { Leg, Option, modeIcon, vehicleName } from "@/lib/commute-model";

export const WalkingMicroMap = lazy(() => import("@/components/commute/WalkingMicroMap"));

export function RailTripBreakdown({
  option,
  inbound,
  liveBus,
  liveBusRefreshing,
  weatherLines,
  points,
  activeLeg = null,
  onSelectLeg,
}: {
  option: Option;
  inbound: boolean;
  liveBus: BusArrivalsResult | undefined;
  liveBusRefreshing: boolean;
  weatherLines: Map<number, WeatherLine[]>;
  points: Array<{ id?: string; name: string; lat: number; lon: number }>;
  /** Index (in `option.legs`) of the step shown on the map, if any. */
  activeLeg?: number | null;
  /** Tapping a step shows that leg on the map. */
  onSelectLeg?: (legIndex: number) => void;
}) {
  const duration = (leg: Leg) =>
    leg.minutes ??
    (leg.depart_seconds !== null && leg.arrive_seconds !== null
      ? Math.max(0, Math.round((leg.arrive_seconds - leg.depart_seconds) / 60))
      : null);
  // Every leg, in the order the planner produced (chronological), so
  // transfer walks and multiple bus connections are never dropped.
  const rows = option.legs
    .map((leg, i) => ({ leg, i }))
    .sort((a, b) => {
      const ta = a.leg.depart_seconds,
        tb = b.leg.depart_seconds;
      return ta !== null && tb !== null && ta !== tb ? ta - tb : a.i - b.i;
    })
    .map(({ leg, i }) => ({ leg, i }));

  return (
    <>
      <ol className="mt-7" aria-label="Transit trip breakdown">
        {rows.map(({ leg, i: legIndex }, index) => {
          const Icon = modeIcon(leg.mode);
          const previous = rows[index - 1]?.leg;
          const waitMinutes =
            previous?.arrive_seconds !== null &&
            previous?.arrive_seconds !== undefined &&
            leg.depart_seconds !== null
              ? Math.max(0, Math.round((leg.depart_seconds - previous.arrive_seconds) / 60))
              : 0;
          const legMinutes = duration(leg);
          const nextLeg = rows[index + 1]?.leg;
          const toBusStop =
            nextLeg?.mode === "bus" || (leg.mode === "bus" && leg.kind === "access");
          const stationName = toBusStop ? titleCase(leg.to) : stationLabel(leg.to);
          const label =
            leg.mode === "bus" && leg.kind !== "access"
              ? leg.route_short
                ? `Bus ${leg.route_short}`
                : "Bus"
              : leg.mode === "walk" && leg.kind === "connect"
                ? `Walk to ${toBusStop ? titleCase(leg.to) || "the next stop" : `${stationLabel(leg.to) || "the"} Station`}`
                : leg.kind === "access"
                  ? leg.mode === "walk"
                    ? toBusStop
                      ? `Walk to ${stationName || "the bus stop"}`
                      : `Walk to ${stationName || "the station"} Station`
                    : stationName
                      ? `To ${stationName}${leg.mode === "bus" ? "" : " Station"}`
                      : leg.mode === "bus"
                        ? "To the stop"
                        : "To the station"
                  : leg.kind === "rail"
                    ? "Skyline"
                    : leg.kind === "connect"
                      ? "Connecting bus"
                      : leg.mode === "bus"
                        ? inbound
                          ? "Bus home"
                          : "Connecting bus"
                        : leg.mode === "drive"
                          ? inbound
                            ? "Drive home"
                            : "Drive"
                          : inbound
                            ? "Walk home"
                            : "Final walk";
          const arrivalLabel =
            leg.kind === "egress"
              ? inbound
                ? "home"
                : "destination"
              : leg.kind === "access"
                ? leg.mode === "bus" || toBusStop
                  ? `${stationName || titleCase(leg.to) || "stop"}`
                  : `${stationName || titleCase(leg.to) || "station"} Station platform`
                : titleCase(leg.to);
          const liveArrival =
            leg.mode === "bus"
              ? matchLiveArrival(liveBus, leg.route_short, leg.headsign, leg.depart_seconds)
              : null;
          const followsTransit = previous?.mode === "bus" || previous?.mode === "rail";
          const pointByName = (name: string | null) => {
            const wanted = stationLabel(name).toLowerCase();
            if (!wanted) return null;
            return (
              points.find((point) => stationLabel(point.name).toLowerCase() === wanted) ?? null
            );
          };
          const walkFrom = leg.mode === "walk" ? pointByName(leg.from) : null;
          const walkTo = leg.mode === "walk" ? pointByName(leg.to) : null;
          const originPoint = points.find((point) => point.id === "start") ?? null;
          const finalPoint = points.find((point) => point.id === "end") ?? null;
          const isTransit = leg.mode === "bus" || leg.mode === "rail";
          // Boarding a bus/train still starts on foot: origin -> boarding stop.
          const accessWalk =
            isTransit && index === 0 && originPoint
              ? walkBetween(originPoint, pointByName(leg.from), transitStopName(leg, "from"))
              : null;
          // Last leg is transit: the rider still walks from the drop-off to the door.
          const egressWalk =
            isTransit && index === rows.length - 1 && finalPoint
              ? walkBetween(
                  pointByName(leg.to),
                  finalPoint,
                  finalPoint.name,
                  transitStopName(leg, "to"),
                )
              : null;

          return (
            <li key={`${leg.kind}-${leg.depart_seconds}-${index}`} className="flex gap-2.5">
              <span className="flex flex-col items-center pt-0.5">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-surface-raised text-foreground">
                  <Icon className="size-3" />
                </span>
                {index < rows.length - 1 && <span className="w-px flex-1 bg-border" />}
              </span>
              <div className="min-w-0 flex-1 pb-5">
                {(() => {
                  const title =
                    followsTransit && previous && isTransit
                      ? `Get off at ${transitStopName(previous, "to")}`
                      : label;
                  const header = (
                    <>
                      <span className="text-xs font-bold uppercase text-foreground">
                        {/* The ride above already says where to get off; a walk after it is titled as the walk. */}
                        {title}
                      </span>
                      <span className="flex shrink-0 items-center gap-1.5">
                        {legMinutes !== null && (
                          <span className="text-xs font-semibold tabular-nums text-foreground">
                            {legMinutes} min
                          </span>
                        )}
                        {onSelectLeg && (
                          <MapPin
                            aria-hidden="true"
                            className={`size-3.5 ${activeLeg === legIndex ? "text-recommended" : "text-muted-foreground"}`}
                          />
                        )}
                      </span>
                    </>
                  );
                  return onSelectLeg ? (
                    <button
                      type="button"
                      onClick={() => onSelectLeg(legIndex)}
                      aria-label={`Show on the map: ${title}`}
                      aria-pressed={activeLeg === legIndex}
                      className={`-mx-2 flex min-h-11 w-[calc(100%+1rem)] items-center justify-between gap-2 rounded-lg px-2 text-left transition-colors ${
                        activeLeg === legIndex ? "bg-recommended/10 ring-1 ring-recommended" : ""
                      }`}
                    >
                      {header}
                    </button>
                  ) : (
                    <div className="flex items-baseline justify-between gap-2">{header}</div>
                  );
                })()}
                {(followsTransit && isTransit) ||
                vehicleName(leg).toLowerCase() !== label.toLowerCase() ? (
                  <p
                    className={`mt-1 text-sm font-bold leading-snug text-foreground ${followsTransit && isTransit ? "rounded-md border border-recommended/50 bg-recommended/10 px-2.5 py-2" : ""}`}
                  >
                    {followsTransit && isTransit
                      ? `${vehicleName(leg)} from ${transitStopName(previous, "to")}`
                      : vehicleName(leg)}
                  </p>
                ) : null}
                {accessWalk && <WalkSegment walk={accessWalk} />}
                {leg.mode === "bus" ? (
                  <div className="mt-2">
                    {waitMinutes > 0 && (
                      <p className="text-xs font-semibold text-foreground">
                        Walk/wait between rides · {waitMinutes} min
                      </p>
                    )}
                    <p className="text-sm font-semibold text-foreground">
                      Board at: {transitStopName(leg, "from")} ·{" "}
                      {clockFromSeconds(leg.depart_seconds)}
                    </p>
                    <LandmarkHint name={transitStopName(leg, "from")} />
                    <BusArrivalTime
                      arrival={liveArrival}
                      scheduledSeconds={leg.depart_seconds}
                      fetchedAt={liveBus?.fetchedAt}
                      refreshing={liveBusRefreshing}
                      compact
                    />
                    {liveArrival?.vehicle && pointByName(leg.from) && (
                      <p className="mt-1 text-sm font-semibold text-warning">
                        Bus is about{" "}
                        {formatDistance(distanceM(liveArrival.vehicle, pointByName(leg.from)!))}{" "}
                        from your stop · shown on the map
                      </p>
                    )}
                    <p className="mt-2 flex flex-wrap items-baseline justify-between gap-2 rounded-md border border-recommended/50 bg-recommended/10 px-2.5 py-2 text-sm font-bold text-foreground">
                      <span>Get off at: {transitStopName(leg, "to")}</span>
                      <span className="shrink-0 tabular-nums">
                        {clockFromSeconds(leg.arrive_seconds)}
                      </span>
                    </p>
                    <LandmarkHint name={transitStopName(leg, "to")} />
                    <p className="mt-1 text-xs font-semibold text-foreground">
                      Ride {legMinutes ?? "—"} min
                    </p>
                  </div>
                ) : leg.mode === "rail" ? (
                  <div className="mt-2 space-y-1.5">
                    <p className="text-sm font-semibold text-foreground">
                      Board at: {transitStopName(leg, "from")} ·{" "}
                      {clockFromSeconds(leg.depart_seconds)}
                    </p>
                    <LandmarkHint name={transitStopName(leg, "from")} />
                    <p className="flex flex-wrap items-baseline justify-between gap-2 rounded-md border border-recommended/50 bg-recommended/10 px-2.5 py-2 text-sm font-bold text-foreground">
                      <span>Get off at: {transitStopName(leg, "to")}</span>
                      <span className="shrink-0 tabular-nums">
                        {clockFromSeconds(leg.arrive_seconds)}
                      </span>
                    </p>
                    <LandmarkHint name={transitStopName(leg, "to")} />
                  </div>
                ) : (
                  <div className="mt-1 text-xs font-semibold leading-relaxed text-foreground">
                    {leg.mode === "walk" && legMinutes !== null && (
                      <p className="text-sm font-bold">
                        {formatDistance(legMinutes * 80.47)} · {legMinutes} min walk
                        {legMinutes >= 15 && (
                          <span className="ml-1.5 rounded-full bg-warning/15 px-2 py-0.5 text-xs font-semibold text-warning">
                            Long walk
                          </span>
                        )}
                      </p>
                    )}
                    <p>{`Arrive ${arrivalLabel} ${clockFromSeconds(leg.arrive_seconds)}`}</p>
                    {walkFrom && walkTo && (
                      <details className="walking-map-details mt-2">
                        <summary>Show walking map</summary>
                        <div className="map-shell mt-2 overflow-hidden rounded-lg">
                          <ClientOnly fallback={<div className="h-40 animate-pulse bg-muted" />}>
                            <Suspense fallback={<div className="h-40 animate-pulse bg-muted" />}>
                              <WalkingMicroMap
                                from={{ ...walkFrom, label: titleCase(leg.from) }}
                                to={{ ...walkTo, label: titleCase(leg.to) }}
                              />
                            </Suspense>
                          </ClientOnly>
                        </div>
                      </details>
                    )}
                  </div>
                )}
                {egressWalk && <WalkSegment walk={egressWalk} />}
                {(weatherLines.get(option.legs.indexOf(leg)) ?? []).map((line) => (
                  <p key={line.text} className={`mt-2 text-xs ${TONE_CLASS[line.tone]}`}>
                    {line.text}
                    <span className="ml-1 text-xs text-muted-foreground">{line.source}</span>
                  </p>
                ))}
              </div>
            </li>
          );
        })}
      </ol>
      <FareNotice />
    </>
  );
}

export type WalkHop = {
  from: { lat: number; lon: number; label: string };
  to: { lat: number; lon: number; label: string };
  meters: number;
  minutes: number;
};

/** Origin -> boarding stop (or drop-off -> door) on foot, when both points resolve. */
export function walkBetween(
  from: { lat: number; lon: number; name?: string } | null,
  to: { lat: number; lon: number; name?: string } | null,
  toLabel?: string | null,
  fromLabel?: string | null,
): WalkHop | null {
  if (!from || !to) return null;
  const meters = distanceM(from, to);
  if (meters < 40) return null;
  return {
    from: { lat: from.lat, lon: from.lon, label: titleCase(fromLabel ?? from.name ?? "Start") },
    to: { lat: to.lat, lon: to.lon, label: titleCase(toLabel ?? to.name ?? "Stop") },
    meters,
    minutes: Math.max(1, Math.round(meters / 80.47)),
  };
}

export function WalkSegment({ walk }: { walk: WalkHop }) {
  return (
    <div className="mt-2 text-xs font-semibold leading-relaxed text-foreground">
      <p className="text-sm font-bold">
        {formatDistance(walk.meters)} · {walk.minutes} min walk
      </p>
      <p className="text-muted-foreground">
        {walk.from.label} → {walk.to.label}
      </p>
      <details className="walking-map-details mt-2">
        <summary>Show walking map</summary>
        <div className="map-shell mt-2 overflow-hidden rounded-lg">
          <ClientOnly fallback={<div className="h-40 animate-pulse bg-muted" />}>
            <Suspense fallback={<div className="h-40 animate-pulse bg-muted" />}>
              <WalkingMicroMap from={walk.from} to={walk.to} />
            </Suspense>
          </ClientOnly>
        </div>
      </details>
    </div>
  );
}

export function matchLiveArrival(
  result: BusArrivalsResult | undefined,
  route: string | null,
  headsign: string | null,
  scheduledSeconds: number | null,
) {
  if (!result || result.error) return null;
  return confirmedLiveBus(result.arrivals, route, headsign, scheduledSeconds);
}

export function BusArrivalTime({
  arrival,
  scheduledSeconds,
  fetchedAt,
  refreshing,
  compact = false,
}: {
  arrival: BusArrival | null;
  scheduledSeconds: number | null;
  fetchedAt: number | undefined;
  refreshing: boolean;
  compact?: boolean;
}) {
  const stale = Boolean(fetchedAt && Date.now() - fetchedAt > 90_000);
  const updatedTime = fetchedAt
    ? new Intl.DateTimeFormat("en-US", {
        timeZone: regionTimeZone(),
        hour: "numeric",
        minute: "2-digit",
      }).format(new Date(fetchedAt))
    : null;
  if (!arrival?.isLive) {
    return (
      <div className={compact ? "shrink-0 text-right" : "mt-2"}>
        <p
          className={`${compact ? "text-base" : "text-3xl"} font-bold tabular-nums text-foreground`}
        >
          {clockFromSeconds(scheduledSeconds)}
        </p>
        <p className="text-xs text-muted-foreground">Scheduled</p>
      </div>
    );
  }
  const delayed = arrival.delayMinutes > 2;
  return (
    <div className={compact ? "shrink-0 text-right" : "mt-2"}>
      <div className="flex flex-wrap items-baseline gap-2">
        {delayed && (
          <span className="text-sm tabular-nums text-muted-foreground line-through">
            {arrival.scheduledArrivalTime}
          </span>
        )}
        <span
          className={`${compact ? "text-base" : "text-3xl"} font-bold tabular-nums ${delayed ? "text-warning" : "text-foreground"}`}
        >
          {arrival.estimatedArrivalTime}
        </span>
        {arrival.delayMinutes > 5 && (
          <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-xs font-bold text-destructive">
            Delayed
          </span>
        )}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        {stale || refreshing
          ? "Refreshing"
          : `Live · ${updatedTime ?? `${arrival.minutesAway} min away`}`}
      </p>
    </div>
  );
}
