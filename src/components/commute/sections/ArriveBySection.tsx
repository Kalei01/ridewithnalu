import { ArriveByControls } from "@/components/commute/ArriveByControls";
import { clockFromSeconds } from "@/lib/commute-formatting";
import { TrainFront, Car } from "lucide-react";
import { formatDriveMinutes } from "@/lib/drive/traffic-summary";
import { CAR_UNAVAILABLE_TEXT } from "@/lib/intelligence/drive-transit-decision";

export type ArriveBySectionProps = {
  activeSavedPlace: import("@/lib/places/saved-places").SavedPlace | null;
  arriveByComparison: import("@/lib/decision/commute-decision").ArrivalDecision | null;
  arriveByInput: string;
  arriveByPassed: boolean;
  arriveByTarget: number | null;
  arrivingHome: boolean;
  chooseArriveBy: (next: string) => void;
  choosePlanMode: (next: import("@/components/commute/ArriveByControls").PlanMode) => void;
  drive: NoInfer<import("@/lib/drive.functions").DriveTime> | undefined;
  driveArrival: import("@/lib/destination-access").ArrivalRange | null;
  driveAvailable: boolean;
  driveBasisLabel: string;
  driveBufferNote: "Live driving time (parking not included)";
  driveLoading: boolean;
  drivePlan: import("@/lib/drive/planner").BoundedDrivePlan | null;
  driveWindow: string | null;
  nowSeconds: number;
  optionsFailed: boolean;
  optionsLoading: boolean;
  planMode: import("@/components/commute/ArriveByControls").PlanMode;
  railClosedForEvening: boolean;
  railNotRunningYet: boolean;
  resources: import("@/lib/trip-access").AccessResources;
  todayHours: { dow: number; first_seconds: number; last_seconds: number } | undefined;
  transitLabel: "Skyline" | "Bus" | "Transit";
  transitPick: import("@/lib/rail/planner").RailPick<import("@/lib/commute-model").Option> | null;
  tripAccess: import("@/lib/trip-access").TripAccess | null;
  tripArrivalLabel: string;
};

export function ArriveBySection(props: ArriveBySectionProps) {
  const {
    activeSavedPlace,
    arriveByComparison,
    arriveByInput,
    arriveByPassed,
    arriveByTarget,
    arrivingHome,
    chooseArriveBy,
    choosePlanMode,
    drive,
    driveArrival,
    driveAvailable,
    driveBasisLabel,
    driveBufferNote,
    driveLoading,
    drivePlan,
    driveWindow,
    nowSeconds,
    optionsFailed,
    optionsLoading,
    planMode,
    railClosedForEvening,
    railNotRunningYet,
    resources,
    todayHours,
    transitLabel,
    transitPick,
    tripAccess,
    tripArrivalLabel,
  } = props;
  return (
    <>
      <ArriveByControls
        mode={planMode}
        time={arriveByInput}
        destination={tripArrivalLabel}
        onModeChange={choosePlanMode}
        onTimeChange={chooseArriveBy}
      >
        {arriveByPassed && (
          <div
            role="alert"
            className="mt-3 rounded-lg border border-warning/50 bg-warning/10 px-3 py-2.5"
          >
            <p className="text-sm font-bold text-warning">
              That arrival time has already passed today.
            </p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Here are the earliest times still possible if you leave now.
            </p>
          </div>
        )}
        {activeSavedPlace?.typicalArrivalSeconds !== null &&
          activeSavedPlace?.typicalArrivalSeconds !== undefined &&
          !arrivingHome && (
            <p className="mt-2 text-xs text-muted-foreground">
              Your usual time at {activeSavedPlace.label}:{" "}
              {clockFromSeconds(activeSavedPlace.typicalArrivalSeconds)}
            </p>
          )}

        {arriveByTarget === null ? (
          <p className="mt-4 text-sm text-muted-foreground">
            Pick the time you need to be there and Nalu works backwards.
          </p>
        ) : (
          <div className="mt-4 grid gap-3">
            <div className="rounded-lg border border-border bg-background/50 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="flex items-center gap-2 text-sm font-bold text-foreground">
                  <TrainFront className="size-4 text-primary" /> Rail
                </p>
                {transitPick?.option && (
                  <p className="text-xs font-semibold text-muted-foreground">
                    {transitPick.option.total_minutes} min total
                  </p>
                )}
              </div>
              {transitPick?.option && !arriveByPassed ? (
                <p className="mt-2 text-lg font-bold tabular-nums text-foreground">
                  Leave by {clockFromSeconds(transitPick.option.leave_by_seconds)}
                  <span className="ml-2 text-sm font-medium text-muted-foreground">
                    · arrive {clockFromSeconds(transitPick.option.arrive_seconds)}
                  </span>
                </p>
              ) : railClosedForEvening ? (
                <p className="mt-2 text-sm text-warning">
                  Rail is closed for the evening. Today's service ended at{" "}
                  {todayHours
                    ? clockFromSeconds(todayHours.last_seconds)
                    : "the scheduled end time"}
                  .
                </p>
              ) : railNotRunningYet ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  Rail is not running yet. Today's service starts at{" "}
                  {todayHours
                    ? clockFromSeconds(todayHours.first_seconds)
                    : "the scheduled start time"}
                  .
                </p>
              ) : optionsLoading ? (
                <p className="mt-2 text-sm text-muted-foreground">Checking the timetable…</p>
              ) : optionsFailed ? (
                <p className="mt-2 text-sm text-warning">
                  Rail information is not available right now.
                </p>
              ) : transitPick?.earliestOption ? (
                <p className="mt-2 text-sm text-warning">
                  {arriveByPassed
                    ? "Earliest option: "
                    : `Rail can't get you there by ${clockFromSeconds(arriveByTarget)}. Earliest option: `}
                  leave at {clockFromSeconds(transitPick.earliestOption.leave_by_seconds)} · arrive{" "}
                  {clockFromSeconds(transitPick.earliestOption.arrive_seconds)}.
                </p>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">
                  {todayHours
                    ? nowSeconds >= Number(todayHours.last_seconds)
                      ? `Rail is closed for the evening. Today's service ended at ${clockFromSeconds(todayHours.last_seconds)}.`
                      : nowSeconds < Number(todayHours.first_seconds)
                        ? `Rail is not running yet. Today's service starts at ${clockFromSeconds(todayHours.first_seconds)}.`
                        : `No rail service for this trip at that time. Service runs ${clockFromSeconds(todayHours.first_seconds)} to ${clockFromSeconds(todayHours.last_seconds)} today.`
                    : "No rail service for this trip today."}
                </p>
              )}
            </div>

            {resources.vehicle && (
              <div className="rounded-lg border border-border bg-background/50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="flex items-center gap-2 text-sm font-bold text-foreground">
                    <Car className="size-4 text-primary" /> Drive
                  </p>
                  {drive && driveAvailable && (
                    <p className="text-xs font-semibold text-muted-foreground">
                      {formatDriveMinutes(drive.trafficMinutes)} driving
                    </p>
                  )}
                </div>
                {drive && driveAvailable && driveArrival && !drivePlan && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-sm font-bold tabular-nums text-foreground">
                      Arrive {driveWindow}
                    </summary>
                    <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                      <li>
                        Driving {drive.lowMinutes}–{drive.highMinutes} min, usually{" "}
                        {drive.trafficMinutes}
                      </li>
                      {driveBufferNote && <li>{driveBufferNote}</li>}
                    </ul>
                  </details>
                )}
                {drivePlan?.feasible && !arriveByPassed ? (
                  <div className="mt-2">
                    <p className="text-lg font-bold tabular-nums text-foreground">
                      Leave by {clockFromSeconds(drivePlan.leaveBySeconds)}
                      <span className="ml-2 text-sm font-medium text-muted-foreground">
                        · arrive around {clockFromSeconds(drivePlan.arriveSeconds)}
                      </span>
                    </p>
                    {!drivePlan.protected && (
                      <p className="mt-1 text-xs text-warning">Traffic could make you late.</p>
                    )}
                  </div>
                ) : drivePlan ? (
                  <p className="mt-2 text-sm text-warning">
                    {arriveByPassed
                      ? "Earliest drive option"
                      : `Too late to arrive by ${clockFromSeconds(arriveByTarget)}`}{" "}
                    · leave {clockFromSeconds(drivePlan.leaveBySeconds)} · arrive around{" "}
                    {clockFromSeconds(drivePlan.earliestArriveSeconds)}.
                  </p>
                ) : !driveAvailable ? (
                  <p className="mt-2 text-sm text-muted-foreground">
                    Driving is not available for this trip.
                  </p>
                ) : (
                  <p className="mt-2 text-sm text-muted-foreground">
                    {driveLoading
                      ? "Checking live traffic…"
                      : "Live traffic is not available right now."}
                  </p>
                )}
                {drivePlan && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Parking not included · {driveBasisLabel}
                  </p>
                )}
              </div>
            )}

            {arriveByComparison && (
              <div className="space-y-1 text-sm text-muted-foreground">
                <p className="font-semibold text-foreground">
                  {tripAccess === "bus" && arriveByComparison.primary.text === CAR_UNAVAILABLE_TEXT
                    ? "Showing trips without driving."
                    : arriveByComparison.primary.text}
                </p>
                {arriveByComparison.driveMarginMinutes !== null &&
                  arriveByComparison.driveMarginMinutes >= 0 && (
                    <p>
                      Drive: about {formatDriveMinutes(arriveByComparison.driveMarginMinutes)} to
                      spare.
                    </p>
                  )}
                {arriveByComparison.railMarginMinutes !== null &&
                  arriveByComparison.railMarginMinutes >= 0 && (
                    <p>
                      {transitLabel}: about{" "}
                      {formatDriveMinutes(arriveByComparison.railMarginMinutes)} to spare.
                    </p>
                  )}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              All times are Hawaii Standard Time (UTC−10).
            </p>
          </div>
        )}
      </ArriveByControls>
    </>
  );
}
