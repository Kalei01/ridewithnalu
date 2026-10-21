import { TransitItinerary } from "@/components/commute/TransitItinerary";
import { driveSourceNote } from "@/lib/drive/provider-note";
import { RailTripBreakdown } from "@/components/commute/RailTripBreakdown";
import { DriveDetails } from "@/components/commute/DriveDetails";
import { RouteCorridor } from "@/components/commute/RouteCorridor";
import { HdotRoadworkNotice } from "@/components/commute/HdotRoadworkNotice";
import { trafficDelayText, incidentImpactText } from "@/lib/traffic-incidents";
import { TONE_CLASS } from "@/components/commute/H1ConditionsCard";
import { AlternativeDepartures } from "@/components/commute/AlternativeDepartures";
import {
  alternativeOptions,
  optionIdentity,
  moreTransfersLabel,
  vehicleName,
} from "@/lib/commute-model";
import { Button } from "@/components/ui/button";
import { clockFromSeconds } from "@/lib/commute-formatting";
import { ArrowRight, TrainFront, Bus } from "lucide-react";
import { formatDriveMinutes } from "@/lib/drive/traffic-summary";

export type ModeDetailsSectionProps = {
  arrivingHome: boolean;
  best: import("@/lib/commute-model").Option | undefined;
  commuteMapPoints: {
    id: string;
    name: string;
    lat: number;
    lon: number;
    kind: "bus" | "rail" | "start" | "end";
  }[];
  drive: NoInfer<import("@/lib/drive.functions").DriveTime> | undefined;
  driveAvailable: boolean;
  driveBasisLabel: string;
  driveDoorToDoorMinutes: number | null;
  driveFailed: boolean;
  driveLoading: boolean;
  driveRange: { low: number; high: number } | null;
  driveTripEstimate: import("@/lib/decision/trip-estimate").TripEstimate;
  driveWeatherLines: import("@/components/commute/H1ConditionsCard").WeatherLine[];
  focusedLeg: { index: number; token: number } | null;
  incidentDecides: boolean;
  itineraryRange: { low: number; high: number } | null;
  liveBus: NoInfer<import("@/lib/bus-arrivals.functions").BusArrivalsResult> | undefined;
  liveBusRefreshing: boolean;
  options: import("@/lib/commute-model").Option[];
  optionsLoading: boolean;
  selectedMode: "transit" | "drive";
  setSelectedDeparture: React.Dispatch<React.SetStateAction<string | null>>;
  showLegOnMap: (index: number) => void;
  transitDiagnostic: string | undefined;
  transitLabel: "Skyline" | "Bus" | "Transit";
  tripArrivalLabel: string;
  tripOriginLabel: string;
  verdict: import("@/lib/commute-model").UiDecisionState;
  weatherLines: Map<number, import("@/components/commute/H1ConditionsCard").WeatherLine[]>;
};

export function ModeDetailsSection(props: ModeDetailsSectionProps) {
  const {
    arrivingHome,
    best,
    commuteMapPoints,
    drive,
    driveAvailable,
    driveBasisLabel,
    driveDoorToDoorMinutes,
    driveFailed,
    driveLoading,
    driveRange,
    driveTripEstimate,
    driveWeatherLines,
    focusedLeg,
    incidentDecides,
    itineraryRange,
    liveBus,
    liveBusRefreshing,
    options,
    optionsLoading,
    selectedMode,
    setSelectedDeparture,
    showLegOnMap,
    transitDiagnostic,
    transitLabel,
    tripArrivalLabel,
    tripOriginLabel,
    verdict,
    weatherLines,
  } = props;
  return (
    <>
      <section className="ease-in-view py-6" aria-labelledby="mode-details-title">
        <h2 id="mode-details-title" className="sr-only">
          Trip details
        </h2>
        {selectedMode === "transit" && (
          <TransitItinerary
            transitLabel={transitLabel}
            itineraryRange={itineraryRange}
            content={
              best ? (
                <RailTripBreakdown
                  option={best}
                  inbound={arrivingHome}
                  liveBus={liveBus}
                  liveBusRefreshing={liveBusRefreshing}
                  weatherLines={weatherLines}
                  points={commuteMapPoints}
                  activeLeg={focusedLeg?.index ?? null}
                  onSelectLeg={showLegOnMap}
                />
              ) : null
            }
            emptyMessage={
              optionsLoading
                ? "Building your trip…"
                : transitDiagnostic === "NO_ACTIVE_SERVICE"
                  ? "No active transit service is loaded for today."
                  : transitDiagnostic === "NO_ORIGIN_STOPS"
                    ? "Nalu can't find transit stops close enough to your start."
                    : transitDiagnostic === "NO_DESTINATION_STOPS"
                      ? "Nalu can't find transit stops close enough to your destination."
                      : transitDiagnostic === "NO_REACHABLE_DEPARTURES"
                        ? "Transit stops are present, but Nalu isn't seeing a reachable departure right now."
                        : transitDiagnostic === "NO_VALID_ITINERARY"
                          ? "Transit service is present, but Nalu couldn't build a complete trip yet."
                          : "Transit trip data isn't available right now."
            }
          />
        )}

        {selectedMode === "drive" && (
          <DriveDetails
            tripOriginLabel={tripOriginLabel}
            tripArrivalLabel={tripArrivalLabel}
            driveMinutes={driveTripEstimate.expectedDurationMinutes}
            driveLoading={driveLoading}
            driveAvailable={driveAvailable}
            content={
              <>
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <h3 className="text-xl font-bold text-foreground">Drive details</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {tripOriginLabel} to {tripArrivalLabel}
                    </p>
                  </div>
                  <p className="text-4xl font-bold tabular-nums text-foreground">
                    {driveAvailable
                      ? driveDoorToDoorMinutes !== null
                        ? Math.round(driveDoorToDoorMinutes)
                        : driveLoading
                          ? "…"
                          : "—"
                      : "—"}
                    <span className="ml-1 text-base">min</span>
                  </p>
                </div>
                {driveAvailable && driveDoorToDoorMinutes !== null && (
                  <p className="mt-2 text-sm text-muted-foreground">
                    Live driving time (parking not included)
                  </p>
                )}
                {verdict !== "drive" &&
                  (drive?.corridorLabel ? (
                    <RouteCorridor label={drive.corridorLabel} size="compact" />
                  ) : (
                    <p className="mt-4 text-sm font-medium text-foreground">
                      Drive straight from {tripOriginLabel} to {tripArrivalLabel} — no stop at a
                      rail station.
                    </p>
                  ))}
                {driveAvailable && driveRange && drive && (
                  <p className="mt-3 text-xs text-muted-foreground">{driveBasisLabel}</p>
                )}
                {driveAvailable && driveSourceNote(drive) && (
                  <p className="mt-2 text-xs text-muted-foreground">{driveSourceNote(drive)}</p>
                )}
                {(drive?.hdotScheduledClosures?.length ?? 0) > 0 && (
                  <HdotRoadworkNotice
                    scheduledClosures={drive?.hdotScheduledClosures ?? []}
                    variant="commute"
                    liveDriveMinutes={drive?.trafficMinutes ?? null}
                    delayMinutes={drive?.delayMinutes ?? null}
                  />
                )}
                {driveAvailable && driveFailed && (
                  <p className="mt-4 text-sm text-muted-foreground">
                    Live traffic is not available right now.
                  </p>
                )}
                {driveAvailable &&
                  drive?.incidents[0] &&
                  verdict !== "drive" &&
                  !incidentDecides && (
                    <div className="mt-4 border-l-2 border-warning pl-3">
                      <p className="text-base font-bold text-foreground">
                        {trafficDelayText(drive.incidents[0], drive.delayMinutes)}
                      </p>
                      <p className="mt-1 text-xs font-medium text-muted-foreground">
                        {incidentImpactText(drive.incidents[0])}
                      </p>
                    </div>
                  )}
                {driveWeatherLines.map((line) => (
                  <p key={line.text} className={`mt-3 text-sm ${TONE_CLASS[line.tone]}`}>
                    {line.text}
                    <span className="ml-1 text-xs text-muted-foreground">{line.source}</span>
                  </p>
                ))}
              </>
            }
          />
        )}

        {selectedMode === "transit" && options.length > 1 && (
          <AlternativeDepartures>
            <ol className="mt-5 grid min-w-0 max-w-full gap-3">
              {alternativeOptions(options, best).map((option, index) => {
                const arrivalDifference = best
                  ? Math.round((option.arrive_seconds - best.arrive_seconds) / 60)
                  : 0;
                const departureDifference = best
                  ? Math.round((option.leave_by_seconds - best.leave_by_seconds) / 60)
                  : 0;
                const primaryTransitLeg = option.legs.find(
                  (leg) => leg.mode === "bus" || leg.mode === "rail",
                );
                const isRailDeparture = primaryTransitLeg?.mode === "rail";
                return (
                  <li key={optionIdentity(option)} className="min-w-0 max-w-full">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setSelectedDeparture(optionIdentity(option))}
                      aria-label={`Leave at ${clockFromSeconds(option.leave_by_seconds)} and arrive at ${clockFromSeconds(option.arrive_seconds)}`}
                      className="alternative-option group h-auto min-w-0 max-w-full overflow-hidden whitespace-normal rounded-lg p-4 text-left transition-all active:scale-[0.99]"
                    >
                      <span className="block min-w-0 w-full overflow-hidden">
                        <span className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
                          <span className="min-w-0">
                            <span className="block text-xs font-bold uppercase text-muted-foreground">
                              Option {String.fromCharCode(65 + index)}
                            </span>
                            <span className="mt-1 grid grid-cols-[auto_auto_auto] items-center justify-start gap-2 text-xl font-bold tabular-nums text-foreground">
                              <span>{clockFromSeconds(option.leave_by_seconds)}</span>
                              <ArrowRight className="size-4 shrink-0 text-recommended transition-transform group-hover:translate-x-0.5" />
                              <span>{clockFromSeconds(option.arrive_seconds)}</span>
                            </span>
                          </span>
                          <span className="w-fit max-w-full rounded-full border border-border bg-muted/70 px-2.5 py-1 text-left text-xs font-bold leading-snug tabular-nums text-muted-foreground sm:text-right">
                            {arrivalDifference > 0
                              ? `Arrives ${arrivalDifference} min later than current`
                              : arrivalDifference < 0
                                ? `Arrives ${Math.abs(arrivalDifference)} min earlier than current`
                                : "Same arrival as current"}
                            {option.extraTransfers && best
                              ? ` · ${moreTransfersLabel(option, best)}`
                              : ""}
                          </span>
                        </span>
                        <span className="mt-4 grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-3 border-t border-border/70 pt-3 text-sm">
                          <span className="min-w-0">
                            <span className="block text-xs font-semibold uppercase text-muted-foreground">
                              Compared to current
                            </span>
                            <span className="mt-1 block break-words font-semibold tabular-nums text-foreground">
                              {departureDifference > 0
                                ? `Leaves ${departureDifference} min later`
                                : departureDifference < 0
                                  ? `Leaves ${Math.abs(departureDifference)} min earlier`
                                  : "Same departure time"}
                            </span>
                          </span>
                          <span className="shrink-0">
                            <span className="block text-xs font-semibold uppercase text-muted-foreground">
                              Total trip
                            </span>
                            <span className="mt-1 block text-lg font-bold tabular-nums text-foreground">
                              {formatDriveMinutes(option.total_minutes)}
                            </span>
                          </span>
                        </span>
                        {primaryTransitLeg && (
                          <span className="mt-3 flex min-w-0 max-w-full items-center gap-2 overflow-hidden rounded-md bg-recommended/5 px-3 py-2 text-xs text-muted-foreground">
                            {isRailDeparture ? (
                              <TrainFront
                                className="size-4 shrink-0 text-recommended"
                                aria-hidden="true"
                              />
                            ) : (
                              <Bus
                                className="size-4 shrink-0 text-recommended"
                                aria-hidden="true"
                              />
                            )}
                            <span className="shrink-0 font-bold text-foreground">
                              {option.legs.some((leg) => leg.mode === "drive")
                                ? "Skyline"
                                : isRailDeparture
                                  ? "Rail"
                                  : "Bus"}
                            </span>
                            <span className="truncate">{vehicleName(primaryTransitLeg)}</span>
                          </span>
                        )}
                      </span>
                    </Button>
                  </li>
                );
              })}
            </ol>
          </AlternativeDepartures>
        )}
      </section>
    </>
  );
}
