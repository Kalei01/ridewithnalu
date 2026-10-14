import { clockFromSeconds, formatDistance } from "@/lib/commute-formatting";
import { ShareButton } from "@/components/ShareButton";
import { etaUrl, etaText } from "@/lib/share-trip";
import { HoldToEndButton } from "@/components/commute/TripControls";
import { Button } from "@/components/ui/button";
import { funnelStep } from "@/lib/funnel";
import { toast } from "sonner";
import { primeChimeAudio } from "@/lib/approach";
import {
  speakCommuteAlert,
  primeSpeech,
  requestCommuteNotificationPermission,
} from "@/lib/commute-alerts";
import { startRoutePhrase, distanceAlongPath } from "@/lib/navigation-voice";
import { Navigation, TrainFront, Bus, Footprints, Radio } from "lucide-react";

export type TripCommitmentSectionProps = {
  best: import("@/lib/commute-model").Option | undefined;
  commitment: import("@/lib/commute-model").Commitment | null;
  commitMode: (next: "transit" | "drive") => void;
  configured: boolean;
  drive: NoInfer<import("@/lib/drive.functions").DriveTime> | undefined;
  driveAvailable: boolean;
  driveTripEstimate: import("@/lib/decision/trip-estimate").TripEstimate;
  endTrip: () => void;
  gate: {
    tier: import("@/lib/tiers").Tier;
    allows: (feature: import("@/lib/tiers").Feature) => boolean;
    require(feature: import("@/lib/tiers").Feature): boolean;
    tripCheck(): boolean;
  };
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
  selectedMode: "transit" | "drive";
  setAlertPrefs: React.Dispatch<React.SetStateAction<import("@/lib/approach").AlertPrefs>>;
  setNavMuted: React.Dispatch<React.SetStateAction<boolean>>;
  transitLabel: "Skyline" | "Bus" | "Transit";
  transitTripEstimate: import("@/lib/decision/trip-estimate").TripEstimate;
  transitUsesBus: boolean;
  transitUsesRail: boolean;
  tripArrivalLabel: string;
  tripDirection: import("@/lib/trip-direction").ResolvedTripDirection;
};

export function TripCommitmentSection(props: TripCommitmentSectionProps) {
  const {
    best,
    commitment,
    commitMode,
    configured,
    drive,
    driveAvailable,
    driveTripEstimate,
    endTrip,
    gate,
    liveDrive,
    liveEta,
    lockedMode,
    selectedMode,
    setAlertPrefs,
    setNavMuted,
    transitLabel,
    transitTripEstimate,
    transitUsesBus,
    transitUsesRail,
    tripArrivalLabel,
    tripDirection,
  } = props;
  return (
    <>
      {/* Keep the trip commitment action directly beneath the verdict so it
            remains visible before route and comparison details. */}
      {configured && (
        <section
          className={`commitment-panel -mx-2 mt-3 rounded-2xl p-3 ${commitment ? "is-live" : ""}`}
          aria-label={commitment ? "Active trip controls" : "Start trip"}
        >
          {commitment ? (
            <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
              <div className="flex min-w-0 items-center gap-3 text-center sm:text-left">
                <span className="live-pulse" aria-hidden="true">
                  <span />
                </span>
                <div>
                  <p className="text-sm font-black uppercase text-foreground">
                    Live navigation active
                  </p>
                  {liveEta ? (
                    <p
                      className="mt-0.5 text-sm font-bold tabular-nums text-foreground"
                      aria-live="polite"
                    >
                      Arrive {clockFromSeconds(liveEta.arriveSeconds)} · {liveEta.remainingMin} min
                      left
                      {liveEta.meters ? ` · ${formatDistance(liveEta.meters)}` : ""}
                      {liveEta.range ? (
                        <span className="block text-xs font-semibold text-muted-foreground">
                          Total trip {liveEta.range}
                        </span>
                      ) : null}
                    </p>
                  ) : null}
                  <p className="mt-0.5 text-xs font-semibold text-muted-foreground">
                    {lockedMode === "drive"
                      ? liveEta?.live
                        ? "Live from your GPS position · traffic every minute"
                        : "Waiting for GPS…"
                      : "Stops & alerts locked"}
                  </p>
                </div>
              </div>
              <ShareButton
                label="Share my ETA"
                className="w-full shrink-0 sm:w-auto"
                url={etaUrl()}
                text={etaText(
                  tripArrivalLabel,
                  lockedMode === "drive" ? "drive" : transitLabel,
                  liveEta?.arriveSeconds ??
                    (lockedMode === "drive"
                      ? driveTripEstimate.arrivalTime
                      : transitTripEstimate.arrivalTime),
                )}
              />
              <HoldToEndButton
                onEnd={endTrip}
                label="End Trip"
                className="h-12 w-full shrink-0 px-6 sm:w-auto"
              />
            </div>
          ) : (
            <Button
              type="button"
              disabled={selectedMode === "transit" ? !best : !driveAvailable || !drive}
              onClick={() => {
                // Starting a trip means "tell me everything": unlock chime and speech
                // inside this tap (iOS Safari), unmute voice and turn every alert on.
                // Turn-by-turn voice is part of Plus; without it, hand the drive
                // to the phone's own Maps app (Nalu doesn't compete with Maps).
                if (selectedMode === "drive" && !gate.allows("turn_by_turn")) {
                  const to = tripDirection.to;
                  if (to.lat !== null && to.lon !== null) {
                    const ios = /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent);
                    funnelStep("maps_opened");
                    window.location.href = ios
                      ? `https://maps.apple.com/?daddr=${to.lat},${to.lon}&dirflg=d`
                      : `https://www.google.com/maps/dir/?api=1&destination=${to.lat},${to.lon}&travelmode=driving`;
                    toast("Opening Maps. Voice directions in Nalu come with Plus.");
                  }
                  return;
                }
                primeChimeAudio();
                // Say where we're going and the first direction inside this
                // tap: iPhones only let a web app start talking during a tap,
                // and it shouldn't wait for a GPS fix.
                const route = selectedMode === "drive" ? (liveDrive ?? drive) : null;
                if (route) {
                  const first = route.maneuvers?.[0];
                  speakCommuteAlert(
                    startRoutePhrase(
                      tripArrivalLabel,
                      first
                        ? {
                            maneuver: first,
                            distanceM: distanceAlongPath(route.path ?? [], first),
                          }
                        : null,
                    ),
                    "maneuver",
                    { immediate: true },
                  );
                } else primeSpeech();
                requestCommuteNotificationPermission();
                setNavMuted(false);
                setAlertPrefs((prev) => ({
                  ...prev,
                  sound: true,
                  haptics: true,
                  keepOnTransfer: true,
                }));
                commitMode(selectedMode);
              }}
              className="commitment-start h-auto min-h-16 w-full gap-3 px-5 py-4 text-left"
            >
              {selectedMode === "drive" ? (
                <Navigation className="size-6 shrink-0" />
              ) : transitUsesRail ? (
                <TrainFront className="size-6 shrink-0" />
              ) : transitUsesBus ? (
                <Bus className="size-6 shrink-0" />
              ) : (
                <Footprints className="size-6 shrink-0" />
              )}
              <span className="min-w-0 flex-1 text-center">
                <span className="block text-base font-black uppercase">
                  Start {selectedMode === "drive" ? "Drive" : transitLabel}
                </span>
                <span className="mt-0.5 block text-xs font-black uppercase text-primary-foreground/75">
                  {selectedMode === "drive" ? "Live navigation & traffic" : "Live stops & alerts"}
                </span>
              </span>
              <Radio className="size-5 shrink-0" />
            </Button>
          )}
        </section>
      )}
    </>
  );
}
