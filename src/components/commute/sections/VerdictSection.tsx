import { activeRegion } from "@/lib/region";
import { NightCard } from "@/components/commute/NightCard";
import { VerdictDomain } from "@/components/commute/VerdictDomain";
import { TripChoiceCards } from "@/components/commute/TripChoiceCards";
import { formatDriveMinutes } from "@/lib/drive/traffic-summary";
import { tripAccessLabel } from "@/lib/trip-access";
import { RouteCorridor } from "@/components/commute/RouteCorridor";
import { sourceFreshnessLabel } from "@/lib/commute-model";

export type VerdictSectionProps = {
  activeDecision:
    | import("@/lib/decision/commute-decision").ArrivalDecision
    | {
        state: import("@/lib/decision/commute-decision").DecisionState;
        confidence: string;
        differenceMinutes: number | null;
        primary: {
          kind: import("@/lib/intelligence/drive-transit-decision").EvidenceKind;
          text: string;
        };
        supporting: {
          kind: import("@/lib/intelligence/drive-transit-decision").EvidenceKind;
          text: string;
        } | null;
      }
    | {
        state: import("@/lib/decision/commute-decision").DecisionState;
        confidence: string;
        differenceMinutes: null;
        primary: { kind: string; text: string };
        supporting: null;
      };
  arriveByActive: boolean;
  best: import("@/lib/commute-model").Option | undefined;
  chooseTrip: (key: import("@/components/commute/TripChoiceCards").TripChoiceKey) => void;
  chooseTripAccess: (next: import("@/lib/trip-access").TripAccess | null) => void;
  commitment: import("@/lib/commute-model").Commitment | null;
  configured: boolean;
  decisionChanges: string[];
  decisionSignals: {
    label: string;
    value: string;
    detail?: string;
    tone: "neutral" | "alert" | "positive";
  }[];
  drive: NoInfer<import("@/lib/drive.functions").DriveTime> | undefined;
  driveArrival: import("@/lib/destination-access").ArrivalRange | null;
  driveBufferNote: "Live driving time (parking not included)";
  driveDoorToDoorMinutes: number | null;
  driveLoading: boolean;
  drivePlan: import("@/lib/drive/planner").BoundedDrivePlan | null;
  driveRange: { low: number; high: number } | null;
  driveTripEstimate: import("@/lib/decision/trip-estimate").TripEstimate;
  driveWindow: string | null;
  now: Date;
  nowSeconds: number;
  options: import("@/lib/commute-model").Option[];
  optionsFailed: boolean;
  optionsLoading: boolean;
  onRetry: () => void;
  pendingSteps: import("@/lib/loading-labels").CheckingStep[] | null;
  planPlaceholder: boolean;
  reasoning: string | null;
  selectedChoice: import("@/components/commute/TripChoiceCards").TripChoiceKey | null;
  transitLabel: "Skyline" | "Bus" | "Transit";
  transitRange: { low: number; high: number } | null;
  transitStandaloneAvailable: boolean;
  transitTripEstimate: import("@/lib/decision/trip-estimate").TripEstimate;
  transitWindow: string | null;
  tripAccess: import("@/lib/trip-access").TripAccess | null;
  tripArrivalLabel: string;
  tripChoices: import("@/components/commute/TripChoiceCards").TripChoice[];
  tripDirection: import("@/lib/trip-direction").ResolvedTripDirection;
  uncheckedNote: "Skyline couldn’t be checked" | "TheBus couldn’t be checked" | null;
  verdict: import("@/lib/commute-model").UiDecisionState;
  verdictConfidence: "high" | "moderate" | "low";
  whyNaluText: string;
};

export function VerdictSection(props: VerdictSectionProps) {
  const {
    activeDecision,
    arriveByActive,
    best,
    chooseTrip,
    chooseTripAccess,
    commitment,
    configured,
    decisionChanges,
    decisionSignals,
    drive,
    driveArrival,
    driveBufferNote,
    driveDoorToDoorMinutes,
    driveLoading,
    drivePlan,
    driveRange,
    driveTripEstimate,
    driveWindow,
    now,
    nowSeconds,
    options,
    optionsFailed,
    optionsLoading,
    onRetry,
    pendingSteps,
    planPlaceholder,
    reasoning,
    selectedChoice,
    transitLabel,
    transitRange,
    transitStandaloneAvailable,
    transitTripEstimate,
    transitWindow,
    tripAccess,
    tripArrivalLabel,
    tripChoices,
    tripDirection,
    uncheckedNote,
    verdict,
    verdictConfidence,
    whyNaluText,
  } = props;
  return (
    <>
      {!commitment && activeRegion().hasTransit && (
        <NightCard
          nowSeconds={nowSeconds}
          options={options}
          plannerAnswered={!optionsLoading && !optionsFailed}
          destination={
            tripDirection.to.lat !== null && tripDirection.to.lon !== null
              ? { lat: tripDirection.to.lat, lon: tripDirection.to.lon, name: tripArrivalLabel }
              : null
          }
        />
      )}

      <VerdictDomain
        configured={configured}
        commitment={Boolean(commitment)}
        verdict={verdict}
        transitStandaloneAvailable={transitStandaloneAvailable}
        transitLabel={transitLabel}
        optionsLoading={optionsLoading}
        driveLoading={driveLoading}
        confidence={verdictConfidence}
        differenceMinutes={activeDecision.differenceMinutes}
        arriveByActive={arriveByActive}
        driveMinutes={
          driveTripEstimate.doorToDoorMinutes ?? driveTripEstimate.expectedDurationMinutes
        }
        driveRange={driveRange}
        transitMinutes={transitTripEstimate.expectedDurationMinutes}
        transitRange={transitRange}
        best={best ?? null}
        transitWindow={transitWindow}
        driveAvailable={Boolean(drive && driveRange && driveArrival)}
        driveArrivalSeconds={driveTripEstimate.arrivalTime ?? driveArrival?.expectedSeconds ?? null}
        driveWindow={driveWindow}
        driveBufferNote={driveBufferNote}
        driveTotalMinutes={driveDoorToDoorMinutes}
        driveLeaveSeconds={arriveByActive && drivePlan ? drivePlan.leaveBySeconds : null}
        pendingSteps={pendingSteps}
        uncheckedNote={uncheckedNote}
        comparison={
          activeRegion().hasTransit ? (
            <TripChoiceCards
              choices={tripChoices}
              selectedKey={selectedChoice}
              commitment={Boolean(commitment)}
              formatMinutes={formatDriveMinutes}
              onSelect={chooseTrip}
              onRetry={onRetry}
              access={
                tripAccess
                  ? { label: tripAccessLabel(tripAccess), onChange: () => chooseTripAccess(null) }
                  : null
              }
            />
          ) : null
        }
      >
        <>
          {verdict === "drive" && drive && <RouteCorridor label={drive.corridorLabel} />}
          {/* No reason line until both searches finish, so a pending search never reads as "no trip". */}
          {configured &&
            !optionsLoading &&
            !driveLoading &&
            (verdict === "same" || verdict === "none" || verdict === "uncertain") && (
              <p className="mt-4 text-lg font-medium text-muted-foreground">
                {verdict === "same"
                  ? "Both options are close once arrival ranges are considered."
                  : activeDecision.primary.text}
              </p>
            )}
          {configured && (verdict === "transit" || verdict === "drive") && reasoning && (
            <p className="mt-3 text-base font-medium text-foreground">{reasoning}</p>
          )}
          {configured && !commitment && decisionSignals.length > 0 && (
            <section
              className="nalu-card-surface mt-4 overflow-hidden rounded-2xl border border-border/60 bg-background/25"
              aria-label="What Nalu is watching"
            >
              <div className="flex items-center gap-3 px-4 py-3">
                <span
                  className="size-1.5 shrink-0 animate-pulse rounded-full bg-primary"
                  aria-hidden="true"
                />
                <span className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
                  Nalu is watching
                </span>
                <span className="ml-auto text-xs font-semibold text-muted-foreground">
                  Live conditions
                </span>
              </div>
              <div className="border-t border-border/50 px-4 py-3">
                <div className="grid gap-2 sm:grid-cols-2">
                  {decisionSignals.map((signal) => (
                    <div
                      key={signal.label}
                      className="rounded-xl border border-border/50 bg-background/35 px-3 py-2.5"
                    >
                      <p className="text-xs font-semibold text-muted-foreground">{signal.label}</p>
                      <p
                        className={
                          signal.tone === "alert"
                            ? "mt-0.5 text-sm font-bold leading-5 text-warning"
                            : signal.tone === "positive"
                              ? "mt-0.5 text-sm font-bold leading-5 text-primary"
                              : "mt-0.5 text-sm font-bold leading-5 text-foreground"
                        }
                      >
                        {signal.value}
                      </p>
                      {signal.detail && (
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">
                          {signal.detail}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
                <div className="mt-3 border-t border-border/50 pt-3 text-xs text-muted-foreground">
                  <p>
                    {sourceFreshnessLabel(driveTripEstimate.source, now.getTime(), {
                      loading: driveLoading,
                    })}
                  </p>
                  {activeRegion().hasTransit && (
                    <p className="mt-1">
                      {sourceFreshnessLabel(transitTripEstimate.source, now.getTime(), {
                        loading: optionsLoading || planPlaceholder,
                      })}
                    </p>
                  )}
                </div>
              </div>
            </section>
          )}
          {configured && !commitment && decisionChanges.length > 0 && (
            <details className="mt-3 overflow-hidden rounded-2xl border border-border/60 bg-background/25 text-sm">
              <summary className="cursor-pointer list-none px-4 py-3 font-semibold text-foreground marker:hidden">
                <span className="inline-flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">↻</span>
                  What changed?
                </span>
              </summary>
              <div className="border-t border-border/50 px-4 py-4">
                <p className="text-sm font-semibold leading-6 text-foreground">
                  {decisionChanges[0]}
                </p>
                {decisionChanges.slice(1).map((change) => (
                  <p key={change} className="mt-2 text-sm leading-6 text-muted-foreground">
                    {change}
                  </p>
                ))}
                {whyNaluText && (
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{whyNaluText}</p>
                )}
                {verdict === "same" && (
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    Driving is about {formatDriveMinutes(driveDoorToDoorMinutes ?? 0)}; transit is
                    about {formatDriveMinutes(transitTripEstimate.expectedDurationMinutes ?? 0)}.
                  </p>
                )}
                {verdict === "uncertain" && (
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {activeDecision.primary.text}.
                  </p>
                )}
              </div>
            </details>
          )}
        </>
      </VerdictDomain>
    </>
  );
}
