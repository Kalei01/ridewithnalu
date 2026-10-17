import { lazy } from "react";
import { NavShell } from "@/components/commute/LiveTripControls";
import { NavBottomCard } from "@/components/commute/TripControls";
import { currentLegIndex } from "@/lib/live-trip-steps";
import { ClientOnly } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Suspense } from "react";
import { turnGlyph } from "@/lib/navigation-voice";
import { hudRoadLabel } from "@/lib/local-directions";
import { formatDistance, clockFromSeconds } from "@/lib/commute-formatting";

const CommuteRouteMap = lazy(() => import("@/components/commute/CommuteRouteMap"));
const LiveNavMap = lazy(() => import("@/components/commute/LiveNavMap"));

export type TransitMapSegment = {
  id: string;
  mode: "walk" | "drive" | "bus" | "rail";
  points: Array<{ lat: number; lon: number }>;
};

export type MapSectionProps = {
  best: import("@/lib/commute-model").Option | undefined;
  commitment: import("@/lib/commute-model").Commitment | null;
  confirmedBusArrival: import("@/lib/bus-arrivals.functions").BusArrival | null;
  corridorLandmarks: { id: string; lat: number; lon: number; label: string }[];
  drive: NoInfer<import("@/lib/drive.functions").DriveTime> | undefined;
  driveMapPath: { lat: number; lon: number }[] | undefined;
  driveTo: { lat: number | null; lon: number | null };
  driveTrafficSections: import("@/lib/drive.functions").DriveTrafficSection[] | undefined;
  drivingCommitted: boolean;
  endTrip: () => void;
  focusedLeg: { index: number; token: number } | null;
  focusLegPoints: { lat: number; lon: number }[] | null;
  handleRouteStateChange: (state: {
    offRoute: boolean;
    crossTrackM: number;
    headingDivergence: number | null;
  }) => void;
  headingUpNav: boolean;
  liveDrive:
    | (NoInfer<{
        seq: number;
        trafficMinutes: number;
        typicalMinutes: number;
        delayMinutes: number;
        lowMinutes: number;
        highMinutes: number;
        meters: number;
        path: { lat: number; lon: number }[];
        trafficSections: import("@/lib/drive.functions").DriveTrafficSection[];
        incidents: import("@/lib/drive.functions").DriveIncident[];
        hdotLaneClosures?: import("@/lib/hdot-lane-closures.functions").HdotLaneClosureRoute[];
        hdotScheduledClosures?: import("@/lib/hdot-lane-closures.functions").HdotScheduledClosure[];
        corridorLabel: string | null;
        corridorRoads: string[];
        bypassedRoads: string[];
        maneuvers: {
          lat: number;
          lon: number;
          maneuver: string;
          instruction: string;
          road: string | null;
        }[];
        fetchedAt: number;
        trafficBasis: "live" | "future-estimate";
      }> &
        object)
    | null;
  liveEta: {
    remainingMin: number;
    arriveSeconds: number;
    meters: number | null;
    live: boolean;
    range: string | null;
  } | null;
  lockedMode: "transit" | "drive" | null;
  mapPoints: {
    id: string;
    name: string;
    lat: number;
    lon: number;
    kind: "bus" | "rail" | "start" | "end";
  }[];
  navBasis: NoInfer<import("@/lib/drive.functions").DriveTime> | null | undefined;
  navBearing: number | null;
  navMuted: boolean;
  navPath: { lat: number; lon: number }[];
  nextTurn: { maneuver: import("@/lib/navigation-voice").Maneuver; distanceM: number } | null;
  incidentNotice?: { text: string; label: string } | null;
  nowSeconds: number;
  openSettingsAt: (page: import("@/components/settings/SetupDialog").SettingsPageId) => void;
  rerouting: boolean;
  rescue: { headline: string; spoken: string } | null;
  riderHeading: number | null;
  riderPoint: import("@/lib/commute-model").Coords | null;
  riderSpeed: number | null;
  selectedMode: "transit" | "drive";
  setNavMuted: React.Dispatch<React.SetStateAction<boolean>>;
  setRescue: React.Dispatch<React.SetStateAction<{ headline: string; spoken: string } | null>>;
  transitMapSegments: TransitMapSegment[];
  transitSteps: string[];
  tripArrivalLabel: string;
  tripOriginLabel: string;
};

export function MapSection(props: MapSectionProps) {
  const {
    best,
    commitment,
    confirmedBusArrival,
    corridorLandmarks,
    drive,
    driveMapPath,
    driveTo,
    driveTrafficSections,
    drivingCommitted,
    endTrip,
    focusedLeg,
    focusLegPoints,
    handleRouteStateChange,
    headingUpNav,
    liveDrive,
    liveEta,
    lockedMode,
    mapPoints,
    navBasis,
    navBearing,
    navMuted,
    navPath,
    nextTurn,
    incidentNotice,
    nowSeconds,
    openSettingsAt,
    rerouting,
    rescue,
    riderHeading,
    riderPoint,
    riderSpeed,
    selectedMode,
    setNavMuted,
    setRescue,
    transitMapSegments,
    transitSteps,
    tripArrivalLabel,
    tripOriginLabel,
  } = props;
  return (
    <>
      {mapPoints.length >= 2 && (selectedMode === "drive" || Boolean(best)) && (
        <section
          className="ease-in-view map-shell mt-3 overflow-hidden rounded-xl"
          aria-labelledby="trip-map-title"
        >
          <div className="flex items-start justify-between gap-3 px-4 py-3.5">
            <div className="min-w-0">
              <h2
                id="trip-map-title"
                className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground"
              >
                Your route
              </h2>
              <p className="mt-1 text-base font-semibold leading-snug text-foreground">
                {tripOriginLabel} to {tripArrivalLabel}
              </p>
            </div>
            <span className="mt-0.5 shrink-0 whitespace-nowrap rounded-full border border-white/12 bg-white/[0.05] px-2.5 py-1 text-xs font-semibold text-foreground">
              {selectedMode === "drive" ? "Direct drive" : `${transitMapSegments.length} trip legs`}
            </span>
          </div>
          <NavShell
            fullscreen={headingUpNav}
            overlay={
              <NavBottomCard
                mode={lockedMode === "drive" ? "drive" : "transit"}
                delayMinutes={lockedMode === "drive" ? (navBasis?.delayMinutes ?? null) : null}
                steps={
                  lockedMode === "drive"
                    ? (navBasis?.maneuvers ?? []).map((m) => m.instruction).filter(Boolean)
                    : transitSteps
                }
                nextStep={
                  lockedMode === "drive" || !best
                    ? null
                    : (transitSteps[currentLegIndex(best.legs, nowSeconds)] ?? null)
                }
                onEnd={endTrip}
              />
            }
          >
            <ClientOnly
              fallback={
                <div
                  className="h-full w-full animate-pulse bg-muted"
                  aria-label="Loading trip map"
                />
              }
            >
              {rescue && drivingCommitted && (
                <div
                  role="alert"
                  className="fixed inset-x-3 top-24 z-[1200] rounded-lg border border-warning/60 bg-background/95 p-3 shadow-lg backdrop-blur-md"
                >
                  <p className="text-sm font-semibold text-foreground">{rescue.headline}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{rescue.spoken}</p>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="mt-1 h-7 px-2"
                    onClick={() => setRescue(null)}
                  >
                    Dismiss
                  </Button>
                </div>
              )}
              <Suspense
                fallback={
                  <div
                    className="h-full w-full animate-pulse bg-muted"
                    aria-label="Loading trip map"
                  />
                }
              >
                {headingUpNav ? (
                  <LiveNavMap
                    speedMps={riderSpeed}
                    recenterBottom={176}
                    lines={
                      lockedMode === "drive"
                        ? [
                            {
                              id: "drive",
                              mode: "drive",
                              points: navPath.length > 1 ? navPath : (driveMapPath ?? []),
                            },
                          ]
                        : (transitMapSegments as Array<{
                            id: string;
                            mode: "walk" | "drive" | "bus" | "rail";
                            points: Array<{ lat: number; lon: number }>;
                          }>)
                    }
                    destination={
                      driveTo.lat !== null && driveTo.lon !== null
                        ? { lat: driveTo.lat, lon: driveTo.lon }
                        : null
                    }
                    livePoint={riderPoint}
                    bearing={navBearing}
                    incidentNotice={incidentNotice ?? null}
                    maneuver={
                      nextTurn
                        ? {
                            glyph: turnGlyph(nextTurn.maneuver.maneuver),
                            distanceText: formatDistance(nextTurn.distanceM),
                            ...hudRoadLabel(nextTurn.maneuver),
                          }
                        : null
                    }
                    eta={
                      liveEta
                        ? {
                            arrive: clockFromSeconds(liveEta.arriveSeconds),
                            range: liveEta.range,
                            minutes: liveEta.remainingMin,
                            distance: liveEta.meters ? formatDistance(liveEta.meters) : null,
                          }
                        : null
                    }
                    muted={navMuted}
                    onToggleMute={() => setNavMuted((value) => !value)}
                    onChangeVoice={() => openSettingsAt("voice")}
                    rerouting={rerouting}
                    onRouteStateChange={handleRouteStateChange}
                    traffic={
                      lockedMode === "drive" ? ((liveDrive ?? drive)?.trafficSections ?? []) : []
                    }
                    turn={
                      nextTurn
                        ? {
                            lat: nextTurn.maneuver.lat,
                            lon: nextTurn.maneuver.lon,
                            distanceM: nextTurn.distanceM,
                          }
                        : null
                    }
                    landmarks={corridorLandmarks}
                  />
                ) : (
                  <CommuteRouteMap
                    points={mapPoints}
                    livePoint={riderPoint}
                    liveHeading={riderHeading}
                    busPoint={
                      selectedMode === "transit" && confirmedBusArrival?.vehicle
                        ? {
                            lat: confirmedBusArrival.vehicle.lat,
                            lon: confirmedBusArrival.vehicle.lon,
                            label: confirmedBusArrival.routeShortName || "Bus",
                          }
                        : null
                    }
                    followLive={Boolean(commitment)}
                    {...(selectedMode !== "drive" && focusLegPoints
                      ? { focusLeg: { points: focusLegPoints, token: focusedLeg?.token ?? 0 } }
                      : {})}
                    {...(selectedMode !== "drive" && transitMapSegments.length > 0
                      ? { segments: transitMapSegments }
                      : {})}
                    {...(driveMapPath && driveMapPath.length > 1 ? { path: driveMapPath } : {})}
                    {...(driveTrafficSections && driveTrafficSections.length > 0
                      ? { trafficSections: driveTrafficSections }
                      : {})}
                    {...(selectedMode === "drive" && drive?.incidents?.length
                      ? { incidents: drive.incidents }
                      : {})}
                  />
                )}
              </Suspense>
            </ClientOnly>
          </NavShell>
        </section>
      )}
    </>
  );
}
