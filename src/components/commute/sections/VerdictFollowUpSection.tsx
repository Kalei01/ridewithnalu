import { ShareButton } from "@/components/ShareButton";
import { shareText, shareUrl } from "@/lib/share-trip";
import { NaluPersonalityStrip } from "@/components/commute/NaluPersonalityStrip";
import { honoluluParts } from "@/lib/commute-formatting";
import { hdotRoadName } from "@/lib/hdot-road-names";
import { activeRegion } from "@/lib/region";
import { RemindMeButton, alertKeyFor } from "@/components/LeaveAlertCard";
import { clockInputValue } from "@/lib/saved-places";

export type VerdictFollowUpSectionProps = {
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
  activeSavedPlace: import("@/lib/places/saved-places").SavedPlace | null;
  arriveByTarget: number | null;
  arrivingHome: boolean;
  commitment: import("@/lib/commute-model").Commitment | null;
  configured: boolean;
  drive: NoInfer<import("@/lib/drive.functions").DriveTime> | undefined;
  driveDoorToDoorMinutes: number | null;
  driveLoading: boolean;
  driveTripEstimate: import("@/lib/decision/trip-estimate").TripEstimate;
  naluHeroTrafficLevel: "moderate" | "heavy" | "light" | "severe";
  now: Date;
  optionsLoading: boolean;
  savedPlaces: import("@/lib/places/saved-places").SavedPlace[];
  shareableDestination: { lat: number; lon: number; name: string } | null;
  transitLabel: "Skyline" | "Bus" | "Transit";
  transitTripEstimate: import("@/lib/decision/trip-estimate").TripEstimate;
  tripArrivalLabel: string;
  tripDirection: import("@/lib/trip-direction").ResolvedTripDirection;
  verdict: import("@/lib/commute-model").UiDecisionState;
  weather: NoInfer<import("@/lib/weather.functions").WeatherResult> | undefined;
};

export function VerdictFollowUpSection(props: VerdictFollowUpSectionProps) {
  const {
    activeDecision,
    activeSavedPlace,
    arriveByTarget,
    arrivingHome,
    commitment,
    configured,
    drive,
    driveDoorToDoorMinutes,
    driveLoading,
    driveTripEstimate,
    naluHeroTrafficLevel,
    now,
    optionsLoading,
    savedPlaces,
    shareableDestination,
    transitLabel,
    transitTripEstimate,
    tripArrivalLabel,
    tripDirection,
    verdict,
    weather,
  } = props;
  return (
    <>
      {configured &&
        !commitment &&
        !optionsLoading &&
        !driveLoading &&
        (verdict === "drive" || verdict === "transit" || verdict === "same") && (
          <div className="mt-3 flex justify-center">
            <ShareButton
              label="Share this answer"
              text={shareText({
                verdict,
                transitLabel,
                destination: tripArrivalLabel,
                minutesFaster: activeDecision.differenceMinutes ?? null,
                leaveSeconds:
                  verdict === "drive" ? driveTripEstimate.leaveTime : transitTripEstimate.leaveTime,
                arriveSeconds:
                  verdict === "drive"
                    ? driveTripEstimate.arrivalTime
                    : transitTripEstimate.arrivalTime,
              })}
              url={shareUrl(shareableDestination)}
            />
          </div>
        )}

      {/* Nalu's one-line take sits right under the answer it explains. */}
      <NaluPersonalityStrip
        loading={optionsLoading || driveLoading}
        configured={configured}
        period={honoluluParts(now).hour >= 15 ? "evening" : "morning"}
        decision={verdict}
        trafficLevel={naluHeroTrafficLevel}
        driveMinutes={driveDoorToDoorMinutes}
        transitMinutes={transitTripEstimate.expectedDurationMinutes}
        timeDelta={activeDecision.differenceMinutes ?? null}
        incidents={drive?.incidents ?? []}
        // HDOT route segments only say which roads the trip crosses; they are
        // not closures. Scheduled closures carry a text schedule, so they are
        // passed without an "active" flag and described as scheduled.
        activeRoadwork={(drive?.hdotScheduledClosures ?? []).map((closure) => ({
          route: hdotRoadName(closure.route).name,
          description: closure.location,
        }))}
        weather={weather?.moments ?? []}
        transferMinutes={transitTripEstimate.transferMinutes}
        waitMinutes={transitTripEstimate.waitMinutes}
        walkMinutes={transitTripEstimate.walkingMinutes}
      />

      {/* Leave alerts run on Oʻahu time and Oʻahu places only. */}
      {!commitment &&
        activeRegion().hasTransit &&
        tripDirection.from.lat !== null &&
        tripDirection.from.lon !== null &&
        tripDirection.to.lat !== null &&
        tripDirection.to.lon !== null && (
          <RemindMeButton
            trip={{
              placeKey: alertKeyFor(
                savedPlaces,
                { lat: tripDirection.to.lat, lon: tripDirection.to.lon },
                arrivingHome,
                { lat: tripDirection.from.lat, lon: tripDirection.from.lon },
              ),
              label: tripArrivalLabel,
              toHome: arrivingHome,
              from: { lat: tripDirection.from.lat, lon: tripDirection.from.lon },
              to: { lat: tripDirection.to.lat, lon: tripDirection.to.lon },
            }}
            defaultTime={
              arriveByTarget !== null
                ? clockInputValue(arriveByTarget)
                : arrivingHome
                  ? "17:30"
                  : clockInputValue(activeSavedPlace?.typicalArrivalSeconds ?? 8 * 3600)
            }
          />
        )}
    </>
  );
}
