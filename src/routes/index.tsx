import { activeRegion, regionTimeZone } from "@/lib/region";
import { hdotRoadName } from "@/lib/hdot-road-names";
import { Tagline } from "@/components/brand/Tagline";
import { useGate } from "@/hooks/use-gate";
import { SettingsHint } from "@/components/SettingsHint";
import { RideCard } from "@/components/commute/RideCard";
import { WalkCard } from "@/components/commute/WalkCard";
import { ClientOnly, createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { debugLog, endDebugSession, flushDebugLogs, startDebugSession } from "@/lib/debug-log";
import {
  ArrowRight,
  Bus,
  Car,
  ChevronDown,
  ChevronRight,
  Footprints,
  Plus,
  Navigation,
  Radio,
  RefreshCw,
  RotateCcw,
  Search,
  Settings,
  TrainFront,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { reverseGeocode } from "@/lib/geocode.functions";
import { RouteCorridor } from "@/components/commute/RouteCorridor";
import { NightCard } from "@/components/commute/NightCard";
import { CommuteHeader } from "@/components/commute/CommuteHeader";
import { CommutePageNav } from "@/components/commute/CommutePageNav";
import {
  TripChoiceCards,
  type TripChoice,
  type TripChoiceKey,
} from "@/components/commute/TripChoiceCards";
import { needsCar, parkingNote, transitChoices, tripSteps } from "@/lib/trip-choices";
import { RoadworkTile } from "@/components/commute/RoadworkTile";
import { TransitItinerary } from "@/components/commute/TransitItinerary";
import { DriveDetails } from "@/components/commute/DriveDetails";
import { AlternativeDepartures } from "@/components/commute/AlternativeDepartures";
import { DataExpiryNotice, useDataExpiry } from "@/components/commute/DataExpiry";
import { HdotRoadworkNotice } from "@/components/commute/HdotRoadworkNotice";
import { ApproachBanner, NavShell } from "@/components/commute/LiveTripControls";
import { driveTime, type DriveTime } from "@/lib/drive.functions";
import { formatDriveMinutes } from "@/lib/drive/traffic-summary";
import { busArrivals } from "@/lib/bus-arrivals.functions";
import { outdoorConditions } from "@/lib/weather.functions";
import {
  incidentImpactText,
  incidentHeadline,
  incidentDetailText,
  trafficDelayText,
} from "@/lib/traffic-incidents";
import {
  detectTrafficAlert,
  postCommuteNotification,
  requestCommuteNotificationPermission,
  speakCommuteAlert,
  clearCommuteSpeech,
  primeSpeech,
  keepNavigationAudioAlive,
  type TrafficAlertSnapshot,
  warmVoicesOnFirstTap,
} from "@/lib/commute-alerts";
import {
  ALERT_PREFS_KEY,
  defaultAlertPrefs,
  evaluateApproach,
  parseAlertPrefs,
  playChime,
  primeChimeAudio,
  type AlertPrefs,
  type ApproachState,
} from "@/lib/approach";
import { isPermissionDeniedError } from "@/lib/location-permission";
import {
  clockInputValue,
  findByKind,
  kindLabel,
  hasValidCoordinates,
  migrateSavedPlaces,
  parseSavedPlaces,
  parseClockInput,
  LEGACY_SAVED_PLACES_KEY,
  SAVED_PLACES_KEY,
  type SavedPlace,
} from "@/lib/saved-places";
import { latestRailArrival as latestTransitArrival } from "@/lib/leave-by";
import { skylineFallbackHeadwayMinutes } from "@/lib/rail/skyline-fallback";
import {
  honoluluSecondsToIso,
  planDriveArrivalWithRange,
  solveFutureDrive,
} from "@/lib/drive/planner";
import { carAvailableForDrive } from "@/lib/car-state";
import { resolveTripDirection } from "@/lib/trip-direction";
import { createClientRateWindow } from "@/lib/client-rate-limit";
import {
  decideArrival,
  verdictMarginMinutes,
  type DecisionState,
} from "@/lib/decision/commute-decision";
import { createNaluVerdict } from "@/lib/intelligence/verdict-engine";
import { NaluPersonalityStrip, WaveMark } from "@/components/commute/NaluPersonalityStrip";
import { createCanonicalTrip } from "@/lib/intelligence/trip-model";
import { driveEstimate, transitEstimate } from "@/lib/decision/trip-estimate";
import { parseLockedItinerary } from "@/lib/rail/locked-itinerary";
import { ArriveByControls, type PlanMode } from "@/components/commute/ArriveByControls";
import { VerdictDomain } from "@/components/commute/VerdictDomain";
import { LandmarkHint } from "@/components/commute/TransitNotices";
import {
  AccountButton,
  AccountDialog,
  type PlacesSyncStatus,
} from "@/components/account/AccountDialog";
import { useAuth } from "@/hooks/use-auth";
import { useWakeLock } from "@/hooks/use-wake-lock";
import { arrivalRange, destinationAccess } from "@/lib/destination-access";
import {
  VoiceGuide,
  isUsableNavigationFix,
  metersBetween,
  nextManeuver,
  smoothBearing,
  routeBearingAt,
  turnGlyph,
  startRoutePhrase,
  distanceAlongPath,
} from "@/lib/navigation-voice";
import { track } from "@/lib/analytics";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { HOLO_FARES } from "@/lib/fares";
import {
  autoOpenAllowed,
  noteIgnored,
  noteUsed,
  predictSlot,
  readHabits,
  recordTripOpen,
} from "@/lib/trip-habits";
import { InstallNaluCard } from "@/components/InstallNaluCard";
import { LeaveAlertCard, RemindMeButton, alertKeyFor } from "@/components/LeaveAlertCard";
import {
  AskNaluIfAvailable,
  BeatTheRush,
  EveningPulse,
  MorningPulse,
  WeeklyDigestCard,
} from "@/components/ai/NaluAi";
import { rescueAdvice } from "@/lib/nalu-ai.functions";
import { finishTripLog, startTripLog } from "@/lib/trip-log";
import { ShareButton } from "@/components/ShareButton";
import { etaText, parseSharedDestination, shareText, shareUrl } from "@/lib/share-trip";
import {
  H1ConditionsCard,
  airLine,
  TONE_CLASS,
  type WeatherLine,
} from "@/components/commute/H1ConditionsCard";
import {
  alohaGreeting,
  clockFromSeconds,
  distanceM,
  formatDistance,
  honoluluDateKey,
  honoluluIsoDow,
  honoluluParts,
  honoluluSeconds,
  stationLabel,
  terminusLabel,
  titleCase,
  transitStopName,
  walkingEstimate,
} from "@/lib/commute-formatting";
import type { NearbyMapStop } from "@/components/NearbyTransitMap";
import { SITE_URL } from "@/lib/site";
import {
  ACTIVE_TRIP_KEY,
  ARRIVE_BY_KEY,
  BROWSE_LOCATION_DENIED_KEY,
  BROWSE_STATION_KEY,
  BrowseDeparture,
  BrowseStation,
  BusStopTarget,
  COMMIT_KEY,
  CarPlace,
  Commitment,
  Coords,
  DIRECTION_KEY,
  DOWNTOWN_POINT,
  DecisionSnapshot,
  DirectionOverride,
  KAPOLEI_POINT,
  LEGACY_STORAGE_PREFIX,
  LIVE_ROUTE_CACHE_KEY,
  LOCATION_DENIED_KEY,
  LOCKED_OPTION_KEY,
  Leg,
  NearbyArrival,
  NearbyStop,
  OVERRIDE_MS,
  Option,
  OutdoorMoment,
  PARKED_KEY,
  PLAN_MODE_KEY,
  ParkedCar,
  RailLineStation,
  SETUP_DISMISSED_KEY,
  STORAGE_KEY,
  Setup,
  TOSS_UP_MIN,
  TransitLegSequence,
  UiDecisionState,
  changedMinutes,
  emptySetup,
  heatLine,
  nearbyChipTitle,
  nearbyServiceLabel,
  optionIdentity,
  parseCommitment,
  profileFirstName,
  rainLine,
  sourceFreshnessLabel,
  vehicleName,
  alternativeOptions,
  moreTransfersLabel,
} from "@/lib/commute-model";
import { SettingsPageId, SetupDialog } from "@/components/settings/SetupDialog";
import { useRailStations } from "@/hooks/use-rail-stations";
import {
  RailTripBreakdown,
  WalkingMicroMap,
  matchLiveArrival,
} from "@/components/commute/RailTripBreakdown";
import {
  QuickPlaceDialog,
  ShortcutGrid,
  resolveShortcut,
  shortcutIcon,
  shortcutLabel,
} from "@/components/places/Shortcuts";
import { HoldToEndButton, NavBottomCard } from "@/components/commute/TripControls";

const NearbyTransitMap = lazy(() => import("@/components/NearbyTransitMap"));
const CommuteRouteMap = lazy(() => import("@/components/commute/CommuteRouteMap"));
const LiveNavMap = lazy(() => import("@/components/commute/LiveNavMap"));

import { planTransitTrip } from "@/lib/transit-plan";

const HOME_TITLE = "Nalu: Drive, TheBus or Skyline? Oʻahu Commute App";
const HOME_DESCRIPTION =
  "Free Oʻahu commute app: Nalu checks live traffic, TheBus and Skyline for your trip and tells you whether to drive or ride, and when to leave.";

/** One shared empty list, so memos keyed on stations stay stable before they load. */
const NO_STATIONS: import("@/lib/commute-model").RailStation[] = [];

export const Route = createFileRoute("/")({
  // First-time visitors and search engines see the introduction here (see
  // AppRouteGate in __root.tsx); returning visitors get the app.
  head: () => ({
    meta: [
      { title: HOME_TITLE },
      { name: "description", content: HOME_DESCRIPTION },
      { property: "og:title", content: HOME_TITLE },
      { property: "og:description", content: HOME_DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "Nalu" },
      { property: "og:url", content: SITE_URL + "/" },
      { property: "og:locale", content: "en_US" },
      { property: "og:image", content: SITE_URL + "/social-card.png" },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: HOME_TITLE },
      { name: "twitter:description", content: HOME_DESCRIPTION },
      { name: "twitter:image", content: SITE_URL + "/social-card.png" },
    ],
    links: [{ rel: "canonical", href: SITE_URL + "/" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "WebSite",
              "@id": SITE_URL + "/#website",
              name: "Nalu",
              url: SITE_URL + "/",
              description:
                "An Oʻahu commute app that tells you whether to drive or take TheBus or Skyline, and when to leave.",
            },
            {
              "@type": "Organization",
              "@id": SITE_URL + "/#organization",
              name: "Nalu",
              url: SITE_URL + "/",
              logo: SITE_URL + "/icons/icon-512.png",
            },
            {
              "@type": "SoftwareApplication",
              "@id": SITE_URL + "/#app",
              name: "Nalu",
              url: SITE_URL + "/",
              image: SITE_URL + "/social-card.png",
              description: HOME_DESCRIPTION,
              applicationCategory: "TravelApplication",
              operatingSystem: "Web",
              areaServed: { "@type": "Place", name: "Oʻahu, Hawaiʻi" },
              isAccessibleForFree: true,
              offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
              publisher: { "@id": SITE_URL + "/#organization" },
              featureList: [
                "Drive or transit decision for your trip",
                "When to leave, and time-to-leave alerts",
                "TheBus and Skyline trip planning with transfers",
                "Arrive By planning",
              ],
            },
          ],
        }),
      },
    ],
  }),
  component: Index,
});

function Index() {
  const { user, loading: authLoading, signedInAt } = useAuth();
  // Plan checks (all allowed while the plan switches are off, Phase 1).
  const gate = useGate();
  const [now, setNow] = useState(() => new Date());
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const updateOnline = () => setOnline(navigator.onLine);
    updateOnline();
    window.addEventListener("online", updateOnline);
    window.addEventListener("offline", updateOnline);
    return () => {
      window.removeEventListener("online", updateOnline);
      window.removeEventListener("offline", updateOnline);
    };
  }, []);
  const [hydrated, setHydrated] = useState(false);
  const [pageView, setPageView] = useState<"browse" | "commute">("browse");
  const initialPageViewSetRef = useRef(false);
  const [setup, setSetup] = useState<Setup>(emptySetup);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [mapSetupDraft, setMapSetupDraft] = useState<Setup | null>(null);
  const [mapStopActionBusy, setMapStopActionBusy] = useState(false);
  const mapStopActionBusyRef = useRef(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsPage, setSettingsPage] = useState<SettingsPageId | null>(null);
  const openSettingsAt = (page: SettingsPageId) => {
    setSettingsPage(page);
    setSettingsOpen(true);
  };
  const openSettingsList = () => {
    setSettingsPage(null);
    setSettingsOpen(true);
  };
  useEffect(() => warmVoicesOnFirstTap(), []);
  const [accountOpen, setAccountOpen] = useState(false);
  const [restoreSlot, setRestoreSlot] = useState<string | null>(null);
  const [quickPlaceSlot, setQuickPlaceSlot] = useState<string | null>(null);
  const [placesSyncStatus, setPlacesSyncStatus] = useState<PlacesSyncStatus>("idle");
  const [syncRetry, setSyncRetry] = useState(0);
  const [syncReadyUser, setSyncReadyUser] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const queryClient = useQueryClient();
  // Starting a trip or pulling to refresh must show truly live conditions, so
  // the next traffic lookup skips the short server-side cache once.
  const forcedTrafficRefresh = useRef(false);
  function takeForcedTrafficRefresh() {
    return forcedTrafficRefresh.current;
  }
  async function refreshTrafficNow() {
    forcedTrafficRefresh.current = true;
    await Promise.allSettled([
      queryClient.invalidateQueries({ queryKey: ["drive"] }),
      queryClient.invalidateQueries({ queryKey: ["browse-h1"] }),
    ]);
    forcedTrafficRefresh.current = false;
  }
  const [override, setOverride] = useState<DirectionOverride | null>(null);
  const [parked, setParked] = useState<ParkedCar | null>(null);
  const [browseStation, setBrowseStation] = useState<BrowseStation | null>(null);
  const [selectedNearbyStopId, setSelectedNearbyStopId] = useState<string | null>(null);
  const [browseLocationDenied, setBrowseLocationDenied] = useState(false);
  const [locationDenied, setLocationDenied] = useState(false);
  const [selectedMode, setSelectedMode] = useState<"transit" | "drive">("transit");
  // Once the commuter is underway the chosen mode is locked: the verdict must
  // never flip a driver onto rail, or a rider onto the freeway, mid-trip.
  const [commitment, setCommitment] = useState<Commitment | null>(null);
  // The itinerary boarded, held for the duration of a locked transit trip.
  const lockedOptionRef = useRef<Option | null>(null);
  const lockedItineraryCandidate = useRef<Option | null>(null);
  const decisionHistoryRef = useRef<{
    key: string;
    state: "drive" | "transit" | "same";
    snapshot: DecisionSnapshot | null;
  } | null>(null);
  const [savedPlaces, setSavedPlaces] = useState<SavedPlace[]>([]);
  const [planMode, setPlanMode] = useState<PlanMode>("leave-now");
  const [arriveByInput, setArriveByInput] = useState("");
  const [alertPrefs, setAlertPrefs] = useState<AlertPrefs>(defaultAlertPrefs);
  const syncedUserRef = useRef<string | null>(null);
  const syncStateRef = useRef({
    savedPlaces,
    alertPrefs,
    planMode,
    arriveByInput,
    setup,
    configured: false,
  });

  useEffect(() => {
    const migrateStorage = (key: string, legacySuffix: string) => {
      const current = window.localStorage.getItem(key);
      if (current !== null) return current;
      const legacyKey = `${LEGACY_STORAGE_PREFIX}-${legacySuffix}`;
      const legacy = window.localStorage.getItem(legacyKey);
      if (legacy !== null) window.localStorage.setItem(key, legacy);
      window.localStorage.removeItem(legacyKey);
      return legacy;
    };
    const stored = migrateStorage(STORAGE_KEY, "setup-v3");
    if (stored) {
      try {
        const saved = { ...emptySetup, ...(JSON.parse(stored) as Partial<Setup>) };
        // Older saves only kept the address; use it as the display name.
        setSetup({ ...saved, destinationName: saved.destinationName || saved.destinationAddress });
      } catch {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    }
    // First launch lands directly on the home screen; the user opens
    // WHERE TO? themselves when they are ready to set up a trip.
    migrateStorage(BROWSE_STATION_KEY, "browse-station-v1");
    migrateStorage(BROWSE_LOCATION_DENIED_KEY, "browse-location-denied-v1");
    migrateStorage(LOCATION_DENIED_KEY, "location-denied-v1");
    migrateStorage(DIRECTION_KEY, "direction-v1");
    migrateStorage(PARKED_KEY, "parked-v1");
    // Trip tracking was removed; clear any trip state left on the phone.
    window.localStorage.removeItem(ACTIVE_TRIP_KEY);
    const migratedPlaces = migrateSavedPlaces(
      window.localStorage.getItem(SAVED_PLACES_KEY),
      window.localStorage.getItem(LEGACY_SAVED_PLACES_KEY),
      stored,
    );
    setSavedPlaces(migratedPlaces);
    if (migratedPlaces.length)
      window.localStorage.setItem(SAVED_PLACES_KEY, JSON.stringify(migratedPlaces));
    const storedCommitment = parseCommitment(window.localStorage.getItem(COMMIT_KEY));
    if (storedCommitment) {
      setCommitment(storedCommitment);
      setSelectedMode(storedCommitment.mode);
      if (storedCommitment.mode === "transit")
        lockedOptionRef.current = parseLockedItinerary(
          window.localStorage.getItem(LOCKED_OPTION_KEY),
        );
    }
    const storedMode = window.localStorage.getItem(PLAN_MODE_KEY);
    if (storedMode === "arrive-by" || storedMode === "leave-now") setPlanMode(storedMode);
    setArriveByInput(window.localStorage.getItem(ARRIVE_BY_KEY) ?? "");
    setHydrated(true);
    // Browse/inspection mode does not need a 30s root render. Keep the clock
    // local to the page at a slower cadence; active navigation keeps its own
    // 10s liveTick below and remains intentionally responsive.
    const timer = window.setInterval(() => setNow(new Date()), commitment ? 30_000 : 120_000);
    return () => window.clearInterval(timer);
  }, [commitment]);

  // Local data remains authoritative on the device. On sign-in, merge any
  // cloud copy with the guest's current places before enabling ongoing sync.
  useEffect(() => {
    if (!hydrated || !user || syncedUserRef.current === user.id) return;
    let cancelled = false;
    setPlacesSyncStatus("loading");
    void (async () => {
      try {
        const { data, error } = await supabase
          .from("user_preferences")
          .select("saved_places,preferences,last_setup")
          .eq("user_id", user.id)
          .maybeSingle();
        if (cancelled) return;
        // A failed read is not an empty account. Never overwrite the backup after
        // a failed restore; let the rider retry while their local places remain usable.
        if (error) throw error;
        const remotePlaces = parseSavedPlaces(JSON.stringify(data?.saved_places ?? []));
        const merged = new Map<string, SavedPlace>();
        for (const place of remotePlaces) {
          const current = merged.get(place.id);
          if (!current || place.updatedAt >= current.updatedAt) merged.set(place.id, place);
        }
        const latestState = syncStateRef.current;
        for (const place of latestState.savedPlaces) {
          const current = merged.get(place.id);
          if (!current || place.updatedAt >= current.updatedAt) merged.set(place.id, place);
        }
        const nextPlaces = Array.from(merged.values());
        if (nextPlaces.length) persistPlaces(nextPlaces);
        const preferences =
          data?.preferences &&
          typeof data.preferences === "object" &&
          !Array.isArray(data.preferences)
            ? (data.preferences as Record<string, unknown>)
            : {};
        if (!window.localStorage.getItem(ALERT_PREFS_KEY) && preferences["alertPrefs"]) {
          const restored = parseAlertPrefs(JSON.stringify(preferences["alertPrefs"]));
          saveAlertPrefs(restored);
        }
        const displayName =
          typeof user.user_metadata?.["full_name"] === "string"
            ? user.user_metadata["full_name"]
            : null;
        const avatarUrl =
          typeof user.user_metadata?.["avatar_url"] === "string"
            ? user.user_metadata["avatar_url"]
            : null;
        if (cancelled) return;
        const currentState = syncStateRef.current;
        const writes = await Promise.all([
          supabase.from("profiles").upsert({
            id: user.id,
            display_name: displayName,
            avatar_url: avatarUrl,
            updated_at: new Date().toISOString(),
          }),
          supabase.from("user_preferences").upsert({
            user_id: user.id,
            saved_places: nextPlaces,
            preferences: {
              alertPrefs: currentState.alertPrefs,
              planMode: currentState.planMode,
              arriveByInput: currentState.arriveByInput,
            },
            last_setup: currentState.configured ? currentState.setup : (data?.last_setup ?? null),
            updated_at: new Date().toISOString(),
          }),
        ]);
        if (cancelled) return;
        if (writes.some((result) => result.error))
          throw new Error("Could not save account preferences");
        syncedUserRef.current = user.id;
        setSyncReadyUser(user.id);
        setPlacesSyncStatus("synced");
      } catch {
        if (!cancelled) setPlacesSyncStatus("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hydrated, user?.id, syncRetry]);

  useEffect(() => {
    if (!user) {
      syncedUserRef.current = null;
      setSyncReadyUser(null);
      setPlacesSyncStatus("idle");
    }
  }, [user]);

  useEffect(() => {
    if (!user || syncReadyUser !== user.id) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setPlacesSyncStatus("saving");
      void (async () => {
        try {
          const { error } = await supabase.from("user_preferences").upsert({
            user_id: user.id,
            saved_places: savedPlaces,
            preferences: { alertPrefs, planMode, arriveByInput },
            last_setup: syncStateRef.current.configured ? setup : null,
            updated_at: new Date().toISOString(),
          });
          if (!cancelled) setPlacesSyncStatus(error ? "error" : "synced");
        } catch {
          if (!cancelled) setPlacesSyncStatus("error");
        }
      })();
    }, 500);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [user?.id, syncReadyUser, savedPlaces, alertPrefs, planMode, arriveByInput, setup]);

  // Track whether the browser has blocked location so the app can offer
  // recovery steps instead of silently falling back to a default station.
  useEffect(() => {
    let cancelled = false;
    if (window.localStorage.getItem(LOCATION_DENIED_KEY) === "1") setLocationDenied(true);
    let status: PermissionStatus | null = null;
    const sync = () => {
      if (cancelled || !status) return;
      if (status.state === "denied") {
        setLocationDenied(true);
        window.localStorage.setItem(LOCATION_DENIED_KEY, "1");
      } else if (status.state === "granted" || status.state === "prompt") {
        setLocationDenied(false);
        window.localStorage.removeItem(LOCATION_DENIED_KEY);
      }
    };
    navigator.permissions
      ?.query({ name: "geolocation" as PermissionName })
      .then((result) => {
        if (cancelled) return;
        status = result;
        status.onchange = sync;
        sync();
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      if (status) status.onchange = null;
    };
  }, []);

  function recordLocationDenied() {
    setLocationDenied(true);
    window.localStorage.setItem(LOCATION_DENIED_KEY, "1");
  }

  // A manual choice wins; otherwise infer the planner direction from the
  // selected destination without reversing the user's actual trip endpoints.
  const overrideActive = Boolean(override && now.getTime() - override.at < OVERRIDE_MS);
  const savedHome = findByKind(savedPlaces, "home");
  const tripDirection = resolveTripDirection({
    origin: { lat: setup.homeLat, lon: setup.homeLon },
    destination: { lat: setup.destLat, lon: setup.destLon },
    savedHome,
    manualInbound: overrideActive ? Boolean(override?.inbound) : null,
  });
  const { inbound, reverseTrip, departingFromSavedHome, arrivingAtSavedHome } = tripDirection;
  const arrivingHome = reverseTrip || arrivingAtSavedHome;

  function chooseDirection(next: boolean) {
    const entry: DirectionOverride = { inbound: next, at: Date.now() };
    setOverride(entry);
    window.localStorage.setItem(DIRECTION_KEY, JSON.stringify(entry));
  }

  function persist(next: Setup) {
    setSetup(next);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  function persistPlaces(next: SavedPlace[]) {
    setSavedPlaces(next);
    window.localStorage.setItem(SAVED_PLACES_KEY, JSON.stringify(next));
  }

  function choosePlanMode(next: PlanMode) {
    if (next === "arrive-by" && !gate.require("arrive_by")) return;
    setPlanMode(next);
    window.localStorage.setItem(PLAN_MODE_KEY, next);
  }

  function chooseArriveBy(next: string) {
    setArriveByInput(next);
    window.localStorage.setItem(ARRIVE_BY_KEY, next);
  }

  /** Commit to a mode for the trip underway and stop the verdict changing it. */
  function commitMode(next: "transit" | "drive") {
    requestCommuteNotificationPermission();
    const entry: Commitment = { mode: next, at: Date.now() };
    const driveEst = driveTripEstimate.expectedDurationMinutes;
    startTripLog({
      mode: next,
      startedAt: entry.at,
      chosenMinutes: next === "drive" ? driveEst : transitMinutes,
      otherMinutes: next === "drive" ? transitMinutes : driveEst,
    });
    track("active_trip_started", { mode: next });
    setCommitment(entry);
    setSelectedMode(next);
    // Freeze the itinerary in front of the rider, transfers included.
    lockedOptionRef.current = next === "transit" ? lockedItineraryCandidate.current : null;
    window.localStorage.setItem(COMMIT_KEY, JSON.stringify(entry));
    if (lockedOptionRef.current)
      window.localStorage.setItem(LOCKED_OPTION_KEY, JSON.stringify(lockedOptionRef.current));
    else window.localStorage.removeItem(LOCKED_OPTION_KEY);
  }

  /** Release the lock so Nalu can recommend again. */
  function releaseCommitment() {
    finishTripLog();
    setCommitment(null);
    lockedOptionRef.current = null;
    window.localStorage.removeItem(COMMIT_KEY);
    window.localStorage.removeItem(LOCKED_OPTION_KEY);
  }

  /** An active trip stays on its committed mode until it is ended. */
  function chooseMode(next: "transit" | "drive") {
    if (commitment) return;
    setSelectedMode(next);
  }

  // "End trip" clears the saved commute and its overrides, returning to browse
  // mode where departures stay visible and a new trip can be set up anytime.
  function endTrip() {
    setSetup(emptySetup);
    setPageView("browse");
    syncStateRef.current = {
      ...syncStateRef.current,
      setup: emptySetup,
      configured: false,
    };
    window.localStorage.removeItem(STORAGE_KEY);
    setOverride(null);
    window.localStorage.removeItem(DIRECTION_KEY);
    setParked(null);
    window.localStorage.removeItem(PARKED_KEY);
    setSettingsOpen(false);
    setOnboardingOpen(false);
    setSelectedMode("transit");
    setSelectedDeparture(null);
    setPlanMode("leave-now");
    setArriveByInput("");
    window.localStorage.removeItem(PLAN_MODE_KEY);
    window.localStorage.removeItem(ARRIVE_BY_KEY);
    window.localStorage.setItem(SETUP_DISMISSED_KEY, "1");
    // Releasing the lock also stops the GPS watcher and the 2-minute traffic
    // polling, both of which are gated on an active committed drive.
    releaseCommitment();
  }

  const handledSignInRef = useRef<number | null>(null);
  useEffect(() => {
    if (!signedInAt || handledSignInRef.current === signedInAt) return;
    handledSignInRef.current = signedInAt;
    // Authentication may finish after local hydration or cloud sync. Clear only
    // transient trip state; saved places and account preferences remain intact.
    setSetup(emptySetup);
    setPageView("browse");
    syncStateRef.current = {
      ...syncStateRef.current,
      setup: emptySetup,
      configured: false,
    };
    window.localStorage.removeItem(STORAGE_KEY);
    setCommitment(null);
    lockedOptionRef.current = null;
    window.localStorage.removeItem(COMMIT_KEY);
    window.localStorage.removeItem(LOCKED_OPTION_KEY);
    setOverride(null);
    window.localStorage.removeItem(DIRECTION_KEY);
    setSelectedDeparture(null);
    setSelectedMode("transit");
    setOnboardingOpen(false);
    setSettingsOpen(false);
  }, [signedInAt]);

  const timeParts = useMemo(
    () =>
      new Intl.DateTimeFormat("en-US", {
        timeZone: regionTimeZone(),
        weekday: "long",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
        .formatToParts(now)
        .reduce(
          (acc, part) => {
            if (part.type === "weekday") acc.w = part.value;
            else if (part.type === "month") acc.m = part.value;
            else if (part.type === "day") acc.d = part.value;
            else if (part.type === "hour") acc.h = part.value;
            else if (part.type === "minute") acc.min = part.value;
            else if (part.type === "dayPeriod") acc.p = part.value;
            return acc;
          },
          { w: "", m: "", d: "", h: "", min: "", p: "" },
        ),
    [now],
  );
  const timeText = `${timeParts.w}, ${timeParts.m} ${timeParts.d} · ${timeParts.h}:${timeParts.min} ${timeParts.p}`;

  const configured =
    hasValidCoordinates({ lat: setup.homeLat, lon: setup.homeLon }) &&
    hasValidCoordinates({ lat: setup.destLat, lon: setup.destLon });

  useEffect(() => {
    if (!hydrated || initialPageViewSetRef.current) return;
    initialPageViewSetRef.current = true;
    setPageView(configured ? "commute" : "browse");
  }, [hydrated, configured]);

  syncStateRef.current = { savedPlaces, alertPrefs, planMode, arriveByInput, setup, configured };
  const { data: browseStations = NO_STATIONS } = useRailStations(hydrated);
  // plan_inbound's station is the *arrival* station. The setup station is
  // nearest the selected origin, so resolve a new one for westbound trips.
  const { data: inboundStation } = useQuery({
    queryKey: ["inbound-arrival-station", tripDirection.to.lat, tripDirection.to.lon],
    enabled: hydrated && configured && inbound && !reverseTrip,
    staleTime: 12 * 60 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("nearest_stop", {
        p_lat: tripDirection.to.lat as number,
        p_lon: tripDirection.to.lon as number,
        p_rail_only: true,
      });
      if (error) throw error;
      if (!data?.[0]) throw new Error("No arrival rail station is available");
      return data[0];
    },
  });
  const arrivalStationId =
    inbound && !reverseTrip ? (inboundStation?.stop_id ?? null) : setup.homeStopId;
  const arrivalStationName =
    inbound && !reverseTrip ? (inboundStation?.stop_name ?? "") : setup.homeStopName;
  // The generalized planner is door-to-door and must be available for every
  // configured trip, even when the selected origin/destination has no nearby
  // rail station. The legacy rail planner below remains optional and can fail
  // without suppressing bus/walk transit.
  // Test regions (San Francisco) have no bus or rail data yet: drive only.
  const transitConfigured = configured && activeRegion().hasTransit;
  const browseActive = hydrated && (!configured || pageView === "browse");
  // A committed drive is what turns on live GPS on the map and the rolling
  // 2-minute traffic refresh; both stop the moment the lock is released.
  const lockedMode = commitment?.mode ?? null;
  const drivingCommitted = lockedMode === "drive" && configured && !browseActive;
  const nowSeconds = honoluluSeconds(now);
  const afterSeconds = Math.floor(nowSeconds / 60) * 60;
  const lastOnlineScheduleSeconds = useRef<number | null>(null);
  if (online) lastOnlineScheduleSeconds.current = afterSeconds;
  // Keep schedule query keys on their last successful minute while offline,
  // so React Query continues showing the cached itinerary and nearby arrivals.
  const scheduleAfterSeconds = online
    ? afterSeconds
    : (lastOnlineScheduleSeconds.current ?? afterSeconds);
  // Where today's car is. With station driving enabled, an unrecorded return
  // starts with the car at the home station; an explicit same-day location wins.
  const parkedToday = parked && parked.date === honoluluDateKey(now) ? parked : null;
  const carPlace: CarPlace = parkedToday?.place === "station" ? "station" : "home";
  const carAtStation = Boolean(
    setup.allowDrive &&
    carPlace === "station" &&
    (parkedToday ? parkedToday.station === arrivalStationId : reverseTrip),
  );
  // Door-to-door driving is always compared. "I can drive to the station" only
  // governs the park-and-ride first leg; it never removes the drive option.
  // The only genuine blocker is a car recorded today somewhere else.
  const driveAvailable = carAvailableForDrive(parkedToday, inbound);
  // Only an explicitly recorded car location explains a missing drive option.
  const carAwayReason = driveAvailable
    ? null
    : inbound && carPlace === "station"
      ? `Your car is parked at ${
          parkedToday && parkedToday.station !== arrivalStationId
            ? "your station"
            : `${stationLabel(arrivalStationName)} Station`
        }.`
      : inbound && carPlace === "home"
        ? "Your car is at home."
        : !inbound && carPlace === "station"
          ? `Your car is at ${stationLabel(setup.homeStopName)}.`
          : null;

  function rememberBrowseStation(next: BrowseStation) {
    setBrowseStation(next);
    window.localStorage.setItem(BROWSE_STATION_KEY, JSON.stringify(next));
  }

  // Older saved trips only stored one stop; fill in the directional pair once.
  useEffect(() => {
    if (!hydrated || !setup.destLat || !setup.destLon || setup.destReturnStopId) return;
    let cancelled = false;
    (async () => {
      const [arriving, boarding] = await Promise.all([
        supabase.rpc("directional_dest_stop", {
          p_lat: setup.destLat!,
          p_lon: setup.destLon!,
          p_toward_rail: false,
        }),
        supabase.rpc("directional_dest_stop", {
          p_lat: setup.destLat!,
          p_lon: setup.destLon!,
          p_toward_rail: true,
        }),
      ]);
      const out = arriving.data?.[0];
      const back = boarding.data?.[0];
      if (cancelled || !back) return;
      setSetup((current) => ({
        ...current,
        destStopId: out?.stop_id ?? current.destStopId,
        destStopName: out?.stop_name ?? current.destStopName,
        destStopWalkM: out ? Number(out.distance_m) : current.destStopWalkM,
        destReturnStopId: back?.stop_id ?? "",
        destReturnStopName: back?.stop_name ?? "",
        destReturnWalkM: Number(back?.distance_m ?? 0),
      }));
    })();
    return () => {
      cancelled = true;
    };
  }, [hydrated, setup.destLat, setup.destLon, setup.destReturnStopId]);

  // Dismissed setup still works: use location only to choose the closest rail station.
  useEffect(() => {
    if (!browseActive || onboardingOpen || browseStation || browseLocationDenied) return;
    if (!navigator.geolocation) {
      setBrowseLocationDenied(true);
      window.localStorage.setItem(BROWSE_LOCATION_DENIED_KEY, "1");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;
        const { data, error } = await supabase.rpc("nearest_stop", {
          p_lat: lat,
          p_lon: lon,
          p_rail_only: true,
        });
        const nearest = data?.[0];
        if (error || !nearest) {
          setBrowseLocationDenied(true);
          window.localStorage.setItem(BROWSE_LOCATION_DENIED_KEY, "1");
          return;
        }
        rememberBrowseStation({
          stopId: nearest.stop_id,
          stopName: nearest.stop_name ?? "",
          lat: Number(nearest.stop_lat),
          lon: Number(nearest.stop_lon),
          userLat: lat,
          userLon: lon,
        });
      },
      (error) => {
        setBrowseLocationDenied(true);
        window.localStorage.setItem(BROWSE_LOCATION_DENIED_KEY, "1");
        if (isPermissionDeniedError(error)) recordLocationDenied();
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
    );
  }, [browseActive, onboardingOpen, browseStation, browseLocationDenied]);

  // If location is unavailable, derive the west-side default from live station
  // coordinates rather than pinning a station name or id into the app.
  useEffect(() => {
    if (!browseActive || !browseLocationDenied || browseStation || browseStations.length === 0)
      return;
    const nearest = browseStations
      .filter((station) => station.stop_lat !== null && station.stop_lon !== null)
      .map((station) => ({
        station,
        distance: distanceM(KAPOLEI_POINT, {
          lat: Number(station.stop_lat),
          lon: Number(station.stop_lon),
        }),
      }))
      .sort((a, b) => a.distance - b.distance)[0]?.station;
    if (!nearest) return;
    rememberBrowseStation({
      stopId: nearest.stop_id,
      stopName: nearest.stop_name ?? "",
      lat: Number(nearest.stop_lat),
      lon: Number(nearest.stop_lon),
    });
  }, [browseActive, browseLocationDenied, browseStation, browseStations]);

  const {
    data: browseDepartures = [],
    isLoading: browseDeparturesLoading,
    isError: browseDeparturesFailed,
    refetch: refetchBrowseDepartures,
  } = useQuery({
    queryKey: ["browse-departures", browseStation?.stopId, Math.floor(scheduleAfterSeconds / 60)],
    enabled: browseActive && Boolean(browseStation?.stopId),
    staleTime: 120_000,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("rail_departures", {
        p_home_stop: browseStation?.stopId as string,
        p_after_seconds: scheduleAfterSeconds,
        p_limit: 3,
      });
      if (error) throw error;
      return (data ?? []) as BrowseDeparture[];
    },
  });

  const browseDirections = useMemo(() => {
    const here = stationLabel(browseStation?.stopName).toLowerCase();
    // One section per physical line direction; headsign variants are not directions.
    const groups = new Map<string, BrowseDeparture[]>();
    for (const departure of browseDepartures) {
      // Never head a direction with the station the rider is standing at.
      const label = stationLabel(departure.trip_headsign).toLowerCase();
      if (here && label && label === here) continue;
      const key = `${departure.route_id}-${departure.direction_id ?? "x"}`;
      const group = groups.get(key) ?? [];
      if (group.length < 3) group.push(departure);
      groups.set(key, group);
    }
    return Array.from(groups.values());
  }, [browseDepartures, browseStation?.stopName]);

  const browseUserPoint = useMemo(() => {
    if (browseStation?.userLat == null || browseStation.userLon == null) return null;
    return { lat: browseStation.userLat, lon: browseStation.userLon };
  }, [browseStation?.userLat, browseStation?.userLon]);

  // Station card: far riders see a compact pill; long walks get TheBus feeders.
  const [stationExpanded, setStationExpanded] = useState(false);
  const browseFar = Boolean(
    browseUserPoint && browseStation && distanceM(browseUserPoint, browseStation) > 2414,
  );
  const browseWalkMinutes =
    browseUserPoint && browseStation
      ? walkingEstimate(browseUserPoint, browseStation).minutes
      : null;
  const trainsEveryMinutes = useMemo(() => {
    const gaps = browseDirections
      .map((d) =>
        d[0] && d[1] ? Math.round((d[1].departure_seconds - d[0].departure_seconds) / 60) : null,
      )
      .filter((g): g is number => g !== null && g > 0 && g < 60);
    // Prefer actual GTFS departure gaps. If the station query is temporarily
    // empty, use the documented Skyline system headway rather than hiding the
    // useful cadence entirely. This is a frequency fallback, not live tracking.
    return gaps.length
      ? Math.min(...gaps)
      : browseStation
        ? skylineFallbackHeadwayMinutes(browseStation.stopName)
        : null;
  }, [browseDirections, browseStation?.stopName]);
  const { data: feederBuses = [] } = useQuery({
    queryKey: [
      "feeder-bus",
      browseStation?.stopId,
      browseUserPoint?.lat.toFixed(3),
      browseUserPoint?.lon.toFixed(3),
      Math.floor(scheduleAfterSeconds / 300),
    ],
    enabled:
      browseActive && Boolean(browseStation && browseUserPoint) && (browseWalkMinutes ?? 0) > 18,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("feeder_bus_to_station", {
        p_lat: browseUserPoint!.lat,
        p_lon: browseUserPoint!.lon,
        p_station: browseStation!.stopId,
        p_after_seconds: scheduleAfterSeconds,
      });
      if (error) throw error;
      return data ?? [];
    },
  });
  const { data: parkingRows = [] } = useQuery({
    queryKey: ["station-parking"],
    staleTime: 60 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("station_parking").select("*");
      if (error) throw error;
      return data ?? [];
    },
  });
  const stationParking = useMemo(() => {
    const name = (browseStation?.stopName ?? "").toLowerCase();
    return parkingRows.find((row) => name.includes(row.name_match)) ?? null;
  }, [parkingRows, browseStation?.stopName]);
  const browseHome = useMemo(() => {
    const p = findByKind(savedPlaces, "home");
    return p && p.lat != null && p.lon != null ? { lat: p.lat, lon: p.lon, label: p.label } : null;
  }, [savedPlaces]);
  const browseWork = useMemo(() => {
    const p = findByKind(savedPlaces, "work");
    return p && p.lat != null && p.lon != null ? { lat: p.lat, lon: p.lon, label: p.label } : null;
  }, [savedPlaces]);

  const { data: nearbyStops = [], isLoading: nearbyStopsLoading } = useQuery({
    queryKey: [
      "nearby-transit-stops",
      browseUserPoint?.lat.toFixed(5),
      browseUserPoint?.lon.toFixed(5),
      Math.floor(scheduleAfterSeconds / 60),
    ],
    enabled: browseActive && Boolean(browseUserPoint),
    staleTime: 120_000,
    refetchInterval: 60_000,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const point = browseUserPoint as Coords;
      const { data, error } = await supabase.rpc("nearby_transit_stops", {
        p_lat: point.lat,
        p_lon: point.lon,
        p_after_seconds: scheduleAfterSeconds,
        p_rail_limit: 2,
        p_bus_limit: 5,
      });
      if (error) throw error;
      return (data ?? []).map((row): NearbyStop => ({
        stopId: row.stop_id,
        stopName: row.stop_name ?? "",
        lat: Number(row.stop_lat),
        lon: Number(row.stop_lon),
        routeType: row.route_type,
        distanceM: Number(row.distance_m),
        arrivals: Array.isArray(row.arrivals) ? (row.arrivals as NearbyArrival[]) : [],
      }));
    },
  });

  useEffect(() => {
    if (!nearbyStops.length) return;
    if (
      !selectedNearbyStopId ||
      !nearbyStops.some((stop) => stop.stopId === selectedNearbyStopId)
    ) {
      setSelectedNearbyStopId(nearbyStops[0]?.stopId ?? null);
    }
  }, [nearbyStops, selectedNearbyStopId]);

  const selectedNearbyStop =
    nearbyStops.find((stop) => stop.stopId === selectedNearbyStopId) ?? nearbyStops[0] ?? null;

  const arriveByTarget = parseClockInput(arriveByInput);
  const futureTrafficWindow = useRef(createClientRateWindow(8_000));
  const [settledTrafficTarget, setSettledTrafficTarget] = useState<number | null>(null);
  // Rail planning updates immediately; the more expensive future TomTom request
  // waits for typing to settle and for the previous traffic lookup's cooldown.
  useEffect(() => {
    setSettledTrafficTarget(null);
    if (planMode !== "arrive-by" || arriveByTarget === null) return;
    let rateTimer: number | undefined;
    const debounceTimer = window.setTimeout(() => {
      rateTimer = window.setTimeout(
        () => setSettledTrafficTarget(arriveByTarget),
        futureTrafficWindow.current.remainingMs(Date.now()),
      );
    }, 500);
    return () => {
      window.clearTimeout(debounceTimer);
      if (rateTimer !== undefined) window.clearTimeout(rateTimer);
    };
  }, [planMode, arriveByTarget]);
  const {
    data: options = [],
    isLoading: planLoading,
    isError: planFailed,
    dataUpdatedAt: optionsFetchedAt,
  } = useQuery({
    queryKey: [
      "trip",
      inbound ? "inbound" : "outbound",
      tripDirection.from.lat,
      tripDirection.from.lon,
      tripDirection.to.lat,
      tripDirection.to.lon,
      arrivalStationId,
      setup.homeStopId,
      setup.destStopId,
      setup.allowDrive,
      carAtStation,
      driveAvailable,
      scheduleAfterSeconds,
      planMode,
      planMode === "arrive-by" ? arriveByTarget : null,
    ],
    enabled: hydrated && transitConfigured,
    staleTime: 120_000,
    placeholderData: keepPreviousData,
    queryFn: () =>
      planTransitTrip({
        arrivalStationId,
        arriveByTarget,
        browseStations,
        carAtStation,
        driveAvailable,
        inbound,
        now,
        nowSeconds,
        parkedToday,
        planMode,
        scheduleAfterSeconds,
        setup,
        tripDirection,
      }),
  });
  // The arrival-station lookup is auxiliary for inbound rail planning. It must
  // never make a valid door-to-door transit search appear unavailable.
  const optionsLoading = planLoading;
  const optionsFailed = planFailed;
  const { data: transitDiagnostic } = useQuery({
    queryKey: [
      "transit-diagnostic",
      tripDirection.from.lat,
      tripDirection.from.lon,
      tripDirection.to.lat,
      tripDirection.to.lon,
      scheduleAfterSeconds,
    ],
    enabled:
      hydrated &&
      configured &&
      !planLoading &&
      options.length === 0 &&
      tripDirection.from.lat !== null &&
      tripDirection.to.lat !== null,
    staleTime: 60_000,
    retry: false,
    queryFn: async () => {
      const diagnoseTransitGeneral = supabase.rpc.bind(supabase) as unknown as (
        functionName: string,
        args: Record<string, number>,
      ) => Promise<{ data: string | null; error: unknown }>;
      const { data, error } = await diagnoseTransitGeneral("diagnose_transit_general", {
        p_origin_lat: tripDirection.from.lat as number,
        p_origin_lon: tripDirection.from.lon as number,
        p_dest_lat: tripDirection.to.lat as number,
        p_dest_lon: tripDirection.to.lon as number,
        p_after_seconds: scheduleAfterSeconds,
      });
      if (error) throw error;
      return typeof data === "string" ? data : "UNKNOWN";
    },
  });

  // Options arrive in earliest-door-arrival order, except that trips whose extra
  // transfers save too little (extraTransfers) come after the simpler ones: the
  // pick is the earliest simpler trip, and those stay available by choice.
  const earliest = options[0];
  const [selectedDeparture, setSelectedDeparture] = useState<string | null>(null);
  useEffect(() => {
    // A locked transit trip keeps its itinerary even as fresher options arrive.
    // In browse/inspection mode, keep a user's selected departure while it is
    // still present in the refreshed option set. Do not let background polling
    // collapse what they are reading.
    if (commitment?.mode === "transit") return;
    if (
      selectedDeparture !== null &&
      options.some((option) => optionIdentity(option) === selectedDeparture)
    )
      return;
    setSelectedDeparture(null);
  }, [inbound, options, selectedDeparture, commitment]);
  // The way to travel the rider tapped (Drive / Park & ride / No car). It is
  // kept when that departure leaves, so a rider without a car is never moved
  // onto a car trip, and cleared for a new destination.
  const [chosenCard, setChosenCard] = useState<TripChoiceKey | null>(null);
  const choicePicks = transitChoices(options, planMode === "arrive-by" ? arriveByTarget : null);
  const chosenCardOption =
    chosenCard === "noCar"
      ? choicePicks.noCar.option
      : chosenCard === "parkAndRide"
        ? choicePicks.parkAndRide.option
        : null;
  const liveBest =
    options.find((option) => optionIdentity(option) === selectedDeparture) ??
    chosenCardOption ??
    earliest;
  // While riding, the itinerary on screen is the one boarded — including its
  // transfers — not whatever is fastest to leave now.
  const best =
    commitment?.mode === "transit" && lockedOptionRef.current ? lockedOptionRef.current : liveBest;
  lockedItineraryCandidate.current = liveBest ?? null;

  const transitModesLabel = best?.legs.some((leg) => leg.mode === "rail")
    ? best.legs.some((leg) => leg.mode === "bus")
      ? "Rail + Bus"
      : "Rail"
    : best?.legs.some((leg) => leg.mode === "bus")
      ? "Bus"
      : "Transit";
  // A trip that uses the car with transit is "Park & ride" everywhere.
  const transitLabel = best?.legs.some((leg) => leg.mode === "drive")
    ? "Park & ride"
    : transitModesLabel;
  const transitUsesRail = best?.legs.some((leg) => leg.mode === "rail") ?? false;
  const transitUsesBus = best?.legs.some((leg) => leg.mode === "bus") ?? false;

  const stationCoords = browseStations;
  /* One authoritative rail-station query serves browse, setup, maps and planning. */
  // Stable between renders so the map and timeline memos only recompute when stations change.
  const stationPoint = useCallback(
    (name: string | null | undefined, stopId?: string | null): Coords | null => {
      // GTFS stop id first; the name is only a fallback for legs without one.
      const byId = stopId ? stationCoords.find((station) => station.stop_id === stopId) : undefined;
      if (byId && byId.stop_lat !== null && byId.stop_lon !== null)
        return { lat: Number(byId.stop_lat), lon: Number(byId.stop_lon) };
      if (!name) return null;
      const wanted = name.trim().toLowerCase();
      const hit = stationCoords.find(
        (station) => (station.stop_name ?? "").trim().toLowerCase() === wanted,
      );
      if (!hit || hit.stop_lat === null || hit.stop_lon === null) return null;
      return { lat: Number(hit.stop_lat), lon: Number(hit.stop_lon) };
    },
    [stationCoords],
  );

  // GTFS stop ids identify a stop; names are ambiguous and are for display only.
  const itineraryStopIds = useMemo(
    () =>
      Array.from(
        new Set(
          (best?.legs ?? [])
            .flatMap((leg) => [leg.from_stop_id, leg.to_stop_id])
            .filter((id): id is string => Boolean(id)),
        ),
      ),
    [best],
  );
  const itineraryStopNames = useMemo(
    () =>
      Array.from(
        new Set(
          (best?.legs ?? [])
            .flatMap((leg) => [leg.from, leg.to])
            .filter((name): name is string => Boolean(name)),
        ),
      ),
    [best],
  );
  const { data: itineraryStopCoords = [] } = useQuery({
    queryKey: ["itinerary-stop-coords", itineraryStopIds, itineraryStopNames],
    enabled: configured && (itineraryStopIds.length > 0 || itineraryStopNames.length > 0),
    staleTime: 6 * 60 * 60_000,
    queryFn: async () => {
      const query = supabase.from("stops").select("stop_id,stop_name,stop_lat,stop_lon");
      const { data, error } = itineraryStopIds.length
        ? await query.in("stop_id", itineraryStopIds)
        : await query.in("stop_name", itineraryStopNames);
      if (error) throw error;
      return data ?? [];
    },
  });

  // The Skyline alignment in running order, straight from the feed.
  const { data: railLine = [] } = useQuery({
    queryKey: ["rail-line-stations"],
    enabled: configured,
    staleTime: 6 * 60 * 60_000,
    queryFn: async (): Promise<RailLineStation[]> => {
      const { data, error } = await supabase.rpc("rail_line_stations");
      if (error) throw error;
      return (data ?? []) as RailLineStation[];
    },
  });

  const { data: itineraryLegSequences = [] } = useQuery({
    queryKey: [
      "itinerary-leg-sequences",
      best?.legs.map((leg) => [
        leg.from_stop_id,
        leg.to_stop_id,
        leg.depart_seconds,
        leg.route_short,
        leg.mode,
      ]),
    ],
    enabled:
      configured &&
      Boolean(
        best?.legs.some(
          (leg) => (leg.mode === "rail" || leg.mode === "bus") && leg.depart_seconds !== null,
        ),
      ),
    staleTime: 30 * 60_000,
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<TransitLegSequence[]> => {
      if (!best) return [];
      const sequences = await Promise.all(
        best.legs.map(async (leg, legIndex) => {
          if (
            (leg.mode !== "rail" && leg.mode !== "bus") ||
            !leg.from ||
            !leg.to ||
            leg.depart_seconds === null
          )
            return null;
          const sequenceArgs = {
            p_from_name: leg.from,
            p_to_name: leg.to,
            p_depart_seconds: leg.depart_seconds,
            ...(leg.mode === "bus" && leg.route_short ? { p_route_short: leg.route_short } : {}),
            p_rail: leg.mode === "rail",
            p_tolerance_seconds: 300,
          };
          let { data, error } = await supabase.rpc("leg_stop_sequence", sequenceArgs);
          // The planner and GTFS feed can be a few minutes apart. For buses,
          // retry with a wider window while keeping the route constrained.
          // Never fall back to a straight line: missing GTFS geometry must not
          // become a misleading route across the map.
          if (
            (error || !data?.length) &&
            leg.mode === "bus" &&
            leg.route_short &&
            leg.depart_seconds !== null
          ) {
            const retry = await supabase.rpc("leg_stop_sequence", {
              ...sequenceArgs,
              p_tolerance_seconds: 1800,
            });
            data = retry.data;
            error = retry.error;
          }
          // One unmatched leg must never wipe out the geometry of the others.
          if (error) return null;
          const points = (data ?? []).flatMap((row) =>
            row.stop_lat === null || row.stop_lon === null
              ? []
              : [
                  {
                    stopId: row.stop_id,
                    stopName: row.stop_name ?? "",
                    lat: Number(row.stop_lat),
                    lon: Number(row.stop_lon),
                  },
                ],
          );
          return points.length > 1 ? { legIndex, mode: leg.mode, points } : null;
        }),
      );
      return sequences.filter((sequence): sequence is TransitLegSequence => sequence !== null);
    },
  });

  const plannedBusLeg =
    best?.legs.find((leg) => leg.mode === "bus" && leg.kind === "connect") ??
    best?.legs.find((leg) => leg.mode === "bus") ??
    null;
  const busStopName = plannedBusLeg?.from;
  // Prefer the planner's own stop id; fall back to the name only for legacy rows.
  const plannedBusStopId = plannedBusLeg?.from_stop_id ?? null;
  const { data: lookedUpBusStopId = null } = useQuery({
    queryKey: ["active-bus-stop", busStopName],
    enabled: Boolean(busStopName) && !plannedBusStopId,
    staleTime: 3 * 60 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stops")
        .select("stop_id")
        .eq("stop_name", busStopName as string)
        .limit(1);
      if (error) throw error;
      return data?.[0]?.stop_id ?? null;
    },
  });
  const activeBusStopId = plannedBusStopId ?? lookedUpBusStopId;

  const busTarget: BusStopTarget | null = activeBusStopId
    ? {
        stopId: activeBusStopId,
        scheduled: plannedBusLeg?.depart_seconds
          ? [
              {
                routeShortName: plannedBusLeg.route_short,
                headsign: plannedBusLeg.headsign,
                scheduledSeconds: plannedBusLeg.depart_seconds,
              },
            ]
          : [],
      }
    : null;
  const fetchBusArrivals = useServerFn(busArrivals);
  const { data: liveBus, isFetching: liveBusRefreshing } = useQuery({
    queryKey: ["hea-arrivals", busTarget?.stopId, busTarget?.scheduled],
    enabled: Boolean(busTarget),
    staleTime: 30_000,
    refetchInterval: 30_000,
    placeholderData: keepPreviousData,
    retry: false,
    queryFn: () => fetchBusArrivals({ data: busTarget as BusStopTarget }),
  });
  const confirmedBusArrival =
    plannedBusLeg && liveBus
      ? matchLiveArrival(
          liveBus,
          plannedBusLeg.route_short,
          plannedBusLeg.headsign,
          plannedBusLeg.depart_seconds,
        )
      : null;

  // --- Automatic "approaching your stop" tracking -------------------------
  // No button: whenever the current plan has a transit leg underway, follow it
  // with GPS when granted and fall back to the timetable when it is not.
  const activeTransitLeg = useMemo(() => {
    if (!best || commitment?.mode !== "transit") return null;
    return (
      best.legs.find(
        (leg) =>
          (leg.mode === "bus" || leg.mode === "rail") &&
          leg.depart_seconds !== null &&
          leg.arrive_seconds !== null &&
          nowSeconds >= leg.depart_seconds - 60 &&
          nowSeconds <= leg.arrive_seconds + 60,
      ) ?? null
    );
  }, [best, nowSeconds, commitment?.mode]);

  const { data: legStops = [] } = useQuery({
    queryKey: [
      "leg-stop-sequence",
      activeTransitLeg?.from,
      activeTransitLeg?.to,
      activeTransitLeg?.depart_seconds,
      activeTransitLeg?.route_short,
      activeTransitLeg?.mode,
    ],
    enabled: Boolean(
      activeTransitLeg?.from && activeTransitLeg?.to && activeTransitLeg?.depart_seconds !== null,
    ),
    staleTime: 30 * 60_000,
    queryFn: async () => {
      const leg = activeTransitLeg as Leg;
      const { data, error } = await supabase.rpc("leg_stop_sequence", {
        p_from_name: leg.from as string,
        p_to_name: leg.to as string,
        p_depart_seconds: leg.depart_seconds as number,
        ...(leg.mode === "bus" && leg.route_short ? { p_route_short: leg.route_short } : {}),
        p_rail: leg.mode === "rail",
        // Small schedule variance between the planned leg and the timetable must
        // not leave a rider with no stop list at all.
        p_tolerance_seconds: 300,
      });

      if (error) throw error;
      return (data ?? []).map((row) => ({
        stopId: row.stop_id,
        stopName: row.stop_name ?? "",
        lat: row.stop_lat === null ? null : Number(row.stop_lat),
        lon: row.stop_lon === null ? null : Number(row.stop_lon),
        arriveSeconds: row.arrival_seconds,
        isAlight: row.is_alight,
      }));
    },
  });

  const [riderPoint, setRiderPoint] = useState<Coords | null>(null);
  const [riderHeading, setRiderHeading] = useState<number | null>(null);
  const [riderSpeed, setRiderSpeed] = useState<number | null>(null);
  const [riderAccuracy, setRiderAccuracy] = useState<number | null>(null);
  const riderFixTimestamp = useRef<number | null>(null);
  const acceptedNavFix = useRef<{ point: Coords; timestamp: number } | null>(null);
  const distanceTrend = useRef<number[]>([]);
  // High-accuracy GPS is the biggest battery cost in the app, so it runs only
  // while a saved trip is actually underway — on a bus or train, or on a drive
  // the commuter has committed to — and is released the moment the leg ends,
  // the lock is released, the trip is ended, or the screen unmounts.
  useEffect(() => {
    const trackingWanted =
      (Boolean(activeTransitLeg) || drivingCommitted) && configured && !browseActive;
    if (!trackingWanted || !navigator.geolocation) {
      setRiderPoint(null);
      setRiderHeading(null);
      setRiderSpeed(null);
      setRiderAccuracy(null);
      riderFixTimestamp.current = null;
      return;
    }
    const watch = navigator.geolocation.watchPosition(
      (position) => {
        const point = { lat: position.coords.latitude, lon: position.coords.longitude };
        const nextFix = {
          point,
          timestamp: position.timestamp,
          accuracy: position.coords.accuracy,
        };
        if (!isUsableNavigationFix(acceptedNavFix.current, nextFix)) return;
        acceptedNavFix.current = { point, timestamp: position.timestamp };
        setRiderPoint(point);
        const heading = position.coords.heading;
        setRiderHeading(typeof heading === "number" && !Number.isNaN(heading) ? heading : null);
        const speed = position.coords.speed;
        setRiderSpeed(typeof speed === "number" && !Number.isNaN(speed) ? speed : null);
        setRiderAccuracy(position.coords.accuracy);
        riderFixTimestamp.current = position.timestamp;
      },
      (error) => {
        setRiderPoint(null);
        setRiderHeading(null);
        if (isPermissionDeniedError(error)) recordLocationDenied();
      },
      { enableHighAccuracy: true, maximumAge: 15_000, timeout: 20_000 },
    );
    // Waking from the lock screen: grab a fresh fix right away (the last one
    // may be minutes old, so skip the jump filter) and let the camera ease back.
    const onResume = () => {
      if (document.visibilityState !== "visible") return;
      debugLog("resume");
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const point = { lat: position.coords.latitude, lon: position.coords.longitude };
          if (!Number.isFinite(position.coords.accuracy) || position.coords.accuracy > 80) return;
          acceptedNavFix.current = { point, timestamp: position.timestamp };
          setRiderPoint(point);
          setRiderAccuracy(position.coords.accuracy);
          riderFixTimestamp.current = position.timestamp;
        },
        () => {},
        { enableHighAccuracy: true, maximumAge: 0, timeout: 10_000 },
      );
    };
    document.addEventListener("visibilitychange", onResume);
    window.addEventListener("pageshow", onResume);
    return () => {
      document.removeEventListener("visibilitychange", onResume);
      window.removeEventListener("pageshow", onResume);
      navigator.geolocation.clearWatch(watch);
      setRiderPoint(null);
      setRiderHeading(null);
      setRiderSpeed(null);
      setRiderAccuracy(null);
      riderFixTimestamp.current = null;
      acceptedNavFix.current = null;
    };
  }, [activeTransitLeg, drivingCommitted, configured, browseActive]);

  // Legs change: start the distance history over so an old ride cannot trigger
  // a "passed your stop" notice on the next one.
  const legKey = activeTransitLeg
    ? `${activeTransitLeg.from}-${activeTransitLeg.depart_seconds}`
    : null;
  useEffect(() => {
    distanceTrend.current = [];
  }, [legKey]);

  const alightPoint = useMemo(() => {
    const alight = legStops.find((stop) => stop.isAlight) ?? legStops[legStops.length - 1];
    return alight && alight.lat !== null && alight.lon !== null
      ? { lat: alight.lat, lon: alight.lon }
      : null;
  }, [legStops]);
  useEffect(() => {
    if (!riderPoint || !alightPoint) return;
    const distance = distanceM(riderPoint, alightPoint);
    const trend = distanceTrend.current;
    if (trend[trend.length - 1] !== distance) {
      distanceTrend.current = [...trend, distance].slice(-4);
    }
  }, [riderPoint, alightPoint]);

  const previousApproachState = useRef<ApproachState | null>(null);
  // Where the rider is along the leg, by GPS when available, otherwise by clock.
  const approach = useMemo(() => {
    if (!activeTransitLeg || legStops.length < 2) return null;
    const result = evaluateApproach({
      stops: legStops.map((stop) => ({
        stopName: stop.stopName,
        lat: stop.lat,
        lon: stop.lon,
        arriveSeconds: stop.arriveSeconds,
        isAlight: stop.isAlight,
      })),
      nowSeconds,
      rider: riderPoint,
      distanceTrend: distanceTrend.current,
      previousState: previousApproachState.current,
    });
    if (!result) return null;
    return {
      ...result,
      key: `${activeTransitLeg.from}-${activeTransitLeg.depart_seconds}`,
      vehicle: (activeTransitLeg.mode === "rail" ? "rail" : "bus") as "bus" | "rail",
    };
  }, [activeTransitLeg, legStops, riderPoint, nowSeconds]);
  useEffect(() => {
    previousApproachState.current = approach?.state ?? null;
  }, [approach?.state]);

  useEffect(() => {
    setAlertPrefs(parseAlertPrefs(window.localStorage.getItem(ALERT_PREFS_KEY)));
  }, []);
  function saveAlertPrefs(next: AlertPrefs) {
    setAlertPrefs(next);
    window.localStorage.setItem(ALERT_PREFS_KEY, JSON.stringify(next));
  }

  const [approachDismissed, setApproachDismissed] = useState<string | null>(null);
  const lastPulse = useRef<string | null>(null);
  useEffect(() => {
    if (!approach || (approach.state !== "ready" && approach.state !== "urgent")) return;
    if (!gate.allows("riding_alerts")) return;
    const pulseKey = `${approach.key}-${approach.state}`;
    if (lastPulse.current === pulseKey) return;
    lastPulse.current = pulseKey;
    const urgent = approach.state === "urgent";
    if (alertPrefs.haptics) navigator.vibrate?.(urgent ? [200, 100, 200] : [140, 80, 140]);
    if (alertPrefs.sound) {
      playChime();
      speakCommuteAlert(
        urgent
          ? `Approaching your stop: ${approach.alightName}. Pull cord now.`
          : `Approaching your stop: ${approach.alightName}. Get ready.`,
      );
    }
    postCommuteNotification(
      urgent
        ? `Next stop is yours: ${approach.alightName}`
        : `Pull cord next: ${approach.alightName}`,
      urgent ? "Pull cord now." : "Get ready to exit.",
      `nalu-transit-${approach.key}-${approach.state}`,
    );
  }, [approach, alertPrefs.haptics, alertPrefs.sound]);
  // On a leg change the banner clears unless the rider asked to keep it.
  useEffect(() => {
    if (!alertPrefs.keepOnTransfer) setApproachDismissed(null);
  }, [legKey, alertPrefs.keepOnTransfer]);
  // "Get off in 2 stops" alerts are part of Plus.
  const ridingAlerts = gate.allows("riding_alerts");
  const showApproach =
    ridingAlerts &&
    Boolean(approach) &&
    approachDismissed !== `${approach?.key}-${approach?.state}`;

  // Real driving time between the two points that matter for this direction.
  const driveFrom = tripDirection.from;
  const driveTo = tripDirection.to;
  const rawFetchDriveTime = useServerFn(driveTime);
  const fetchDriveTime = async (
    input: Parameters<typeof rawFetchDriveTime>[0],
  ): Promise<DriveTime> => {
    const result = await rawFetchDriveTime(input);
    if (!result) throw new Error("Drive routing temporarily unavailable");
    return result;
  };
  const lookupOriginAddress = useServerFn(reverseGeocode);
  const {
    data: drive,
    isLoading: driveLoading,
    isError: driveFailed,
  } = useQuery({
    queryKey: ["drive", driveFrom.lat, driveFrom.lon, driveTo.lat, driveTo.lon],
    enabled: hydrated && configured && driveFrom.lat !== null && driveTo.lat !== null,
    // A driver underway gets rolling traffic, congestion and incident updates
    // every 2 minutes; otherwise the slower 5-minute cadence is plenty.
    staleTime: 2 * 60_000,
    refetchInterval: 2 * 60_000,
    refetchIntervalInBackground: false,
    retry: 1,
    queryFn: () =>
      fetchDriveTime({
        data: {
          fromLat: driveFrom.lat as number,
          fromLon: driveFrom.lon as number,
          toLat: driveTo.lat as number,
          toLon: driveTo.lon as number,
          forceRefresh: drivingCommitted || takeForcedTrafficRefresh(),
        },
      }),
  });

  // ---- Live ETA while underway ----------------------------------------------
  // Re-route only after meaningful progress or the two-minute traffic cadence.
  // This avoids GPS jitter at grid boundaries repeatedly replacing a good path.
  const [liveRouteOrigin, setLiveRouteOrigin] = useState<Coords | null>(null);
  const [rerouteRequest, setRerouteRequest] = useState<{
    point: Coords;
    bearing: number | null;
    nonce: number;
  } | null>(null);
  const [rerouting, setRerouting] = useState(false);
  const diagnosticsActive = (drivingCommitted || Boolean(activeTransitLeg)) && configured;
  useEffect(() => {
    if (!diagnosticsActive) return;
    startDebugSession();
    debugLog("trip_start", { mode: drivingCommitted ? "drive" : "transit" });
    const onError = (e: ErrorEvent) => {
      debugLog("error", { message: String(e.message).slice(0, 120) });
      void flushDebugLogs("failure");
    };
    window.addEventListener("error", onError);
    return () => {
      window.removeEventListener("error", onError);
      void endDebugSession("trip_end");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diagnosticsActive]);
  const rerouteTimerRef = useRef<number | null>(null);
  const lastRerouteAtRef = useRef(0);
  const liveOriginRef = useRef<Coords | null>(null);
  useEffect(() => {
    if (riderPoint) liveOriginRef.current = riderPoint;
  }, [riderPoint]);
  useEffect(() => {
    if (!drivingCommitted || !riderPoint) {
      setLiveRouteOrigin(null);
      setRerouteRequest(null);
      setRerouting(false);
      return;
    }
    setLiveRouteOrigin((current) =>
      !current || metersBetween(current, riderPoint) >= 800 ? riderPoint : current,
    );
  }, [drivingCommitted, riderPoint]);
  useEffect(() => {
    if (!drivingCommitted) return;
    const timer = window.setInterval(() => {
      const latest = liveOriginRef.current;
      if (latest) setLiveRouteOrigin(latest);
    }, 2 * 60_000);
    return () => window.clearInterval(timer);
  }, [drivingCommitted]);
  // Race guard: every live re-route is stamped with a sequence number and only
  // the newest response ever reaches the screen, so a slow older TomTom reply
  // can't overwrite a fresher ETA.
  const liveSeqRef = useRef(0);
  const liveAbortRef = useRef<AbortController | null>(null);
  const lastRouteAppliedAtRef = useRef(0);
  const { data: liveDriveRaw, isError: liveDriveFailed } = useQuery({
    queryKey: [
      "live-drive",
      liveRouteOrigin?.lat,
      liveRouteOrigin?.lon,
      driveTo.lat,
      driveTo.lon,
      rerouteRequest?.nonce ?? 0,
    ],
    enabled: hydrated && Boolean(liveRouteOrigin) && driveTo.lat !== null,
    staleTime: 2 * 60_000,
    refetchInterval: 2 * 60_000,
    refetchIntervalInBackground: false,
    placeholderData: (previous) => previous,
    retry: 1,
    queryFn: async () => {
      const origin = liveRouteOrigin;
      if (!origin) throw new Error("No live position yet.");
      const seq = ++liveSeqRef.current;
      // Cancel any older in-flight TomTom request; only the newest fix matters.
      liveAbortRef.current?.abort();
      const controller = new AbortController();
      liveAbortRef.current = controller;
      const result = await fetchDriveTime({
        signal: controller.signal,
        data: {
          fromLat: origin.lat,
          fromLon: origin.lon,
          toLat: driveTo.lat as number,
          toLon: driveTo.lon as number,
          forceRefresh: true,
          ...(rerouteRequest?.bearing === null || rerouteRequest?.bearing === undefined
            ? {}
            : { bearing: rerouteRequest.bearing }),
        },
      });
      return { ...result, seq };
    },
  });
  const [liveDrive, setLiveDrive] = useState<(typeof liveDriveRaw & object) | null>(null);
  useEffect(() => {
    if (!drivingCommitted) {
      setLiveDrive(null);
      liveAbortRef.current?.abort();
      try {
        window.sessionStorage.removeItem(LIVE_ROUTE_CACHE_KEY);
      } catch {
        // storage unavailable
      }
      return;
    }
    if (!liveDriveRaw) {
      // Cellular dropout or reload: fall back to the last good route so the
      // map and HUD keep working.
      setLiveDrive((current) => {
        if (current) return current;
        try {
          const cached = window.sessionStorage.getItem(LIVE_ROUTE_CACHE_KEY);
          return cached ? (JSON.parse(cached) as never) : null;
        } catch {
          return null;
        }
      });
      return;
    }
    setLiveDrive((current) =>
      current && current.seq >= liveDriveRaw.seq ? current : liveDriveRaw,
    );
    lastRouteAppliedAtRef.current = Date.now();
    try {
      window.sessionStorage.setItem(LIVE_ROUTE_CACHE_KEY, JSON.stringify(liveDriveRaw));
    } catch {
      // quota or private mode
    }
    setRerouting(false);
  }, [liveDriveRaw, drivingCommitted]);
  useEffect(() => {
    if (liveDriveFailed) setRerouting(false);
  }, [liveDriveFailed]);
  // Mid-commute rescue advisor: a delay spike of 8+ minutes over the delay at
  // trip start asks Nalu AI to weigh alternate corridors and a Skyline hub.
  const fetchRescue = useServerFn(rescueAdvice);
  const rescueBaseline = useRef<number | null>(null);
  const rescueAsked = useRef(false);
  const [rescue, setRescue] = useState<{ headline: string; spoken: string } | null>(null);
  useEffect(() => {
    if (!drivingCommitted) {
      rescueBaseline.current = null;
      rescueAsked.current = false;
      setRescue(null);
      return;
    }
    if (!liveDrive || !liveRouteOrigin || driveTo.lat === null || driveTo.lon === null) return;
    if (rescueBaseline.current === null) {
      rescueBaseline.current = liveDrive.delayMinutes;
      return;
    }
    const spike = liveDrive.delayMinutes - rescueBaseline.current;
    if (spike < 8 || rescueAsked.current || !gate.allows("traffic_rescue_tips")) return;
    rescueAsked.current = true;
    void fetchRescue({
      data: {
        from: liveRouteOrigin,
        to: { lat: driveTo.lat, lon: driveTo.lon },
        currentMinutes: liveDrive.trafficMinutes,
        spikeMinutes: spike,
        currentRoads: liveDrive.corridorRoads.slice(0, 10).map((r) => r.slice(0, 40)),
      },
    })
      .then((result) => {
        if (!result.ok) return;
        setRescue(result.value);
        postCommuteNotification(result.value.headline, result.value.spoken, "nalu-rescue");
      })
      .catch(() => {});
  }, [liveDrive, drivingCommitted, liveRouteOrigin, driveTo.lat, driveTo.lon, fetchRescue]);
  useWakeLock(Boolean(commitment));
  useEffect(() => {
    track("app_opened");
  }, []);
  const [liveTick, setLiveTick] = useState(() => Date.now());
  useEffect(() => {
    if (!commitment) return;
    setLiveTick(Date.now());
    const timer = window.setInterval(() => setLiveTick(Date.now()), 10_000);
    return () => window.clearInterval(timer);
  }, [commitment]);
  const liveEta = useMemo(() => {
    if (!commitment) return null;
    const tickSeconds = honoluluSeconds(new Date(liveTick));
    if (commitment.mode === "drive") {
      const basis = liveDrive ?? drive;
      if (!basis) return null;
      const elapsedMin = Math.max(0, (liveTick - basis.fetchedAt) / 60_000);
      const remainingMin = Math.max(1, Math.round(basis.trafficMinutes - elapsedMin));
      // Road arrival only, matching the hero clock; parking stays a side note.
      const access = {
        ...destinationAccess(driveTo, arrivingHome ? "home" : null),
        lowMin: 0,
        typicalMin: 0,
        highMin: 0,
      };
      const win = arrivalRange(
        tickSeconds,
        {
          low: Math.max(1, basis.lowMinutes - elapsedMin),
          expected: remainingMin,
          high: Math.max(remainingMin, basis.highMinutes - elapsedMin),
        },
        access,
      );
      return {
        remainingMin,
        arriveSeconds: tickSeconds + remainingMin * 60,
        meters: basis.meters as number | null,
        live: Boolean(liveDrive),
        // A range whose ends read the same minute adds nothing ("1:11 PM – 1:11 PM").
        range:
          clockFromSeconds(win.earliestSeconds) === clockFromSeconds(win.latestSeconds)
            ? null
            : `${clockFromSeconds(win.earliestSeconds)} – ${clockFromSeconds(win.latestSeconds)}`,
      };
    }
    if (!best?.arrive_seconds) return null;
    const remainingMin = Math.max(0, Math.round((best.arrive_seconds - tickSeconds) / 60));
    return {
      remainingMin,
      arriveSeconds: best.arrive_seconds,
      meters: null,
      live: true,
      range: null as string | null,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [commitment, liveDrive, drive, best, liveTick, arrivingHome, driveTo.lat, driveTo.lon]);

  // ---- Heading-up navigation & turn-by-turn voice -----------------------------
  const [navMuted, setNavMuted] = useState(false);
  useEffect(() => {
    if (!commitment || navMuted) return;
    return keepNavigationAudioAlive();
  }, [commitment, navMuted]);
  useEffect(() => {
    if (rescue && !navMuted) speakCommuteAlert(rescue.spoken, "safety");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rescue]);
  const mapboxToken = import.meta.env["VITE_LOVABLE_CONNECTOR_MAPBOX_PUBLIC_TOKEN"] as
    string | undefined;
  const headingUpNav = Boolean(commitment && mapboxToken);
  // Full-screen navigation owns every gesture: stop the page behind it from scrolling.
  useEffect(() => {
    if (!headingUpNav) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [headingUpNav]);
  const navBasis = drivingCommitted ? (liveDrive ?? drive) : null;
  const navPath = navBasis?.path ?? [];
  const [navBearing, setNavBearing] = useState<number | null>(null);
  const lastNavPoint = useRef<Coords | null>(null);
  useEffect(() => {
    if (!drivingCommitted || !riderPoint) return;
    const routeBearing = routeBearingAt(navPath, riderPoint);
    setNavBearing((previous) =>
      smoothBearing(previous, {
        gpsHeading: riderHeading,
        speedMps: riderSpeed,
        from: lastNavPoint.current,
        to: riderPoint,
        routeBearing,
      }),
    );
    // Keep the anchor until the car has moved 8 m, so slow city driving still
    // yields a direction (positions a second apart can be closer than that).
    if (!lastNavPoint.current || metersBetween(lastNavPoint.current, riderPoint) >= 8)
      lastNavPoint.current = riderPoint;
  }, [riderPoint, riderHeading, riderSpeed, drivingCommitted, navPath]);
  const handleRouteStateChange = useCallback(
    (state: { offRoute: boolean; crossTrackM: number; headingDivergence: number | null }) => {
      if (!drivingCommitted || !riderPoint) return;
      if (!state.offRoute) {
        if (rerouteTimerRef.current !== null) {
          window.clearTimeout(rerouteTimerRef.current);
          rerouteTimerRef.current = null;
          setRerouting(false);
        }
        return;
      }
      if (rerouting) return;
      // 5 s cooldown after a route lands, so overpass GPS jitter can't loop.
      if (Date.now() - lastRouteAppliedAtRef.current < 5_000) return;
      if (Date.now() - lastRerouteAtRef.current < 5_000) return;
      if (rerouteTimerRef.current !== null) return;
      setRerouting(true);
      debugLog("off_route", {
        crossTrackM: state.crossTrackM,
        headingDivergence: state.headingDivergence,
        speedMps: riderSpeed,
      });
      rerouteTimerRef.current = window.setTimeout(() => {
        rerouteTimerRef.current = null;
        const latest = liveOriginRef.current;
        if (!latest) {
          setRerouting(false);
          return;
        }
        lastRerouteAtRef.current = Date.now();
        setLiveRouteOrigin(latest);
        setRerouteRequest({ point: latest, bearing: navBearing, nonce: Date.now() });
      }, 1_200);
    },
    [drivingCommitted, riderPoint, rerouting, navBearing, riderSpeed],
  );
  useEffect(
    () => () => {
      if (rerouteTimerRef.current !== null) window.clearTimeout(rerouteTimerRef.current);
    },
    [],
  );
  // Corridor pins: Skyline stations (from the feed) that the drive passes
  // within ~150 m, spaced apart so the map never gets cluttered.
  const corridorLandmarks = useMemo(() => {
    const route = (liveDrive ?? drive)?.path ?? [];
    if (route.length < 2 || railLine.length === 0) return [];
    const picked: Array<{ id: string; lat: number; lon: number; label: string }> = [];
    for (const station of railLine) {
      const pt = { lat: Number(station.stop_lat), lon: Number(station.stop_lon) };
      const near = route.some((p, i) => i % 3 === 0 && metersBetween(p, pt) < 150);
      if (!near) continue;
      if (picked.some((p) => metersBetween(p, pt) < 3000)) continue;
      picked.push({ id: station.stop_id, ...pt, label: station.stop_name ?? "" });
      if (picked.length === 4) break;
    }
    return picked;
  }, [liveDrive, drive, railLine]);

  const passedTurns = useRef(new Set<string>());
  const voiceGuide = useRef(new VoiceGuide());
  useEffect(() => {
    if (drivingCommitted) return;
    clearCommuteSpeech();
    passedTurns.current = new Set();
    voiceGuide.current = new VoiceGuide();
    lastNavPoint.current = null;
    setNavBearing(null);
  }, [drivingCommitted]);
  const nextTurn = useMemo(
    () =>
      navBasis && riderPoint
        ? nextManeuver(riderPoint, navBasis.maneuvers ?? [], passedTurns.current)
        : null,
    [navBasis, riderPoint],
  );
  useEffect(() => {
    // A reroute brings a new maneuver list: reset turn state so no new turn is skipped.
    if (voiceGuide.current.sync(navBasis?.maneuvers ?? [])) passedTurns.current = new Set();
  }, [navBasis]);
  useEffect(() => {
    if (!drivingCommitted || !nextTurn) return;
    // Record thresholds even while muted so unmuting never replays old turns.
    const phrase = voiceGuide.current.next(nextTurn, Date.now(), {
      speedMps: riderSpeed,
      rerouting,
      gpsAccuracyM: riderAccuracy,
      fixAgeMs:
        riderFixTimestamp.current === null
          ? null
          : Math.max(0, Date.now() - riderFixTimestamp.current),
    });
    if (phrase)
      debugLog("voice", {
        distanceM: nextTurn.distanceM,
        muted: navMuted,
        maneuver: nextTurn.maneuver.maneuver,
        road: nextTurn.maneuver.road,
        tier: voiceGuide.current.lastTier,
        speedMps: riderSpeed,
      });
    if (phrase && !navMuted) speakCommuteAlert(phrase, "maneuver");
  }, [nextTurn, drivingCommitted, navMuted, riderSpeed, riderAccuracy, rerouting]);

  const previousTraffic = useRef<TrafficAlertSnapshot | null>(null);
  const trafficAlertBaseline = useRef<TrafficAlertSnapshot | null>(null);
  useEffect(() => {
    if (!drivingCommitted || !drive || drive.trafficBasis !== "live") {
      previousTraffic.current = null;
      trafficAlertBaseline.current = null;
      return;
    }
    const current: TrafficAlertSnapshot = {
      delayMinutes: drive.delayMinutes,
      incidentKeys: drive.incidents.map(
        (incident) =>
          `${incident.description.trim().toLowerCase()}|${incident.road?.trim().toLowerCase() ?? ""}`,
      ),
    };
    const change = detectTrafficAlert(
      previousTraffic.current,
      current,
      trafficAlertBaseline.current,
    );
    if (!trafficAlertBaseline.current) trafficAlertBaseline.current = current;
    previousTraffic.current = current;
    if (!change) return;
    // Acknowledging this alert starts a new comparison window, preventing the
    // same cumulative increase from being announced at every refresh.
    trafficAlertBaseline.current = current;

    // Live traffic updates while driving are part of Plus.
    if (!gate.allows("traffic_rescue_tips")) return;
    const corridor =
      drive.corridorLabel?.replace(/^Via\s+/i, "") || drive.incidents[0]?.road || "your route";
    const message =
      change.kind === "delay"
        ? `Traffic update: delay increased on ${corridor} by ${change.increaseMinutes} minutes.`
        : `Traffic alert: reported incident on ${corridor}.`;
    if (alertPrefs.sound) {
      playChime();
      speakCommuteAlert(message, "traffic");
    }
    if (alertPrefs.haptics) navigator.vibrate?.([180, 100, 180]);
    postCommuteNotification(
      change.kind === "delay"
        ? `Traffic Alert: +${change.increaseMinutes}m delay on ${corridor}`
        : `Traffic Alert on ${corridor}`,
      change.kind === "delay"
        ? "Live delay increased on your route."
        : "A new incident was reported on your route.",
      `nalu-drive-${change.kind}-${drive.fetchedAt}`,
    );
  }, [drivingCommitted, drive, alertPrefs.haptics, alertPrefs.sound]);

  // ---- "Arrive by" planning -------------------------------------------------
  // Work backwards from the target time to the latest honest departure for each
  // mode, using the same TomTom drive time and GTFS itineraries as Leave now.
  const arriveByActive = planMode === "arrive-by" && arriveByTarget !== null;
  const arriveByPassed = arriveByActive && arriveByTarget < nowSeconds;
  const transitPick = useMemo(() => {
    if (arriveByTarget === null) return null;
    // Prefer trips without transfers that aren't worth it; fall back to them
    // only when nothing else makes the arrival time.
    const preferred = latestTransitArrival(
      options.filter((option) => !option.extraTransfers),
      arriveByTarget,
    );
    return preferred.feasible ? preferred : latestTransitArrival(options, arriveByTarget);
  }, [options, arriveByTarget]);
  const gtfsExpiry = useDataExpiry();
  const driveAccess = destinationAccess(driveTo, arrivingHome ? "home" : null, now);
  const futureCandidateSeconds =
    arriveByActive && settledTrafficTarget === arriveByTarget && drive
      ? arriveByTarget - (drive.highMinutes + driveAccess.highMin) * 60
      : null;
  const futureDepartureIso =
    futureCandidateSeconds !== null && !arriveByPassed && futureCandidateSeconds > nowSeconds
      ? honoluluSecondsToIso(futureCandidateSeconds, now)
      : null;
  const { data: futureDriveResult } = useQuery({
    queryKey: [
      "drive-future",
      driveFrom.lat,
      driveFrom.lon,
      driveTo.lat,
      driveTo.lon,
      futureDepartureIso,
      drive?.fetchedAt,
    ],
    enabled: Boolean(futureDepartureIso && driveAvailable && configured),
    staleTime: 5 * 60_000,
    retry: false,
    queryFn: async ({ signal }) => {
      // Query keys can change again during a refresh. Serialize even those
      // requests and cancel a waiting lookup when its old target is discarded.
      while (true) {
        if (signal.aborted) throw new Error("Future traffic lookup canceled");
        const currentTime = Date.now();
        if (futureTrafficWindow.current.tryAcquire(currentTime)) break;
        await new Promise<void>((resolve, reject) => {
          const cancel = () => {
            window.clearTimeout(timer);
            reject(new Error("Future traffic lookup canceled"));
          };
          const timer = window.setTimeout(() => {
            signal.removeEventListener("abort", cancel);
            resolve();
          }, futureTrafficWindow.current.remainingMs(currentTime));
          signal.addEventListener("abort", cancel, { once: true });
        });
      }
      if (signal.aborted) throw new Error("Future traffic lookup canceled");
      return solveFutureDrive({
        targetSeconds: arriveByTarget as number,
        nowSeconds,
        initial: drive as DriveTime,
        access: driveAccess,
        fetchAt: (departureSeconds) => {
          if (signal.aborted) throw new Error("Future traffic lookup canceled");
          return fetchDriveTime({
            data: {
              fromLat: driveFrom.lat as number,
              fromLon: driveFrom.lon as number,
              toLat: driveTo.lat as number,
              toLon: driveTo.lon as number,
              departureTime: honoluluSecondsToIso(departureSeconds, now),
            },
          });
        },
      });
    },
  });
  const futureDrive = futureDriveResult?.iterations ? futureDriveResult.sample : null;
  const arriveByDrive = futureDrive ?? drive;
  // Be honest about where a drive time comes from: measured now, or projected
  // for a later departure from TomTom's historic profile.
  const driveBasisLabel =
    futureDrive?.trafficBasis === "future-estimate"
      ? `Drive time: TomTom future estimate for a ${clockFromSeconds(futureDriveResult?.candidateSeconds ?? nowSeconds)} departure${futureDriveResult?.converged ? "" : " (approximate)"}`
      : arriveByActive && drive
        ? "Drive time: current TomTom traffic used as a fallback; future conditions may differ"
        : drive?.trafficBasis === "live"
          ? "Drive time: TomTom live traffic"
          : "Drive time: TomTom";

  const drivePlan = useMemo(
    () =>
      arriveByTarget === null || !arriveByDrive || !driveAvailable
        ? null
        : planDriveArrivalWithRange(arriveByTarget, arriveByDrive, driveAccess, nowSeconds, {
            estimated: Boolean(futureDrive),
            converged: futureDriveResult?.converged,
            iterations: futureDriveResult?.iterations,
            futureFailed: futureDriveResult?.futureFailed,
          }),
    [
      arriveByTarget,
      arriveByDrive,
      driveAvailable,
      driveAccess,
      nowSeconds,
      futureDrive,
      futureDriveResult,
    ],
  );
  const arrivalDriveEstimate = driveEstimate({
    drive: arriveByDrive ?? null,
    access: driveAccess,
    nowSeconds,
    nowMs: now.getTime(),
    leaveAtSeconds: drivePlan?.leaveBySeconds ?? nowSeconds,
    carAvailable: driveAvailable,
    failed: driveFailed,
    targetArrivalSeconds: arriveByTarget,
    ...(arriveByActive &&
    (!futureDrive || !futureDriveResult?.converged || futureDriveResult.futureFailed)
      ? { qualityOverride: "limited" as const }
      : {}),
  });
  const arrivalTransitEstimate = transitEstimate({
    option: transitPick?.option ?? null,
    nowSeconds,
    nowMs: now.getTime(),
    scheduleFetchedAt: optionsFetchedAt || null,
    failed: optionsFailed,
    targetArrivalSeconds: arriveByTarget,
    feedExpired: gtfsExpiry !== null && gtfsExpiry.daysRemaining < 0,
    liveBusFetchedAt: confirmedBusArrival ? (liveBus?.fetchedAt ?? null) : null,
  });
  const arriveByComparison =
    arriveByTarget === null
      ? null
      : decideArrival(arrivalDriveEstimate, arrivalTransitEstimate, arriveByTarget);

  // In arrive-by mode the itinerary shown is the latest one that still makes it,
  // unless the rider tapped a way to travel (that card keeps its own trip).
  const arriveByLeaveBy =
    arriveByActive && transitPick?.option ? optionIdentity(transitPick.option) : null;
  useEffect(() => {
    if (arriveByLeaveBy !== null && chosenCard === null) setSelectedDeparture(arriveByLeaveBy);
  }, [arriveByLeaveBy, chosenCard]);

  // A saved place with a typical arrival time pre-fills the target once.
  const activeSavedPlace = useMemo(() => {
    if (setup.destLat === null || setup.destLon === null) return null;
    return (
      savedPlaces.find(
        (place) =>
          distanceM(place, { lat: setup.destLat as number, lon: setup.destLon as number }) < 120,
      ) ?? null
    );
  }, [savedPlaces, setup.destLat, setup.destLon]);
  const typicalArrival = arrivingHome ? null : (activeSavedPlace?.typicalArrivalSeconds ?? null);
  useEffect(() => {
    if (!hydrated || arriveByInput || typicalArrival === null) return;
    chooseArriveBy(clockInputValue(typicalArrival));
  }, [hydrated, arriveByInput, typicalArrival]);

  const {
    data: eastboundTraffic,
    isLoading: eastboundTrafficLoading,
    isError: eastboundTrafficFailed,
    refetch: refetchEastboundTraffic,
  } = useQuery({
    queryKey: ["browse-h1", "eastbound"],
    enabled: hydrated,
    staleTime: 2 * 60_000,
    refetchInterval: 2 * 60_000,
    retry: 1,
    queryFn: () =>
      fetchDriveTime({
        data: {
          fromLat: KAPOLEI_POINT.lat,
          fromLon: KAPOLEI_POINT.lon,
          toLat: DOWNTOWN_POINT.lat,
          toLon: DOWNTOWN_POINT.lon,
          forceRefresh: takeForcedTrafficRefresh(),
        },
      }),
  });

  const {
    data: westboundTraffic,
    isLoading: westboundTrafficLoading,
    isError: westboundTrafficFailed,
    refetch: refetchWestboundTraffic,
  } = useQuery({
    queryKey: ["browse-h1", "westbound"],
    enabled: hydrated,
    staleTime: 2 * 60_000,
    refetchInterval: 2 * 60_000,
    retry: 1,
    queryFn: () =>
      fetchDriveTime({
        data: {
          fromLat: DOWNTOWN_POINT.lat,
          fromLon: DOWNTOWN_POINT.lon,
          toLat: KAPOLEI_POINT.lat,
          toLon: KAPOLEI_POINT.lon,
          forceRefresh: takeForcedTrafficRefresh(),
        },
      }),
  });

  // Real service hours for the rail station, used when nothing is reachable.
  const { data: railHours = [] } = useQuery({
    queryKey: ["service-hours", inbound ? arrivalStationId : setup.homeStopId],
    // Service hours are independent of trip-planning results. Fetch them immediately
    // so Nalu can explain a closed rail service window instead of waiting on a
    // timetable query that can never return an option after service has ended.
    enabled: hydrated && Boolean(inbound ? arrivalStationId : setup.homeStopId),
    staleTime: 12 * 60 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("service_hours", {
        p_stop_id: (inbound ? arrivalStationId : setup.homeStopId) as string,
        p_route_type: 1,
      });
      if (error) throw error;
      return data ?? [];
    },
  });

  const todayHours = railHours.find((row) => row.dow === honoluluIsoDow(now));
  const railServiceClosed = Boolean(
    todayHours &&
    (nowSeconds >= Number(todayHours.last_seconds) ||
      nowSeconds < Number(todayHours.first_seconds)),
  );
  const railClosedForEvening = Boolean(todayHours && nowSeconds >= Number(todayHours.last_seconds));
  const railNotRunningYet = Boolean(todayHours && nowSeconds < Number(todayHours.first_seconds));
  // Rail total carries a safety buffer, and a range for transfers that slip.
  const driveTripEstimate = driveEstimate({
    drive: drive ?? null,
    access: driveAccess,
    nowSeconds,
    nowMs: now.getTime(),
    carAvailable: driveAvailable,
    failed: driveFailed,
    majorIncident: Boolean(drive?.incidents[0]),
  });
  // The drive time riders see is door to door (road time in live traffic plus
  // parking and the walk in), the same number the verdict uses. Road time alone
  // is only shown labelled as such.
  const driveDoorToDoorMinutes =
    driveTripEstimate.doorToDoorMinutes ?? driveTripEstimate.expectedDurationMinutes;
  const transitTripEstimate = transitEstimate({
    option: best ?? null,
    nowSeconds,
    nowMs: now.getTime(),
    scheduleFetchedAt: optionsFetchedAt || null,
    failed: optionsFailed,
    feedExpired: gtfsExpiry !== null && gtfsExpiry.daysRemaining < 0,
    liveBusFetchedAt: confirmedBusArrival ? (liveBus?.fetchedAt ?? null) : null,
  });
  const transitMinutes = transitTripEstimate.expectedDurationMinutes;
  const transitRange =
    transitTripEstimate.availability === "available"
      ? {
          low: Math.round(((transitTripEstimate.earliestArrival as number) - nowSeconds) / 60),
          high: Math.round(((transitTripEstimate.latestArrival as number) - nowSeconds) / 60),
        }
      : null;
  const itineraryRange =
    arriveByActive && best
      ? {
          low: best.total_minutes,
          high: best.total_minutes,
        }
      : transitRange;
  const driveArrival = drive
    ? arrivalRange(
        nowSeconds,
        { low: drive.lowMinutes, expected: drive.trafficMinutes, high: drive.highMinutes },
        driveAccess,
      )
    : null;
  const driveBufferNote =
    driveAccess.highMin > 0
      ? `Includes about ${driveAccess.typicalMin} min to park and walk in`
      : null;
  const driveWindow = driveArrival
    ? `${clockFromSeconds(driveArrival.earliestSeconds)} – ${clockFromSeconds(driveArrival.latestSeconds)}`
    : null;
  const driveRange =
    driveTripEstimate.availability === "available"
      ? {
          low: Math.round(((driveTripEstimate.earliestArrival as number) - nowSeconds) / 60),
          high: Math.round(((driveTripEstimate.latestArrival as number) - nowSeconds) / 60),
        }
      : null;
  const transitWindow =
    best &&
    transitTripEstimate.earliestArrival !== null &&
    transitTripEstimate.latestArrival !== null
      ? transitTripEstimate.earliestArrival === transitTripEstimate.latestArrival
        ? `${clockFromSeconds(transitTripEstimate.latestArrival)} (scheduled)`
        : `${clockFromSeconds(transitTripEstimate.earliestArrival)} – ${clockFromSeconds(transitTripEstimate.latestArrival)}`
      : null;
  const leaveIn = best ? Math.round((best.leave_by_seconds - nowSeconds) / 60) : null;
  const decisionKey = `${planMode}:${inbound}:${setup.homeLat}:${setup.homeLon}:${setup.destLat}:${setup.destLon}`;
  const previousVerdict =
    decisionHistoryRef.current?.key === decisionKey && decisionHistoryRef.current.state !== "same"
      ? decisionHistoryRef.current.state
      : null;
  const previousDecisionSnapshot =
    decisionHistoryRef.current?.key === decisionKey ? decisionHistoryRef.current.snapshot : null;
  // ---- Outdoor conditions --------------------------------------------------
  // Every moment of this trip spent outside: where it happens, when, how long.
  // Memoized so trip memos below don't recompute on every render.
  const homePoint = useMemo(
    () =>
      setup.homeLat !== null && setup.homeLon !== null
        ? { lat: setup.homeLat, lon: setup.homeLon }
        : null,
    [setup.homeLat, setup.homeLon],
  );
  const destPoint = useMemo(
    () =>
      setup.destLat !== null && setup.destLon !== null
        ? { lat: setup.destLat, lon: setup.destLon }
        : null,
    [setup.destLat, setup.destLon],
  );

  const centralTrip = useMemo(() => {
    // Follow the actual direction of travel (Work -> Home on the way back).
    const { from, to } = tripDirection;
    if (from.lat == null || from.lon == null || to.lat == null || to.lon == null) return null;

    const origin = { latitude: from.lat, longitude: from.lon };
    const destination = { latitude: to.lat, longitude: to.lon };
    const constraint =
      arriveByTarget !== null
        ? { type: "arrive-by" as const, timestamp: arriveByTarget }
        : { type: "now" as const };

    return createCanonicalTrip({
      origin,
      destination,
      constraint,
      requestedAt: nowSeconds,
      selectedRouteId: null,
      routes: [driveTripEstimate, transitTripEstimate].map((estimate) => ({
        id: `${estimate.mode}-route`,
        mode: estimate.mode,
        segments: [
          {
            id: `${estimate.mode}-estimate`,
            mode: estimate.mode,
            origin,
            destination,
            departureTime: estimate.leaveTime,
            arrivalTime: estimate.arrivalTime,
            durationMinutes: estimate.expectedDurationMinutes,
            distanceMeters: null,
            routeGeometry: [],
            source: estimate.source.name,
            observedAt:
              estimate.source.fetchedAt === null ? null : estimate.source.fetchedAt / 1000,
            quality:
              estimate.source.quality === "good"
                ? "current"
                : estimate.source.quality === "limited"
                  ? "limited"
                  : estimate.source.quality === "stale"
                    ? "stale"
                    : "unavailable",
            notes: [],
          },
        ],
        departureTime: estimate.leaveTime,
        arrivalTime: estimate.arrivalTime,
        durationMinutes: estimate.expectedDurationMinutes,
        transferCount: estimate.transferMinutes > 0 ? 1 : 0,
        walkingMinutes: estimate.walkingMinutes,
        source: estimate.source.name,
      })),
    });
  }, [
    tripDirection.from.lat,
    tripDirection.from.lon,
    tripDirection.to.lat,
    tripDirection.to.lon,
    arriveByTarget,
    nowSeconds,
    driveTripEstimate,
    transitTripEstimate,
  ]);

  const centralVerdict = useMemo(
    () =>
      centralTrip === null
        ? null
        : createNaluVerdict({
            trip: centralTrip,
            estimates: [driveTripEstimate, transitTripEstimate].map((estimate) => ({
              mode: estimate.mode === "drive" ? "drive" : "transit",
              transitMode: estimate.transitMode,
              label: estimate.transitLabel,
              availability: estimate.availability,
              quality: estimate.source.quality === "good" ? "good" : estimate.source.quality,
              expectedMinutes: estimate.doorToDoorMinutes ?? estimate.expectedDurationMinutes,
              leaveTime: estimate.leaveTime,
              arrivalTime: estimate.arrivalTime,
              earliestArrival: estimate.earliestArrival,
              latestArrival: estimate.latestArrival,
              uncertaintyMinutes: estimate.uncertaintyMinutes,
              trafficDelayMinutes: estimate.trafficDelayMinutes,
              majorIncident: estimate.majorIncident,
              eligible: estimate.mode === "drive" ? driveAvailable : undefined,
              railWaitMinutes: estimate.railWaitMinutes,
              busWaitMinutes: estimate.busWaitMinutes,
              transferMinutes: estimate.transferMinutes,
              tightestConnectionMinutes: estimate.tightestConnectionMinutes ?? null,
            })),
            previousMode: previousVerdict,
            tossUpMinutes: TOSS_UP_MIN,
          }),
    [centralTrip, driveTripEstimate, transitTripEstimate, previousVerdict, driveAvailable],
  );

  const activeDecision =
    arriveByActive && arriveByComparison
      ? arriveByComparison
      : centralVerdict
        ? {
            state: centralVerdict.decisionState as DecisionState,
            confidence:
              centralVerdict.confidence === "medium"
                ? "moderate"
                : (centralVerdict.confidence ?? "low"),
            differenceMinutes: verdictMarginMinutes(
              centralVerdict.decisionState as DecisionState,
              driveTripEstimate.doorToDoorMinutes ?? driveTripEstimate.expectedDurationMinutes,
              transitTripEstimate.expectedDurationMinutes,
            ),
            primary: {
              kind:
                (centralVerdict.reasons[0]
                  ?.evidence?.[0] as import("@/lib/intelligence/drive-transit-decision").EvidenceKind) ??
                "data_quality",
              text: centralVerdict.reasons[0]?.text ?? "Nalu could not establish a clear advantage",
            },
            supporting: centralVerdict.reasons[1]
              ? {
                  kind:
                    (centralVerdict.reasons[1]
                      .evidence?.[0] as import("@/lib/intelligence/drive-transit-decision").EvidenceKind) ??
                    "data_quality",
                  text: centralVerdict.reasons[1].text,
                }
              : null,
          }
        : {
            state: "uncertain" as DecisionState,
            confidence: "low",
            differenceMinutes: null,
            primary: {
              kind: "data_quality",
              text: "Nalu is waiting for enough route information",
            },
            supporting: null,
          };

  const moments = useMemo<OutdoorMoment[]>(() => {
    if (!best) return [];
    const originPoint = reverseTrip ? destPoint : homePoint;
    const arrivalPoint = reverseTrip ? homePoint : destPoint;
    const railLegHere = best.legs.find((leg) => leg.kind === "rail") ?? null;
    const boardStation = stationPoint(railLegHere?.from, railLegHere?.from_stop_id);
    const transferStation = stationPoint(railLegHere?.to, railLegHere?.to_stop_id);
    const list: OutdoorMoment[] = [];

    best.legs.forEach((leg, legIndex) => {
      const previous = best.legs[legIndex - 1];
      const start = previous?.arrive_seconds ?? best.leave_by_seconds;
      const waitMinutes = Math.max(0, Math.round(((leg.depart_seconds ?? start) - start) / 60));
      const offset = Math.max(0, Math.round(((leg.depart_seconds ?? start) - nowSeconds) / 60));

      if (leg.kind === "access" && leg.mode === "bus" && originPoint) {
        list.push({
          id: `wait-feeder-${legIndex}`,
          legIndex,
          kind: "wait-feeder",
          ...originPoint,
          offsetMinutes: offset,
          outdoorMinutes: waitMinutes,
        });
        return;
      }
      if (leg.kind === "access" && leg.mode === "drive" && boardStation) {
        list.push({
          id: `drive-station-${legIndex}`,
          legIndex,
          kind: "drive-station",
          ...boardStation,
          offsetMinutes: Math.max(0, Math.round(((leg.arrive_seconds ?? start) - nowSeconds) / 60)),
          outdoorMinutes: 0,
          label: titleCase(leg.to) || stationLabel(setup.homeStopName),
        });
        return;
      }
      if (leg.kind === "rail" && boardStation) {
        list.push({
          id: `platform-${legIndex}`,
          legIndex,
          kind: "platform",
          ...boardStation,
          offsetMinutes: offset,
          outdoorMinutes: waitMinutes,
        });
        return;
      }
      if (leg.mode === "walk" && leg.kind === "connect" && transferStation) {
        list.push({
          id: `transfer-walk-${legIndex}`,
          legIndex,
          kind: "transfer-walk",
          ...transferStation,
          offsetMinutes: offset,
          outdoorMinutes: leg.minutes ?? 0,
          minutes: leg.minutes ?? 0,
        });
        return;
      }
      if (leg.mode === "bus" && leg.kind !== "access") {
        const point = transferStation ?? originPoint;
        if (!point) return;
        list.push({
          id: `wait-connect-${legIndex}`,
          legIndex,
          kind: "wait-connect",
          ...point,
          offsetMinutes: offset,
          outdoorMinutes: waitMinutes,
          label: leg.route_short ?? null,
        });
        return;
      }
      if (leg.mode === "walk" && leg.kind === "egress" && arrivalPoint) {
        list.push({
          id: `final-walk-${legIndex}`,
          legIndex,
          kind: "final-walk",
          ...arrivalPoint,
          offsetMinutes: offset,
          outdoorMinutes: leg.minutes ?? 0,
          minutes: leg.minutes ?? 0,
        });
      }
    });

    // The drive itself: the corridor between the two ends of the trip.
    if (originPoint && arrivalPoint) {
      list.push({
        id: "drive-route",
        legIndex: -2,
        kind: "drive-route",
        lat: (originPoint.lat + arrivalPoint.lat) / 2,
        lon: (originPoint.lon + arrivalPoint.lon) / 2,
        offsetMinutes: 0,
        outdoorMinutes: 0,
      });
    }
    return list;
  }, [best, reverseTrip, homePoint, destPoint, nowSeconds, stationPoint, setup.homeStopName]);

  const fetchWeather = useServerFn(outdoorConditions);
  // Runs alongside the plan, never in front of it: the trip renders regardless.
  const { data: weather } = useQuery({
    queryKey: [
      "weather",
      moments.map(
        (moment) =>
          `${moment.id}:${moment.lat.toFixed(2)},${moment.lon.toFixed(2)}:${moment.offsetMinutes}`,
      ),
    ],
    enabled: moments.length > 0,
    staleTime: 20 * 60_000,
    refetchInterval: 20 * 60_000,
    retry: false,
    queryFn: () => {
      const longest = moments
        .filter((moment) => moment.outdoorMinutes > 5)
        .sort((a, b) => b.outdoorMinutes - a.outdoorMinutes)[0];
      return fetchWeather({
        data: {
          points: moments.map((moment) => ({
            id: moment.id,
            lat: moment.lat,
            lon: moment.lon,
            offsetMinutes: moment.offsetMinutes,
          })),
          airLat: longest?.lat ?? null,
          airLon: longest?.lon ?? null,
        },
      });
    },
  });

  // One line per condition, hung on the leg it belongs to.
  const weatherLines = useMemo(() => {
    const byLeg = new Map<number, WeatherLine[]>();
    if (!weather) return byLeg;
    const readings = new Map(weather.moments.map((moment) => [moment.id, moment]));
    // Air quality is said once, on the longest stretch spent outside.
    const airMoment = moments
      .filter((moment) => moment.outdoorMinutes > 5)
      .sort((a, b) => b.outdoorMinutes - a.outdoorMinutes)[0];

    // Heat and humidity barely change across one trip: say each reading once,
    // on the first stretch outside, instead of on every leg.
    const heatSaid = new Set<string>();
    for (const moment of moments) {
      const reading = readings.get(moment.id);
      if (!reading) continue;
      const lines: WeatherLine[] = [];
      const rain = rainLine(moment, reading);
      if (rain) lines.push({ text: rain, tone: "rain", source: "NWS" });
      const heat = heatLine(moment, reading);
      const heatKey = heat?.text.replace(/^[^·]*·\s*/, "");
      if (heat && heatKey && !heatSaid.has(heatKey)) {
        heatSaid.add(heatKey);
        lines.push(heat);
      }
      if (airMoment && moment.id === airMoment.id) {
        const air = airLine(weather.air?.category ?? 0);
        if (air) lines.push(air);
      }
      if (!lines.length) continue;
      byLeg.set(moment.legIndex, [...(byLeg.get(moment.legIndex) ?? []), ...lines]);
    }
    return byLeg;
  }, [weather, moments]);

  const driveWeatherLines = weatherLines.get(-2) ?? [];

  // Canonical decision state is Drive vs Transit. The UI still uses "rail"
  // as its transit-view key for compatibility with the existing transit panels;
  // this adapter keeps that legacy UI vocabulary out of the decision engine.
  const canonicalVerdict =
    commitment?.mode === "transit"
      ? "transit"
      : (commitment?.mode ??
        (optionsLoading || driveLoading ? "uncertain" : (activeDecision?.state ?? "uncertain")));
  const verdict: UiDecisionState = canonicalVerdict as UiDecisionState;

  useEffect(() => {
    setChosenCard(null);
  }, [tripDirection.to.lat, tripDirection.to.lon, inbound]);

  // Drive / Park & ride / No car, side by side inside the verdict card. Both
  // transit choices come from the planner's own ordered list; tapping one
  // selects that trip. Leaving now, every row counts from now to arrival (drive
  // door to door), the same numbers the headline compares; for Arrive By each
  // row shows its trip length and when to leave.
  const choiceKeyFor = (option: Option | null | undefined): TripChoiceKey =>
    option && needsCar(option) ? "parkAndRide" : "noCar";
  const selectedChoice: TripChoiceKey = selectedMode === "drive" ? "drive" : choiceKeyFor(best);
  // Nalu's pick is its own answer, so it doesn't move when a rider taps a row.
  const computedPick: TripChoiceKey | null =
    verdict === "drive" ? "drive" : verdict === "transit" ? choiceKeyFor(best) : null;
  const [naluPick, setNaluPick] = useState<TripChoiceKey | null>(null);
  useEffect(() => {
    if (chosenCard === null && !commitment) setNaluPick(computedPick);
  }, [computedPick, chosenCard, commitment]);
  const lockedChoice: TripChoiceKey | null =
    lockedMode === "drive" ? "drive" : lockedMode === "transit" ? choiceKeyFor(best) : null;
  const transitChoice = (key: "parkAndRide" | "noCar"): TripChoice => {
    const group = key === "parkAndRide" ? choicePicks.parkAndRide : choicePicks.noCar;
    // A committed trip shows the boarded itinerary, not a fresher option.
    const option = lockedChoice === key && best ? best : group.option;
    return {
      key,
      title: key === "parkAndRide" ? "Park & ride" : "No car",
      steps: option ? tripSteps(option) : null,
      minutes: option
        ? arriveByActive
          ? option.total_minutes
          : Math.max(0, Math.round((option.arrive_seconds - nowSeconds) / 60))
        : null,
      timeLabel: option
        ? arriveByActive
          ? `Leave ${clockFromSeconds(option.leave_by_seconds)}`
          : `Arrive ${clockFromSeconds(option.arrive_seconds)}`
        : null,
      late: arriveByActive && option !== null && !group.makesIt && lockedChoice !== key,
      status: option ? "ready" : optionsLoading ? "loading" : "empty",
      emptyText: optionsFailed
        ? "Can’t check transit right now"
        : key === "noCar"
          ? "No trip without a car right now"
          : "No park & ride trip that makes sense right now",
      note: key === "parkAndRide" ? parkingNote(option, honoluluIsoDow(now)) : null,
      pick: naluPick === key,
      locked: lockedChoice === key,
    };
  };
  const driveChoiceMinutes =
    arriveByActive && drivePlan
      ? Math.round((drivePlan.arriveSeconds - drivePlan.leaveBySeconds) / 60)
      : driveDoorToDoorMinutes;
  const tripChoices: TripChoice[] = [
    {
      key: "drive",
      title: "Drive",
      steps: drive?.corridorLabel
        ? `Via ${drive.corridorLabel.replace(/^Via\s+/i, "")}`
        : "Driving",
      minutes: driveChoiceMinutes,
      timeLabel:
        arriveByActive && drivePlan
          ? `Leave ${clockFromSeconds(drivePlan.leaveBySeconds)}`
          : driveTripEstimate.arrivalTime !== null
            ? `Arrive ${clockFromSeconds(driveTripEstimate.arrivalTime)}`
            : null,
      late: arriveByActive && drivePlan !== null && !drivePlan.feasible,
      status: driveLoading
        ? "loading"
        : driveTripEstimate.availability === "available"
          ? "ready"
          : "empty",
      emptyText:
        driveTripEstimate.availability === "car-unavailable"
          ? (carAwayReason ?? "No car for this trip")
          : "Can’t check traffic right now",
      note:
        driveTripEstimate.expectedDurationMinutes !== null &&
        driveDoorToDoorMinutes !== null &&
        driveDoorToDoorMinutes > driveTripEstimate.expectedDurationMinutes
          ? `${formatDriveMinutes(driveTripEstimate.expectedDurationMinutes)} of driving, plus about ${Math.round(driveDoorToDoorMinutes - driveTripEstimate.expectedDurationMinutes)} min to park and walk in.`
          : null,
      pick: naluPick === "drive",
      locked: lockedChoice === "drive",
    },
    // Always all three, so riders see park & ride was checked even when no
    // sensible trip exists (e.g. Mānoa: Skyline would still need two buses).
    transitChoice("parkAndRide"),
    transitChoice("noCar"),
  ];
  function chooseTrip(key: TripChoiceKey) {
    if (commitment) return;
    setChosenCard(key);
    if (key === "drive") return chooseMode("drive");
    const option = (key === "parkAndRide" ? choicePicks.parkAndRide : choicePicks.noCar).option;
    if (!option) return;
    chooseMode("transit");
    setSelectedDeparture(optionIdentity(option));
  }
  const driveTrafficUnavailable = driveTripEstimate.availability === "data-error";
  const transitStandaloneAvailable =
    driveTrafficUnavailable && transitTripEstimate.availability === "available" && Boolean(best);
  const naluHeroTrafficLevel: "light" | "moderate" | "heavy" | "severe" =
    driveTripEstimate.majorIncident || (driveTripEstimate.trafficDelayMinutes ?? 0) >= 20
      ? "severe"
      : (driveTripEstimate.trafficDelayMinutes ?? 0) >= 10
        ? "heavy"
        : (driveTripEstimate.trafficDelayMinutes ?? 0) >= 5
          ? "moderate"
          : "light";
  const gap =
    !commitment && !arriveByActive && (verdict === "transit" || verdict === "drive")
      ? (activeDecision?.differenceMinutes ?? null)
      : null;
  const incidentDecides = verdict === "transit" && activeDecision.primary.kind === "major_incident";
  const currentDecisionSnapshot: DecisionSnapshot = {
    key: decisionKey,
    state:
      verdict === "same" ? "same" : verdict === "drive" || verdict === "transit" ? verdict : "same",
    driveMinutes: driveTripEstimate.expectedDurationMinutes,
    transitMinutes: transitTripEstimate.expectedDurationMinutes,
    driveDelayMinutes: driveTripEstimate.trafficDelayMinutes,
    railWaitMinutes: transitTripEstimate.railWaitMinutes,
    busWaitMinutes: transitTripEstimate.busWaitMinutes,
    majorIncident: Boolean(driveTripEstimate.majorIncident),
  };
  const decisionChanges = useMemo(() => {
    if (
      commitment ||
      !previousDecisionSnapshot ||
      previousDecisionSnapshot.key !== decisionKey ||
      !["drive", "transit", "same"].includes(verdict)
    )
      return [] as string[];
    const changes: string[] = [];
    if (previousDecisionSnapshot.state !== currentDecisionSnapshot.state) {
      const labels = { drive: "driving", transit: transitLabel, same: "neither option" } as const;
      changes.push(
        `Nalu changed the recommendation from ${labels[previousDecisionSnapshot.state]} to ${labels[currentDecisionSnapshot.state]}.`,
      );
    }
    const driveDelta = changedMinutes(
      currentDecisionSnapshot.driveMinutes,
      previousDecisionSnapshot.driveMinutes,
    );
    if (driveDelta !== null)
      changes.push(
        `Driving is now about ${Math.abs(driveDelta)} min ${driveDelta > 0 ? "slower" : "faster"} than your last check.`,
      );
    const transitDelta = changedMinutes(
      currentDecisionSnapshot.transitMinutes,
      previousDecisionSnapshot.transitMinutes,
    );
    if (transitDelta !== null)
      changes.push(
        `${transitLabel} is now about ${Math.abs(transitDelta)} min ${transitDelta > 0 ? "slower" : "faster"} than your last check.`,
      );
    const trafficDelta = changedMinutes(
      currentDecisionSnapshot.driveDelayMinutes,
      previousDecisionSnapshot.driveDelayMinutes,
    );
    if (trafficDelta !== null)
      changes.push(
        `Traffic is adding about ${Math.abs(trafficDelta)} min ${trafficDelta > 0 ? "more" : "less"} time than at your last check.`,
      );
    const railWaitDelta = changedMinutes(
      currentDecisionSnapshot.railWaitMinutes,
      previousDecisionSnapshot.railWaitMinutes,
    );
    if (railWaitDelta !== null)
      changes.push(
        `${transitLabel === "Rail" ? "The next train" : "Your transit"} wait is about ${Math.abs(railWaitDelta)} min ${railWaitDelta > 0 ? "longer" : "shorter"} than at your last check.`,
      );
    const busWaitDelta = changedMinutes(
      currentDecisionSnapshot.busWaitMinutes,
      previousDecisionSnapshot.busWaitMinutes,
    );
    if (busWaitDelta !== null)
      changes.push(
        `Your bus wait is about ${Math.abs(busWaitDelta)} min ${busWaitDelta > 0 ? "longer" : "shorter"} than at your last check.`,
      );
    if (currentDecisionSnapshot.majorIncident && !previousDecisionSnapshot.majorIncident)
      changes.push("A crash or major slowdown is now affecting the drive.");
    if (!currentDecisionSnapshot.majorIncident && previousDecisionSnapshot.majorIncident)
      changes.push("The reported crash or major slowdown is no longer affecting the comparison.");
    return changes.slice(0, 3);
  }, [
    commitment,
    previousDecisionSnapshot,
    decisionKey,
    currentDecisionSnapshot.driveMinutes,
    currentDecisionSnapshot.transitMinutes,
    currentDecisionSnapshot.driveDelayMinutes,
    currentDecisionSnapshot.railWaitMinutes,
    currentDecisionSnapshot.busWaitMinutes,
    currentDecisionSnapshot.majorIncident,
    currentDecisionSnapshot.state,
    transitLabel,
    verdict,
  ]);
  useEffect(() => {
    if (commitment || !["drive", "transit", "same"].includes(verdict)) return;
    const historyState =
      verdict === "drive" || verdict === "transit" || verdict === "same" ? verdict : "same";
    decisionHistoryRef.current = {
      key: decisionKey,
      state: historyState,
      snapshot: currentDecisionSnapshot,
    };
  }, [
    commitment,
    verdict,
    decisionKey,
    currentDecisionSnapshot.driveMinutes,
    currentDecisionSnapshot.transitMinutes,
    currentDecisionSnapshot.driveDelayMinutes,
    currentDecisionSnapshot.railWaitMinutes,
    currentDecisionSnapshot.busWaitMinutes,
    currentDecisionSnapshot.majorIncident,
    currentDecisionSnapshot.state,
  ]);
  // The verdict only steers the view until the commuter commits; after that the
  // locked mode stays on screen for the rest of the trip.
  useEffect(() => {
    if (commitment || chosenCard !== null) return;
    if (verdict === "drive") setSelectedMode("drive");
    else if (verdict === "transit") setSelectedMode("transit");
  }, [verdict, inbound, commitment, chosenCard]);
  const reasoning = commitment
    ? "Your selected trip stays locked while conditions update."
    : railClosedForEvening
      ? best
        ? `Skyline has ended for the evening. Nalu is comparing ${transitLabel} service with driving.`
        : "Skyline has ended for the evening. Nalu is checking TheBus and other available transit options."
      : railNotRunningYet
        ? best
          ? `Skyline has not started yet today. Nalu is comparing ${transitLabel} service with driving.`
          : "Skyline has not started yet today. Nalu is checking available transit options."
        : // "Drive gets you there about 30 min sooner" repeats the headline;
          // show the supporting reason instead, if there is one.
          activeDecision.primary.kind === "time_advantage"
          ? (activeDecision.supporting?.text ?? null)
          : activeDecision.primary.text;

  const whyNaluText = railClosedForEvening
    ? best
      ? `Skyline has finished service for the evening. Nalu is comparing the available ${transitLabel} trip with the live driving estimate.`
      : "Skyline has finished service for the evening. Nalu is checking TheBus and other available transit options before making the comparison."
    : railNotRunningYet
      ? best
        ? `Skyline has not started service yet. Nalu is comparing the available ${transitLabel} trip with the live driving estimate.`
        : "Skyline has not started service yet. Nalu is checking available transit options before making the comparison."
      : verdict === "drive"
        ? "Nalu compares the full trip from where you start to where you’re going, including getting to transit, waiting for your ride, and walking at the end—not just the freeway drive."
        : verdict === "transit"
          ? transitLabel === "Rail"
            ? "The Skyline option includes getting to the station, waiting, the train ride, and the walk to your destination."
            : "The " +
              transitLabel +
              " option includes getting to transit, waiting, transfers, and the walk to your destination."
          : verdict === "same"
            ? "The estimated arrival times are close enough that neither option has a clear time advantage right now."
            : activeDecision.primary.text;

  const verdictConfidence: "high" | "moderate" | "low" =
    activeDecision.confidence === "high" ||
    activeDecision.confidence === "moderate" ||
    activeDecision.confidence === "low"
      ? activeDecision.confidence
      : "low";

  const decisionSignals = useMemo(() => {
    const signals: Array<{
      label: string;
      value: string;
      detail?: string;
      tone: "neutral" | "alert" | "positive";
    }> = [];

    const delay = Math.round(driveTripEstimate.trafficDelayMinutes ?? 0);
    // Scheduled HDOT roadwork lives in the Drive tab, not under live conditions.

    if (verdict === "drive") {
      const trafficValue =
        delay >= 15
          ? `Heavy · +${delay} min vs usual`
          : delay >= 5
            ? `Slower · +${delay} min vs usual`
            : delay > 0
              ? `Slightly slower · +${delay} min`
              : "Moving steady";
      signals.push({
        label: "Traffic",
        value: trafficValue,
        tone: delay >= 5 ? "alert" : "neutral",
      });

      const incident = driveTripEstimate.majorIncident ? drive?.incidents?.[0] : null;
      if (incident) {
        signals.push({
          label: "Road incident",
          value: incidentHeadline(incident),
          detail: incidentDetailText(incident) ?? incidentImpactText(incident),
          tone: "alert",
        });
      }
    } else if (verdict === "transit") {
      const railWait = Math.round(transitTripEstimate.railWaitMinutes ?? 0);
      const busWait = Math.round(transitTripEstimate.busWaitMinutes ?? 0);
      if (railWait >= 5)
        signals.push({
          label: "Train wait",
          value: `${railWait} min`,
          tone: railWait >= 10 ? "alert" : "neutral",
        });
      if (busWait >= 5)
        signals.push({
          label: "Bus wait",
          value: `${busWait} min`,
          tone: busWait >= 10 ? "alert" : "neutral",
        });
      if (drive?.incidents?.[0] && driveTripEstimate.majorIncident) {
        signals.push({
          label: "Road incident",
          value: incidentHeadline(drive.incidents[0]),
          detail: incidentDetailText(drive.incidents[0]) ?? incidentImpactText(drive.incidents[0]),
          tone: "neutral",
        });
      }
    } else {
      if (delay >= 5)
        signals.push({ label: "Traffic", value: `+${delay} min vs usual`, tone: "alert" });
      const incident = driveTripEstimate.majorIncident ? drive?.incidents[0] : null;
      if (incident) {
        signals.push({
          label: "Road incident",
          value: incidentHeadline(incident),
          detail: incidentDetailText(incident) ?? incidentImpactText(incident),
          tone: "alert",
        });
      }
      const railWait = Math.round(transitTripEstimate.railWaitMinutes ?? 0);
      if (railWait >= 5)
        signals.push({ label: "Train wait", value: `${railWait} min`, tone: "neutral" });
    }

    return signals.slice(0, 4);
  }, [
    drive,
    driveTripEstimate.expectedDurationMinutes,
    driveTripEstimate.trafficDelayMinutes,
    driveTripEstimate.majorIncident,
    transitTripEstimate.railWaitMinutes,
    transitTripEstimate.busWaitMinutes,
    transitLabel,
    verdict,
  ]);
  const destinationLabel = setup.destinationName || setup.destinationAddress || "your destination";
  const tripOriginLabel = reverseTrip
    ? destinationLabel
    : departingFromSavedHome
      ? "Home"
      : // Without a saved Home, the start is wherever the trip was set from.
        "Your starting point";
  const tripArrivalLabel = arrivingHome ? "Home" : destinationLabel;
  // A shared link may carry the destination, but never a saved place (home,
  // work, a friend's house); those links just open Nalu.
  const shareableDestination = useMemo(() => {
    const lat = setup.destLat;
    const lon = setup.destLon;
    if (arrivingHome || typeof lat !== "number" || typeof lon !== "number") return null;
    const isSaved = savedPlaces.some(
      (place) => Math.hypot((place.lat - lat) * 111_000, (place.lon - lon) * 102_000) < 200,
    );
    return isSaved ? null : { lat, lon, name: destinationLabel };
  }, [arrivingHome, setup.destLat, setup.destLon, savedPlaces, destinationLabel]);
  // A stop serves one direction, so the arriving stop and the boarding stop differ.
  const plannedInboundAccess = inbound && best?.legs[0]?.kind === "access" ? best.legs[0] : null;
  // The return banner must describe the chosen itinerary, not the stop saved during setup.
  const activeDestStopName = inbound
    ? plannedInboundAccess?.mode === "bus"
      ? plannedInboundAccess.from
      : null
    : setup.destStopName;
  const plannedInboundWalkM =
    plannedInboundAccess?.mode === "bus" && plannedInboundAccess.depart_seconds !== null && best
      ? (Math.max(0, plannedInboundAccess.depart_seconds - best.leave_by_seconds) / 60) * 80.47
      : null;
  const rawWalkM = inbound ? plannedInboundWalkM : setup.destStopWalkM;
  const activeDestWalkM = typeof rawWalkM === "number" ? rawWalkM : null;

  const timeline = useMemo(() => {
    if (!best) return [];
    const rows = best.legs.map((leg, legIndex) => {
      const isTransit = leg.mode === "bus" || leg.mode === "rail";
      const previousLeg = best.legs[legIndex - 1];
      const followsTransit = previousLeg?.mode === "bus" || previousLeg?.mode === "rail";
      return {
        seconds: leg.depart_seconds,
        legIndex,
        title:
          followsTransit && previousLeg
            ? `Get off at ${transitStopName(previousLeg, "to")}`
            : vehicleName(leg),
        detail:
          leg.mode === "walk" || leg.mode === "drive"
            ? followsTransit
              ? `${vehicleName(leg)} · ${leg.minutes} min to ${
                  titleCase(leg.to) || (arrivingHome ? "home" : "your destination")
                }${leg.mode === "walk" && leg.minutes !== null ? ` · ${formatDistance(leg.minutes * 80.47)}` : ""}${
                  leg.kind === "egress" && leg.mode === "drive" ? " · your car is parked here" : ""
                }`
              : leg.kind === "access" && leg.mode === "walk"
                ? `Walk to ${stationLabel(leg.to) || titleCase(leg.to) || "the station"} Station · ${leg.minutes} min${
                    leg.minutes !== null ? ` · ${formatDistance(leg.minutes * 80.47)}` : ""
                  } · arrive platform ${clockFromSeconds(leg.arrive_seconds)}`
                : `${leg.minutes} min from ${titleCase(leg.from) || "your location"} to ${
                    titleCase(leg.to) || (arrivingHome ? "home" : "your destination")
                  }${leg.kind === "egress" && leg.mode === "drive" ? " · your car is parked here" : ""}`
            : "",
        boardAt: isTransit ? transitStopName(leg, "from") : null,
        getOffAt: isTransit ? transitStopName(leg, "to") : null,
        arriveSeconds: isTransit ? leg.arrive_seconds : null,
        mode: leg.mode,
      };
    });
    const last = best.legs[best.legs.length - 1];
    rows.push({
      seconds: last?.arrive_seconds ?? null,
      legIndex: -1,
      title: arrivingHome ? "Arrive home" : "Arrive destination",
      detail: titleCase(last?.to) || setup.destinationName || setup.destinationAddress,
      boardAt: null,
      getOffAt: null,
      arriveSeconds: null,
      mode: "walk" as Leg["mode"],
    });
    return rows;
  }, [best, arrivingHome, setup.destinationName, setup.destinationAddress]);

  const commuteMapPoints = useMemo(() => {
    if (!best || !homePoint || !destPoint) return [];
    const origin = reverseTrip ? destPoint : homePoint;
    const destination = reverseTrip ? homePoint : destPoint;
    const originName = tripOriginLabel;
    const destinationName = tripArrivalLabel;
    const points: Array<{
      id: string;
      name: string;
      lat: number;
      lon: number;
      kind: "start" | "rail" | "bus" | "end";
    }> = [{ id: "start", name: originName, ...origin, kind: "start" }];

    const stopPoint = (name: string | null, stopId?: string | null) => {
      if (stopId) {
        const byId = itineraryStopCoords.find((row) => row.stop_id === stopId);
        if (byId && byId.stop_lat !== null && byId.stop_lon !== null) {
          return { lat: Number(byId.stop_lat), lon: Number(byId.stop_lon) };
        }
      }
      if (!name) return null;
      const normalized = name.trim().toLowerCase();
      const station = stationPoint(name, stopId);
      if (station) return station;
      const stop = itineraryStopCoords.find(
        (row) => (row.stop_name ?? "").trim().toLowerCase() === normalized,
      );
      if (!stop || stop.stop_lat === null || stop.stop_lon === null) return null;
      return { lat: Number(stop.stop_lat), lon: Number(stop.stop_lon) };
    };

    // The map should explain the itinerary, not expose every GTFS stop.
    // Rail stations are meaningful waypoints, so keep the Skyline station dots.
    // Bus stop sequences are used for the route line, but only the meaningful
    // boarding/alighting points get markers. Otherwise every bus stop looks
    // like a required transfer.
    best.legs.forEach((leg, index) => {
      if (leg.mode !== "rail" && leg.mode !== "bus") return;
      const transitKind: "rail" | "bus" = leg.mode;
      const sequence = itineraryLegSequences.find((item) => item.legIndex === index);
      const sequencePoints = sequence?.points ?? [];

      if (sequencePoints.length > 1) {
        if (leg.mode === "rail") {
          sequencePoints.forEach((stop, stopIndex) => {
            const station = stationPoint(stop.stopName);
            const point = station ?? { lat: stop.lat, lon: stop.lon };
            const last = points[points.length - 1];
            if (last && distanceM(last, point) < 20) return;
            points.push({
              id: `${leg.kind}-${index}-station-${stopIndex}-${stop.stopId}`,
              name: `${stationLabel(stop.stopName)} Station`,
              ...point,
              kind: "rail",
            });
          });
        } else {
          // For a bus leg, mark only the alighting stop. The boarding stop is
          // already represented by the preceding origin/rail/transfer point
          // when applicable. Access buses still need a boarding marker.
          const stopsToMark =
            leg.kind === "access"
              ? [sequencePoints[0], sequencePoints[sequencePoints.length - 1]]
              : [sequencePoints[sequencePoints.length - 1]];
          stopsToMark.forEach((stop, stopIndex) => {
            if (!stop) return;
            const point = { lat: stop.lat, lon: stop.lon };
            const last = points[points.length - 1];
            if (last && distanceM(last, point) < 20) return;
            points.push({
              id: `${leg.kind}-${index}-bus-end-${stopIndex}-${stop.stopId}`,
              name: titleCase(stop.stopName),
              ...point,
              kind: "bus",
            });
          });
        }
        return;
      }

      // Preserve a useful endpoint fallback when the timed stop sequence is unavailable.
      const endpoints: Array<[string | null, string | null | undefined]> = [
        [leg.from, leg.from_stop_id],
        [leg.to, leg.to_stop_id],
      ];
      const endpointIndexes = leg.mode === "bus" && leg.kind !== "access" ? [1] : [0, 1];
      endpointIndexes.forEach((endpointIndex) => {
        const [name, stopId] = endpoints[endpointIndex] ?? [null, null];
        const point = stopPoint(name, stopId ?? null);
        if (!name || !point) return;
        const last = points[points.length - 1];
        if (last && distanceM(last, point) < 20) return;
        points.push({
          id: `${leg.kind}-${index}-${endpointIndex}`,
          name: leg.mode === "rail" ? `${stationLabel(name)} Station` : titleCase(name),
          ...point,
          kind: transitKind,
        });
      });
    });

    points.push({ id: "end", name: destinationName, ...destination, kind: "end" });
    return points;
  }, [
    best,
    homePoint,
    destPoint,
    reverseTrip,
    tripOriginLabel,
    tripArrivalLabel,
    itineraryStopCoords,
    itineraryLegSequences,
    stationCoords,
  ]);

  type TransitMapSegment = {
    id: string;
    mode: "walk" | "drive" | "bus" | "rail";
    points: Array<{ lat: number; lon: number }>;
  };

  const transitMapSegments = useMemo<TransitMapSegment[]>(() => {
    if (!best || !homePoint || !destPoint) return [];
    const origin = reverseTrip ? destPoint : homePoint;
    const destination = reverseTrip ? homePoint : destPoint;
    const sequenceByLeg = new Map(
      itineraryLegSequences.map((sequence) => [sequence.legIndex, sequence]),
    );
    const pointForStop = (stopId?: string | null, stopName?: string | null) => {
      const row =
        (stopId ? itineraryStopCoords.find((stop) => stop.stop_id === stopId) : undefined) ??
        (stopName ? itineraryStopCoords.find((stop) => stop.stop_name === stopName) : undefined);
      return row && row.stop_lat !== null && row.stop_lon !== null
        ? { lat: Number(row.stop_lat), lon: Number(row.stop_lon) }
        : null;
    };
    /**
     * The Skyline alignment, drawn station by station. Used when a specific train
     * trip cannot be matched to the leg, so the rail line never collapses into a
     * straight line across Pearl Harbor.
     */
    const railLinePoints = (fromName?: string | null, toName?: string | null) => {
      if (!fromName || !toName || railLine.length === 0) return null;
      const fromIndex = railLine.findIndex((station) => station.stop_name === fromName);
      const toIndex = railLine.findIndex((station) => station.stop_name === toName);
      if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return null;
      const slice =
        fromIndex < toIndex
          ? railLine.slice(fromIndex, toIndex + 1)
          : railLine.slice(toIndex, fromIndex + 1).reverse();
      const points = slice.flatMap((station) =>
        station.stop_lat === null || station.stop_lon === null
          ? []
          : [{ lat: Number(station.stop_lat), lon: Number(station.stop_lon) }],
      );
      return points.length > 1 ? points : null;
    };
    return best.legs.flatMap<TransitMapSegment>((leg, legIndex): TransitMapSegment[] => {
      const sequence = sequenceByLeg.get(legIndex);
      if (sequence)
        return [
          {
            id: `transit-${legIndex}`,
            mode: sequence.mode,
            points: sequence.points.map(({ lat, lon }) => ({ lat, lon })),
          },
        ];
      if (leg.mode === "rail") {
        const alignment = railLinePoints(leg.from, leg.to);
        if (alignment)
          return [{ id: `rail-line-${legIndex}`, mode: "rail" as const, points: alignment }];
      }
      // A bus leg without a GTFS stop sequence must never be rendered as a
      // straight line between stops. That geometry can cross water or buildings
      // and falsely imply a route that the bus does not take. The sequence query
      // above is responsible for supplying the actual bus path.
      if (leg.mode === "bus") return [];
      const from = leg.kind === "access" ? origin : pointForStop(leg.from_stop_id, leg.from);
      const to = leg.kind === "egress" ? destination : pointForStop(leg.to_stop_id, leg.to);
      if (!from || !to) return [];
      return [{ id: `leg-${legIndex}`, mode: leg.mode, points: [from, to] }];
    });
  }, [
    best,
    homePoint,
    destPoint,
    reverseTrip,
    itineraryLegSequences,
    itineraryStopCoords,
    railLine,
  ]);

  // Drive view: straight door-to-door, no rail station or transit stops.
  const driveMapPoints = useMemo(() => {
    if (!homePoint || !destPoint) return [];
    const origin = reverseTrip ? destPoint : homePoint;
    const destination = reverseTrip ? homePoint : destPoint;
    return [
      { id: "start", name: tripOriginLabel, ...origin, kind: "start" as const },
      {
        id: "end",
        name: tripArrivalLabel,
        ...destination,
        kind: "end" as const,
      },
    ];
  }, [homePoint, destPoint, reverseTrip, tripOriginLabel, tripArrivalLabel]);

  const mapPoints = selectedMode === "drive" ? driveMapPoints : commuteMapPoints;
  // Drive mode traces the real road geometry TomTom used for the ETA.
  const driveMapPath = selectedMode === "drive" ? drive?.path : undefined;
  const driveTrafficSections = selectedMode === "drive" ? drive?.trafficSections : undefined;

  // Browse mode gets one line only, read at wherever the rider is standing now.
  const { data: browseWeather } = useQuery({
    queryKey: ["browse-weather", browseStation?.lat?.toFixed(2), browseStation?.lon?.toFixed(2)],
    enabled: browseActive && Boolean(browseStation),
    staleTime: 20 * 60_000,
    refetchInterval: 20 * 60_000,
    retry: false,
    queryFn: () =>
      fetchWeather({
        data: {
          points: [
            { id: "browse", lat: browseStation!.lat, lon: browseStation!.lon, offsetMinutes: 0 },
          ],
          airLat: browseStation!.lat,
          airLon: browseStation!.lon,
        },
      }),
  });

  const browseWeatherLine = useMemo<WeatherLine | null>(() => {
    const reading = browseWeather?.moments[0];
    if (!reading) return null;
    if ((reading.precipPercent ?? 0) > 40) {
      return { text: "Rain in the area · good day for the train", tone: "rain", source: "NWS" };
    }
    const feels = reading.heatIndexF;
    const hot = feels !== null && feels > 88;
    const humid = (reading.humidityPercent ?? 0) > 75;
    if (hot && humid)
      return { text: `Hot and humid · feels like ${feels}°F`, tone: "heat", source: "NWS" };
    if (hot) return { text: `Hot out · feels like ${feels}°F`, tone: "heat", source: "NWS" };
    return airLine(browseWeather?.air?.category ?? 0);
  }, [browseWeather]);

  const browseWeatherSummary = useMemo(() => {
    const reading = browseWeather?.moments[0];
    const parts: string[] = [];
    if (reading?.heatIndexF !== null && reading?.heatIndexF !== undefined)
      parts.push(`${reading.heatIndexF}°`);
    if (reading?.shortForecast) parts.push(reading.shortForecast);
    const airCategory = browseWeather?.air?.category;
    if (airCategory === 1) parts.push("Good AQI");
    else if (airCategory === 2) parts.push("Moderate AQI");
    else if (airCategory === 3) parts.push("Poor AQI");
    else if (typeof airCategory === "number" && airCategory >= 4) parts.push("Unhealthy AQI");
    return parts.join(" · ") || "Weather unavailable";
  }, [browseWeather]);

  async function refresh() {
    setRefreshing(true);
    setNow(new Date());
    forcedTrafficRefresh.current = true;
    const tasks: Array<Promise<unknown>> = [
      queryClient.invalidateQueries({ queryKey: ["drive"] }),
      queryClient.invalidateQueries({ queryKey: ["browse-h1"] }),
    ];
    if (browseActive) {
      tasks.push(refetchBrowseDepartures(), refetchEastboundTraffic(), refetchWestboundTraffic());
    }
    await Promise.allSettled(tasks);
    forcedTrafficRefresh.current = false;
    window.setTimeout(() => setRefreshing(false), 250);
  }

  function closeSetup() {
    if (!configured) window.localStorage.setItem(SETUP_DISMISSED_KEY, "1");
    setMapSetupDraft(null);
    setOnboardingOpen(false);
    setSettingsOpen(false);
  }

  function saveSetup(next: Setup) {
    if (!gate.tripCheck()) return;
    // Unlock audio inside this tap so iOS Safari allows the arrival chime later.
    if (alertPrefs.sound) primeChimeAudio();
    requestCommuteNotificationPermission();
    void refreshTrafficNow();
    // A direction chosen for a previous destination cannot override the new
    // trip's actual coordinates or saved Home shortcut.
    setOverride(null);
    window.localStorage.removeItem(DIRECTION_KEY);
    persist(next);
    setPageView("commute");
    setMapSetupDraft(null);
    window.localStorage.removeItem(SETUP_DISMISSED_KEY);
    setOnboardingOpen(false);
    setSettingsOpen(false);
  }

  /** Transit stops for a one-tap trip; missing stops fall back to a drive-only plan. */
  async function findTripStops(
    origin: { lat: number; lon: number },
    destination: { lat: number; lon: number },
  ) {
    const [station, arriving, boarding] = await Promise.all([
      supabase.rpc("nearest_stop", { p_lat: origin.lat, p_lon: origin.lon, p_rail_only: true }),
      supabase.rpc("directional_dest_stop", {
        p_lat: destination.lat,
        p_lon: destination.lon,
        p_toward_rail: false,
      }),
      supabase.rpc("directional_dest_stop", {
        p_lat: destination.lat,
        p_lon: destination.lon,
        p_toward_rail: true,
      }),
    ]);
    for (const result of [station, arriving, boarding])
      if (result.error) console.error("Stop lookup error", result.error);
    return { rail: station.data?.[0], out: arriving.data?.[0], back: boarding.data?.[0] };
  }

  async function setMapStopAsStart(stop: NearbyMapStop) {
    if (mapStopActionBusyRef.current) return;
    mapStopActionBusyRef.current = true;
    setMapStopActionBusy(true);
    try {
      const { data, error } = await supabase.rpc("nearest_stop", {
        p_lat: stop.lat,
        p_lon: stop.lon,
        p_rail_only: true,
      });
      if (error || !data?.[0]) throw new Error("Could not find a rail station near this stop.");
      const next = {
        ...setup,
        homeLat: stop.lat,
        homeLon: stop.lon,
        homeStopId: data[0].stop_id,
        homeStopName: data[0].stop_name ?? "",
      };
      if (hasValidCoordinates({ lat: next.destLat, lon: next.destLon })) saveSetup(next);
      else {
        setMapSetupDraft(next);
        setOnboardingOpen(true);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not set this starting point.");
    } finally {
      mapStopActionBusyRef.current = false;
      setMapStopActionBusy(false);
    }
  }

  async function setMapStopAsDestination(stop: NearbyMapStop) {
    if (mapStopActionBusyRef.current || !browseUserPoint) return;
    mapStopActionBusyRef.current = true;
    setMapStopActionBusy(true);
    try {
      const { rail, back } = await findTripStops(browseUserPoint, stop);
      if (!rail) throw new Error("Could not find a rail station near your start.");
      saveSetup({
        ...emptySetup,
        allowDrive: true,
        homeLat: browseUserPoint.lat,
        homeLon: browseUserPoint.lon,
        homeStopId: rail.stop_id,
        homeStopName: rail.stop_name ?? "",
        destinationName: stop.stopName,
        destinationAddress: stop.stopName,
        destLat: stop.lat,
        destLon: stop.lon,
        // The tapped icon is the rider's exact destination stop, not a
        // similarly named stop chosen by a nearest-stop lookup.
        destStopId: stop.stopId,
        destStopName: stop.stopName,
        destStopWalkM: 0,
        destReturnStopId: back?.stop_id ?? "",
        destReturnStopName: back?.stop_name ?? "",
        destReturnWalkM: Number(back?.distance_m ?? 0),
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not set this destination.");
    } finally {
      mapStopActionBusyRef.current = false;
      setMapStopActionBusy(false);
    }
  }

  async function quickStartSavedPlace(slot: string, options: { auto?: boolean } = {}) {
    if (!options.auto && !gate.tripCheck()) return;
    const destination = resolveShortcut(savedPlaces, slot);
    if (destination && !options.auto) recordTripOpen(slot);
    if (!destination) {
      if (authLoading || !user || syncReadyUser !== user.id) {
        setRestoreSlot(slot);
        setAccountOpen(true);
      } else {
        setQuickPlaceSlot(slot);
      }
      return;
    }
    startTripToPlace(destination, options);
  }

  /** One-tap trip from where you are now to a place (saved, or from a shared link). */
  function startTripToPlace(
    destination: { label: string; name: string; address: string; lat: number; lon: number },
    options: { auto?: boolean } = {},
  ) {
    // Sound and the notification question need a tap; an automatic open has none.
    if (!options.auto) {
      if (alertPrefs.sound) primeChimeAudio();
      requestCommuteNotificationPermission();
    }
    void refreshTrafficNow();
    if (!navigator.geolocation) {
      toast("Your location isn’t available on this device.", {
        description: "Open WHERE TO? to choose a starting point.",
      });
      setOnboardingOpen(true);
      return;
    }

    const toastId = toast.loading(`Finding the quickest trip to ${destination.label}…`);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const origin = { lat: position.coords.latitude, lon: position.coords.longitude };
        try {
          const apart = Math.hypot(
            (origin.lat - destination.lat) * 111_000,
            (origin.lon - destination.lon) * 111_000 * Math.cos((origin.lat * Math.PI) / 180),
          );
          if (apart < 150) {
            toast.success(`You’re already at ${destination.label}.`, { id: toastId });
            return;
          }
          const stops = await findTripStops(origin, destination);
          const { rail, out, back } = stops;

          saveSetup({
            ...emptySetup,
            // Door-to-door driving must always be weighed for a one-tap trip.
            allowDrive: true,
            homeStopId: rail?.stop_id ?? "",
            homeStopName: rail?.stop_name ?? "",
            homeLat: origin.lat,
            homeLon: origin.lon,
            destinationName: destination.name,
            destinationAddress: destination.address,
            destLat: destination.lat,
            destLon: destination.lon,
            destStopId: out?.stop_id ?? "",
            destStopName: out?.stop_name ?? "",
            destStopWalkM: Number(out?.distance_m ?? 0),
            destReturnStopId: back?.stop_id ?? "",
            destReturnStopName: back?.stop_name ?? "",
            destReturnWalkM: Number(back?.distance_m ?? 0),
          });
          const accuracy = position.coords.accuracy;
          const precision = Number.isFinite(accuracy)
            ? `Accurate to about ${formatDistance(accuracy)}`
            : "";
          const address = await lookupOriginAddress({
            data: { lat: origin.lat, lon: origin.lon },
          }).catch(() => null);
          toast.success(`Trip to ${destination.label} is ready.`, {
            id: toastId,
            description:
              [address?.label ? `Starting at ${address.label}` : null, precision || null]
                .filter(Boolean)
                .join(" · ") || undefined,
          });
        } catch (error) {
          console.error("Quick trip failed", error);
          toast.error("Nalu couldn’t build that trip right now.", {
            id: toastId,
            description: "Try again or use WHERE TO?.",
          });
        }
      },
      (error) => {
        if (isPermissionDeniedError(error)) recordLocationDenied();
        toast.error("Share your location to start in one tap.", {
          id: toastId,
          description: "You can also choose a starting point in WHERE TO?.",
        });
        setOnboardingOpen(true);
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
    );
  }

  const setupDialog = (
    <>
      <AccountDialog
        open={accountOpen}
        onClose={() => {
          setAccountOpen(false);
          setRestoreSlot(null);
        }}
        restoreLabel={restoreSlot ? shortcutLabel(savedPlaces, restoreSlot) : null}
        restored={Boolean(restoreSlot && resolveShortcut(savedPlaces, restoreSlot))}
        syncStatus={placesSyncStatus}
        onRetry={() => {
          syncedUserRef.current = null;
          setSyncReadyUser(null);
          setSyncRetry((value) => value + 1);
        }}
        placeLabels={savedPlaces.map((place) => place.label)}
        onSearch={() => {
          setAccountOpen(false);
          setQuickPlaceSlot(restoreSlot);
          setRestoreSlot(null);
        }}
        onStart={() => {
          const slot = restoreSlot;
          setAccountOpen(false);
          setRestoreSlot(null);
          if (slot) void quickStartSavedPlace(slot);
        }}
      />
      <QuickPlaceDialog
        slot={quickPlaceSlot}
        places={savedPlaces}
        onClose={() => setQuickPlaceSlot(null)}
        onSave={(next) => {
          persistPlaces(next);
          setQuickPlaceSlot(null);
        }}
      />
      <SetupDialog
        open={onboardingOpen || settingsOpen}
        firstRun={onboardingOpen}
        setup={mapSetupDraft ?? setup}
        onClose={closeSetup}
        onSave={saveSetup}
        alertPrefs={alertPrefs}
        onAlertPrefsChange={saveAlertPrefs}
        savedPlaces={savedPlaces}
        onPlacesChange={persistPlaces}
        initialPage={settingsOpen ? settingsPage : null}
      />
    </>
  );

  // A shared link (ridenalu.com/?to=lat,lon&name=…) opens that trip once, from
  // wherever the person is. The link is cleaned from the address bar first.
  const sharedLinkTried = useRef(false);
  useEffect(() => {
    if (sharedLinkTried.current || !hydrated || commitment) return;
    sharedLinkTried.current = true;
    const shared = parseSharedDestination(window.location.search);
    if (!shared) return;
    const url = new URL(window.location.href);
    url.searchParams.delete("to");
    url.searchParams.delete("name");
    window.history.replaceState(
      window.history.state,
      "",
      url.pathname + (url.search || "") + url.hash,
    );
    try {
      window.sessionStorage.setItem("nalu-autoopen-done", "1");
    } catch {
      /* ignore */
    }
    startTripToPlace(
      {
        label: shared.name,
        name: shared.name,
        address: shared.name,
        lat: shared.lat,
        lon: shared.lon,
      },
      { auto: true },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, commitment]);

  // Open the trip this person usually takes now, once per visit, only when the
  // habit is real (see trip-habits), location is already allowed, and they
  // haven't said "Not now" three times in a row. "Where to?" stays one tap away.
  const autoOpenTried = useRef(false);
  useEffect(() => {
    if (autoOpenTried.current || !hydrated || configured || onboardingOpen || commitment) return;
    if (savedPlaces.length === 0) return;
    autoOpenTried.current = true;
    try {
      if (window.sessionStorage.getItem("nalu-autoopen-done") === "1") return;
      window.sessionStorage.setItem("nalu-autoopen-done", "1");
    } catch {
      return;
    }
    if (!autoOpenAllowed()) return;
    const slot = predictSlot(readHabits(), Date.now());
    const place = slot ? resolveShortcut(savedPlaces, slot) : null;
    if (!slot || !place || !navigator.permissions?.query) return;
    void navigator.permissions
      .query({ name: "geolocation" as PermissionName })
      .then((status) => {
        if (status.state !== "granted") return;
        void quickStartSavedPlace(slot, { auto: true });
        let dismissed = false;
        toast(`Your usual trip to ${place.label}`, {
          description: "Opened it for you.",
          duration: 8000,
          action: {
            label: "Not now",
            onClick: () => {
              dismissed = true;
              noteIgnored();
              endTrip();
            },
          },
          onAutoClose: () => {
            if (!dismissed) noteUsed();
          },
        });
      })
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, configured, onboardingOpen, commitment, savedPlaces.length]);

  if (browseActive) {
    const trafficLoading = eastboundTrafficLoading || westboundTrafficLoading;
    const trafficUnavailable =
      eastboundTrafficFailed ||
      westboundTrafficFailed ||
      (!trafficLoading && (!eastboundTraffic || !westboundTraffic));
    const h1HasMeaningfulDelay =
      !trafficUnavailable &&
      !trafficLoading &&
      Math.max(eastboundTraffic?.delayMinutes ?? 0, westboundTraffic?.delayMinutes ?? 0) > 10;

    const profileName = profileFirstName(user);
    return (
      <main className="browse-radiance min-h-dvh px-5 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))] text-foreground">
        <div className="mx-auto flex w-full max-w-[440px] flex-col">
          <header className="flex min-h-11 items-start justify-between gap-4">
            <div>
              <p className="mb-1 text-xs font-semibold text-recommended">
                {alohaGreeting(now, profileName)}
              </p>
              <div className="flex items-center gap-1.5">
                <WaveMark className="h-6 w-auto text-foreground" />
                <p className="text-lg font-medium tracking-wide text-foreground">Nalu</p>
              </div>
            </div>
            <div className="flex max-w-[65%] flex-wrap items-center justify-end gap-1">
              <p className="w-full text-right text-xs font-medium text-foreground">{timeText}</p>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Refresh commute conditions"
                onClick={() => void refresh()}
                disabled={refreshing}
                className="size-11 shrink-0 rounded-full text-muted-foreground hover:text-foreground"
              >
                <RefreshCw />
              </Button>
              <AccountButton
                onClick={() => {
                  setRestoreSlot(null);
                  setAccountOpen(true);
                }}
              />
              <Button
                variant="ghost"
                size="icon"
                aria-label="Open settings"
                onClick={() => openSettingsList()}
                className="size-11 shrink-0 rounded-full text-muted-foreground hover:text-foreground"
              >
                <Settings className="size-5" />
              </Button>
            </div>
          </header>
          <Tagline className="mt-2" />
          {!activeRegion().hasTransit && (
            <p className="mt-2 w-fit rounded-full border border-warning/40 bg-warning/10 px-3 py-1 text-xs font-semibold text-warning">
              Test: {activeRegion().name} · driving and rides only
            </p>
          )}

          <CommutePageNav current="browse" onBrowse={() => setPageView("browse")} />

          {/* The Home/Work shortcut cards below already start these trips in one tap. */}

          <DataExpiryNotice />
          {!online && (
            <p
              role="status"
              className="mt-3 rounded-lg border border-border bg-surface-raised px-4 py-3 text-sm text-muted-foreground"
            >
              You’re offline. Available schedules stay visible; live arrivals will refresh when you
              reconnect.
            </p>
          )}
          {/* Oʻahu commute cards use Oʻahu Home/Work; off in the SF test. */}
          {activeRegion().hasTransit && (
            <>
              <MorningPulse
                home={browseHome}
                work={browseWork}
                trainsEveryMinutes={trainsEveryMinutes}
              />
              <EveningPulse
                home={browseHome}
                work={browseWork}
                trainsEveryMinutes={trainsEveryMinutes}
              />
              <BeatTheRush home={browseHome} work={browseWork} />
              <WeeklyDigestCard />
            </>
          )}

          <Button
            onClick={() => setOnboardingOpen(true)}
            className="browse-where-to mx-auto mt-5 min-h-16 w-full justify-center gap-3 rounded-lg border border-primary bg-primary px-5 text-center text-lg font-bold text-primary-foreground hover:bg-primary/90"
            aria-label="Where to? Set up a trip"
          >
            <Search className="size-6 text-primary-foreground" />
            <span>WHERE TO?</span>
            <ChevronRight className="size-5 text-primary-foreground/70" />
          </Button>

          <div className="mt-3 flex flex-wrap justify-center gap-2" aria-label="Quick destinations">
            {/* Home and Work have their own cards just below; avoid showing them twice. */}
            {(["gym"] as const).map((kind) => {
              const Icon = shortcutIcon(kind);
              const saved = Boolean(findByKind(savedPlaces, kind));
              return (
                <Button
                  key={kind}
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => void quickStartSavedPlace(kind)}
                  className={`h-9 gap-1.5 rounded-full px-3.5 ${saved ? "" : "opacity-70"}`}
                  aria-label={
                    saved ? `Plan a trip to ${kindLabel(kind)}` : `Set up ${kindLabel(kind)}`
                  }
                >
                  <Icon className="size-3.5" /> {kindLabel(kind)}
                </Button>
              );
            })}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => openSettingsList()}
              className="h-9 gap-1.5 rounded-full px-3.5"
            >
              <Plus className="size-3.5" /> Add Place
            </Button>
          </div>

          <ShortcutGrid
            places={savedPlaces}
            onStart={(slot) => void quickStartSavedPlace(slot)}
            onPlacesChange={persistPlaces}
          />

          <InstallNaluCard />
          {activeRegion().hasTransit && <LeaveAlertCard places={savedPlaces} variant="offer" />}

          {browseUserPoint && (
            <section
              className="map-shell relative mt-4 h-[44dvh] min-h-[320px] max-h-[470px] overflow-hidden rounded-xl"
              aria-label="Nearby transit map"
            >
              <ClientOnly
                fallback={
                  <div
                    className="h-full animate-pulse bg-muted"
                    aria-label="Loading nearby transit map"
                  />
                }
              >
                <Suspense
                  fallback={
                    <div
                      className="h-full animate-pulse bg-muted"
                      aria-label="Loading nearby transit map"
                    />
                  }
                >
                  <NearbyTransitMap
                    userPoint={browseUserPoint}
                    stops={nearbyStops.map((stop) => ({
                      stopId: stop.stopId,
                      stopName: stop.stopName,
                      lat: stop.lat,
                      lon: stop.lon,
                      kind: stop.routeType === 1 ? "rail" : "bus",
                      arrivals: stop.arrivals.slice(0, 3).map((arrival) => ({
                        label: stop.routeType === 1 ? "Skyline" : arrival.route_short_name || "Bus",
                        time: clockFromSeconds(arrival.departure_seconds),
                        minutesAway: Math.max(
                          0,
                          Math.ceil((arrival.departure_seconds - nowSeconds) / 60),
                        ),
                      })),
                    }))}
                    selectedStopId={selectedNearbyStop?.stopId ?? null}
                    onSelectStop={setSelectedNearbyStopId}
                    onSetStart={(stop) => void setMapStopAsStart(stop)}
                    onSetDestination={(stop) => void setMapStopAsDestination(stop)}
                    actionBusy={mapStopActionBusy}
                  />
                </Suspense>
              </ClientOnly>

              <div className="absolute left-3 top-3 z-[500] flex items-center gap-2 rounded-md border border-border bg-background/90 px-3 py-2 backdrop-blur-md">
                <span
                  role="img"
                  className="size-3 rounded-full border-2 border-foreground bg-location shadow-[0_0_10px_var(--color-location)]"
                  aria-label="Your location"
                />
                <span className="text-xs font-semibold text-foreground">You</span>
              </div>
            </section>
          )}

          {browseUserPoint && (
            <details open className="glass-panel mt-4 rounded-lg">
              <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
                <Bus className="size-5 text-primary" />
                <span className="font-semibold text-foreground">Nearby stops</span>
                <span className="ml-auto whitespace-nowrap text-xs text-muted-foreground">
                  {nearbyStopsLoading && !nearbyStops.length
                    ? "Looking…"
                    : `${nearbyStops.length} ${nearbyStops.length === 1 ? "stop" : "stops"}`}
                </span>
                <ChevronDown className="size-4 text-muted-foreground" />
              </summary>
              <div className="border-t border-border p-4">
                <div className="flex gap-2 overflow-x-auto pb-3" aria-label="Choose a nearby stop">
                  {nearbyStops.map((stop) => {
                    const Icon = stop.routeType === 1 ? TrainFront : Bus;
                    return (
                      <Button
                        key={stop.stopId}
                        variant={
                          selectedNearbyStop?.stopId === stop.stopId ? "default" : "secondary"
                        }
                        size="sm"
                        onClick={() => setSelectedNearbyStopId(stop.stopId)}
                        className="h-auto max-w-56 shrink-0 justify-start gap-2 px-3 py-2 text-left"
                        aria-label={`Show ${nearbyServiceLabel(stop)} at ${titleCase(stop.stopName)}`}
                      >
                        <Icon className="size-4 shrink-0" />
                        <span className="min-w-0">
                          <span className="block truncate font-semibold">
                            {nearbyChipTitle(stop)}
                          </span>
                          <span className="block text-xs font-medium opacity-80">
                            {walkingEstimate(browseUserPoint, stop).minutes} min walk
                          </span>
                        </span>
                      </Button>
                    );
                  })}
                </div>
                {nearbyStopsLoading && (
                  <p className="text-sm text-muted-foreground">Finding nearby transit…</p>
                )}
                {selectedNearbyStop && (
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-foreground">
                          {selectedNearbyStop.routeType === 1
                            ? `${stationLabel(selectedNearbyStop.stopName)} Station`
                            : titleCase(selectedNearbyStop.stopName)}
                        </p>
                        <LandmarkHint name={selectedNearbyStop.stopName} />
                        <p className="mt-1 text-xs text-muted-foreground">
                          Walk {walkingEstimate(browseUserPoint, selectedNearbyStop).minutes} min ·{" "}
                          {formatDistance(selectedNearbyStop.distanceM)}
                        </p>
                      </div>
                      {selectedNearbyStop.arrivals[0] && (
                        <p className="shrink-0 whitespace-nowrap text-lg font-bold tabular-nums text-primary">
                          {Math.max(
                            0,
                            Math.ceil(
                              (selectedNearbyStop.arrivals[0].departure_seconds - nowSeconds) / 60,
                            ),
                          )}{" "}
                          min
                        </p>
                      )}
                    </div>
                    <div className="mt-3 divide-y divide-border">
                      {selectedNearbyStop.arrivals.length ? (
                        selectedNearbyStop.arrivals.slice(0, 3).map((arrival, index) => (
                          <div
                            key={`${arrival.departure_seconds}-${index}`}
                            className="flex items-center gap-2 py-2 text-sm text-foreground"
                          >
                            <span className="shrink-0 rounded-md bg-primary/15 px-2 py-1 font-bold text-primary">
                              {selectedNearbyStop.routeType === 1
                                ? "Skyline"
                                : arrival.route_short_name || arrival.route_long_name || "Bus"}
                            </span>
                            <span className="min-w-0 flex-1 line-clamp-2 font-medium">
                              {arrival.headsign
                                ? selectedNearbyStop.routeType === 1
                                  ? stationLabel(arrival.headsign)
                                  : titleCase(arrival.headsign)
                                : "Destination unavailable"}
                            </span>
                            <span className="shrink-0 font-bold tabular-nums">
                              {clockFromSeconds(arrival.departure_seconds)}
                            </span>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          No upcoming scheduled arrivals right now.
                        </p>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Scheduled times · TheBus / DTS
                    </p>
                    <details className="walking-map-details mt-3 border-t border-border pt-3">
                      <summary>Show walk to this stop</summary>
                      <div className="map-shell mt-2 overflow-hidden rounded-lg">
                        <ClientOnly
                          fallback={
                            <div
                              className="h-40 animate-pulse bg-muted"
                              aria-label="Loading walking map"
                            />
                          }
                        >
                          <Suspense
                            fallback={
                              <div
                                className="h-40 animate-pulse bg-muted"
                                aria-label="Loading walking map"
                              />
                            }
                          >
                            <WalkingMicroMap
                              from={{ ...browseUserPoint, label: "Your location" }}
                              to={{
                                lat: selectedNearbyStop.lat,
                                lon: selectedNearbyStop.lon,
                                label: titleCase(selectedNearbyStop.stopName),
                              }}
                            />
                          </Suspense>
                        </ClientOnly>
                      </div>
                    </details>
                  </div>
                )}
              </div>
            </details>
          )}

          {/* Skyline, H-1 and Oʻahu weather: off in the SF test. */}
          {activeRegion().hasTransit && (
            <>
              {browseStation && browseFar && !stationExpanded ? (
                <button
                  type="button"
                  onClick={() => setStationExpanded(true)}
                  className="glass-panel mt-4 flex w-full min-w-0 items-center gap-2 rounded-full px-4 py-3 text-left text-sm"
                  aria-label="Show Skyline station details"
                >
                  <TrainFront className="size-4 shrink-0 text-primary" />
                  <span className="truncate font-semibold text-foreground">
                    {stationLabel(browseStation.stopName)}
                  </span>
                  <span className="truncate text-muted-foreground">
                    {browseUserPoint
                      ? ` · ${Math.max(1, Math.ceil(distanceM(browseUserPoint, browseStation) / 670))} min drive`
                      : ""}
                    {trainsEveryMinutes ? ` · Trains every ${trainsEveryMinutes} min` : ""}
                  </span>
                  <ChevronDown className="ml-auto size-4 shrink-0 text-muted-foreground" />
                </button>
              ) : (
                <section
                  className="glass-panel mt-4 rounded-lg p-4"
                  aria-labelledby="browse-station-title"
                >
                  <div className="flex items-start gap-3">
                    <TrainFront className="mt-5 size-6 shrink-0 text-primary" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold uppercase text-muted-foreground">
                        Skyline station
                      </p>
                      <h2
                        id="browse-station-title"
                        className="text-xl font-semibold text-foreground"
                      >
                        <Select
                          value={browseStation?.stopId ?? ""}
                          onValueChange={(stopId) => {
                            const station = browseStations.find((item) => item.stop_id === stopId);
                            if (!station) return;
                            rememberBrowseStation({
                              stopId: station.stop_id,
                              stopName: station.stop_name ?? "",
                              lat: Number(station.stop_lat),
                              lon: Number(station.stop_lon),
                              ...(browseStation?.userLat !== undefined
                                ? { userLat: browseStation.userLat }
                                : {}),
                              ...(browseStation?.userLon !== undefined
                                ? { userLon: browseStation.userLon }
                                : {}),
                            });
                          }}
                        >
                          <SelectTrigger
                            className="h-auto min-h-11 w-full justify-start gap-2 border-0 bg-transparent px-0 py-1 text-left text-xl font-semibold whitespace-normal shadow-none focus:ring-0 focus-visible:ring-2 [&>span]:line-clamp-none [&>span]:whitespace-normal"
                            aria-label="Choose Skyline station"
                          >
                            <SelectValue
                              placeholder={
                                browseStations.length ? "Choose a station" : "Finding your station…"
                              }
                            />
                          </SelectTrigger>
                          <SelectContent>
                            {browseStations.map((station) => (
                              <SelectItem key={station.stop_id} value={station.stop_id}>
                                {stationLabel(station.stop_name)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </h2>
                      {browseStation && <LandmarkHint name={browseStation.stopName} />}
                    </div>
                    {browseFar && (
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label="Collapse station card"
                        onClick={() => setStationExpanded(false)}
                      >
                        <ChevronDown className="size-4 rotate-180" />
                      </Button>
                    )}
                  </div>
                  {browseStation && (
                    <div className="mt-3 flex flex-wrap gap-1.5 text-xs font-semibold">
                      {browseUserPoint && browseWalkMinutes !== null && browseWalkMinutes <= 18 && (
                        <span className="rounded-full border border-border px-2 py-0.5 text-foreground">
                          Walk {browseWalkMinutes} min ·{" "}
                          {formatDistance(walkingEstimate(browseUserPoint, browseStation).meters)}
                        </span>
                      )}
                      {browseUserPoint && (
                        <span className="rounded-full border border-border px-2 py-0.5 text-foreground">
                          Drive about{" "}
                          {Math.max(1, Math.ceil(distanceM(browseUserPoint, browseStation) / 670))}{" "}
                          min
                        </span>
                      )}
                      {trainsEveryMinutes && (
                        <span className="rounded-full border border-border px-2 py-0.5 text-muted-foreground">
                          Trains every {trainsEveryMinutes} min
                        </span>
                      )}
                      {stationParking && (
                        <span className="rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-primary">
                          {stationParking.status === "limited"
                            ? "Limited parking"
                            : "Park & Ride available"}
                          {stationParking.note ? ` · ${stationParking.note}` : ""}
                        </span>
                      )}
                    </div>
                  )}
                  {browseStation &&
                    browseUserPoint &&
                    browseWalkMinutes !== null &&
                    browseWalkMinutes > 18 &&
                    feederBuses.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5 text-xs font-semibold text-foreground">
                        {feederBuses.slice(0, 2).map((bus) => (
                          <span
                            key={bus.route_short_name}
                            className="rounded-full border border-border px-2 py-0.5"
                          >
                            <Bus className="mr-1 inline size-3" />
                            TheBus {bus.route_short_name} · {bus.ride_minutes} min ride · leaves{" "}
                            {clockFromSeconds(bus.depart_seconds)}
                          </span>
                        ))}
                      </div>
                    )}
                  {browseLocationDenied && browseStation && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Location unavailable · showing a data-derived West Oahu station
                    </p>
                  )}
                  {browseLocationDenied && locationDenied && (
                    <Button
                      variant="link"
                      onClick={() => openSettingsList()}
                      className="mt-1 h-auto px-0 text-xs text-muted-foreground"
                    >
                      Location blocked · see how to allow it
                    </Button>
                  )}

                  {browseStation && (
                    <div
                      className={`mt-4 grid grid-cols-2 gap-3 ${refreshing ? "animate-in fade-in duration-300" : ""}`}
                      aria-label={`Departures from ${stationLabel(browseStation.stopName)}`}
                    >
                      {browseDeparturesLoading && (
                        <p className="text-sm text-muted-foreground">Loading departures…</p>
                      )}
                      {browseDeparturesFailed && (
                        <p className="col-span-2 text-sm text-warning">
                          Rail departure times are not available right now.
                        </p>
                      )}
                      {!browseDeparturesLoading &&
                        !browseDeparturesFailed &&
                        browseDirections.length === 0 && (
                          <p className="col-span-2 text-sm text-muted-foreground">
                            No rail departures are scheduled from this station right now.
                          </p>
                        )}
                      {browseDirections.map((direction) => {
                        const first = direction[0];
                        const second = direction[1];
                        const towardDowntown =
                          first?.terminus_lon !== null &&
                          first?.terminus_lon !== undefined &&
                          first.terminus_lon > browseStation.lon;
                        const endpoint =
                          terminusLabel(first?.direction_terminus) ||
                          stationLabel(first?.trip_headsign) ||
                          "the end of the line";
                        const secondsAway = (first?.departure_seconds ?? 0) - nowSeconds;
                        const minutesAway = Math.max(1, Math.ceil(secondsAway / 60));
                        const nowDeparture = secondsAway >= -30 && secondsAway < 60;
                        const soon = secondsAway >= 60 && secondsAway < 20 * 60;
                        const walk = browseUserPoint
                          ? walkingEstimate(browseUserPoint, browseStation)
                          : null;
                        const walkState = walk
                          ? walk.minutes + 2 <= minutesAway
                            ? "ok"
                            : walk.minutes <= minutesAway
                              ? "tight"
                              : "miss"
                          : null;
                        return (
                          <article
                            key={`${first?.route_id}-${first?.direction_id ?? "x"}`}
                            className="browse-departure-card nalu-card-surface min-w-0 rounded-lg p-3"
                          >
                            <h3 className="text-sm font-semibold text-foreground">
                              {towardDowntown ? "Eastbound" : "Westbound"}
                            </h3>
                            <p className="mt-0.5 text-xs text-muted-foreground">to {endpoint}</p>
                            {first && (
                              <div className="mt-3">
                                <p className="text-2xl font-semibold tabular-nums text-primary">
                                  {nowDeparture ? (
                                    <>
                                      Now{" "}
                                      <span className="block text-xs font-normal text-muted-foreground">
                                        {clockFromSeconds(first.departure_seconds)}
                                      </span>
                                    </>
                                  ) : soon ? (
                                    <>
                                      in {minutesAway} min{" "}
                                      <span className="block text-xs font-normal text-muted-foreground">
                                        {clockFromSeconds(first.departure_seconds)}
                                      </span>
                                    </>
                                  ) : (
                                    clockFromSeconds(first.departure_seconds)
                                  )}
                                </p>
                                {walk && walkState && walk.minutes <= 18 && (
                                  <p
                                    className={`mt-2 text-xs font-medium ${walkState === "ok" ? "text-primary" : "text-warning"}`}
                                  >
                                    {walk.minutes} min walk
                                    {walkState === "tight"
                                      ? " · Tight"
                                      : walkState === "miss"
                                        ? " · You'll miss this one."
                                        : ""}
                                  </p>
                                )}
                                {second && (
                                  <p className="mt-1.5 text-xs text-muted-foreground">
                                    Miss it? Next train at{" "}
                                    {clockFromSeconds(second.departure_seconds)}
                                  </p>
                                )}
                              </div>
                            )}
                          </article>
                        );
                      })}
                    </div>
                  )}
                  <p className="mt-3 text-xs text-muted-foreground">
                    HOLO fare {HOLO_FARES.singleRide} · free TheBus–Skyline transfers for{" "}
                    {HOLO_FARES.transferWindowHours} hours
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Scheduled times · TheBus / DTS
                    {h1HasMeaningfulDelay
                      ? " · H-1 is delayed, so Skyline may be especially useful"
                      : ""}
                  </p>
                </section>
              )}

              {gate.allows("ask_nalu") && <AskNaluIfAvailable origin={browseUserPoint} />}

              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <H1ConditionsCard
                  eastbound={eastboundTraffic}
                  westbound={westboundTraffic}
                  loading={trafficLoading}
                  unavailable={trafficUnavailable}
                  compact
                  className=""
                />
                <details className="glass-panel rounded-lg">
                  <summary className="flex min-h-14 cursor-pointer list-none items-center gap-2 px-4 py-3 [&::-webkit-details-marker]:hidden">
                    <span className="min-w-0 truncate text-sm font-semibold text-foreground">
                      {browseWeatherSummary}
                    </span>
                    <ChevronDown className="ml-auto size-4 shrink-0 text-muted-foreground" />
                  </summary>
                  <div className="border-t border-border px-4 py-3">
                    {browseWeatherLine ? (
                      <p className={`text-sm ${TONE_CLASS[browseWeatherLine.tone]}`}>
                        {browseWeatherLine.text}
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        No weather or air-quality concerns right now.
                      </p>
                    )}
                    <p className="mt-2 text-xs text-muted-foreground">
                      Weather: NWS · Air quality: AirNow / EPA
                    </p>
                  </div>
                </details>
                <RoadworkTile className="sm:col-span-2" />
              </div>
            </>
          )}
        </div>
        {setupDialog}
      </main>
    );
  }

  return (
    <main
      className={`min-h-dvh bg-page-gradient px-5 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))] text-foreground ${verdict === "transit" ? "commute-radiance-rail" : verdict === "drive" ? "commute-radiance-drive" : ""}`}
    >
      <div className="mx-auto flex w-full max-w-[680px] flex-col">
        <CommuteHeader
          heading={arrivingHome ? "Heading home" : inbound ? "Heading west" : "Heading out"}
          timeText={timeText}
          onAccount={() => {
            setRestoreSlot(null);
            setAccountOpen(true);
          }}
          onSettings={() => openSettingsList()}
          onBrowse={() => setPageView("browse")}
        />

        {showApproach && approach && (
          <ApproachBanner
            state={approach.state}
            stopsAway={approach.stopsAway}
            minutesToAlight={approach.minutesToAlight}
            nextStopName={approach.nextStopName}
            alightName={approach.alightName}
            vehicle={approach.vehicle}
            live={approach.live}
            onDismiss={() => setApproachDismissed(`${approach.key}-${approach.state}`)}
          />
        )}
        {lockedMode === "transit" && !(showApproach && approach) && (
          <SettingsHint
            id="transit-stop-alerts"
            label="Stop alerts: choose sound or vibration"
            onOpen={() => openSettingsAt("alerts")}
            className="mt-3 self-start"
          />
        )}

        <div
          role="group"
          aria-label="Trip direction"
          className="mt-3 grid grid-cols-2 gap-1 rounded-full bg-surface-raised p-1"
        >
          {[
            { label: "To destination", value: false },
            { label: "To home", value: true },
          ].map((tab) => (
            <button
              key={tab.label}
              aria-pressed={inbound === tab.value}
              onClick={() => chooseDirection(tab.value)}
              className={`min-h-11 rounded-full text-sm font-semibold transition-colors ${
                inbound === tab.value
                  ? "bg-recommended text-recommended-foreground"
                  : "text-muted-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <DataExpiryNotice />
        {!online && (
          <p
            role="status"
            className="mt-3 rounded-lg border border-border bg-surface-raised px-4 py-3 text-sm text-muted-foreground"
          >
            You’re offline. Your trip stays visible; live traffic and arrivals will refresh when you
            reconnect.
          </p>
        )}

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
                    leave at {clockFromSeconds(transitPick.earliestOption.leave_by_seconds)} ·
                    arrive {clockFromSeconds(transitPick.earliestOption.arrive_seconds)}.
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
                    {carAwayReason ?? "Driving is not available for this trip."}
                  </p>
                ) : (
                  <p className="mt-2 text-sm text-muted-foreground">
                    {driveLoading
                      ? "Checking live traffic…"
                      : "Live traffic is not available right now."}
                  </p>
                )}
                {drivePlan && drivePlan.bufferMinutes > 0 && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Includes {drivePlan.bufferMinutes} min to park and walk in · {driveBasisLabel}
                  </p>
                )}
              </div>

              {arriveByComparison && (
                <div className="space-y-1 text-sm text-muted-foreground">
                  <p className="font-semibold text-foreground">{arriveByComparison.primary.text}</p>
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
          driveArrivalSeconds={
            driveTripEstimate.arrivalTime ?? driveArrival?.expectedSeconds ?? null
          }
          driveWindow={driveWindow}
          driveBufferNote={driveBufferNote}
          driveTotalMinutes={driveDoorToDoorMinutes}
          driveLeaveSeconds={arriveByActive && drivePlan ? drivePlan.leaveBySeconds : null}
          comparison={
            activeRegion().hasTransit ? (
              <TripChoiceCards
                choices={tripChoices}
                selectedKey={selectedChoice}
                commitment={Boolean(commitment)}
                formatMinutes={formatDriveMinutes}
                onSelect={chooseTrip}
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
                        <p className="text-xs font-semibold text-muted-foreground">
                          {signal.label}
                        </p>
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
                    <p>{sourceFreshnessLabel(driveTripEstimate.source, now.getTime())}</p>
                    {activeRegion().hasTransit && (
                      <p className="mt-1">
                        {sourceFreshnessLabel(transitTripEstimate.source, now.getTime())}
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
                    verdict === "drive"
                      ? driveTripEstimate.leaveTime
                      : transitTripEstimate.leaveTime,
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
                        Arrive {clockFromSeconds(liveEta.arriveSeconds)} · {liveEta.remainingMin}{" "}
                        min left
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

        {!commitment &&
          tripDirection.from.lat !== null &&
          tripDirection.from.lon !== null &&
          tripDirection.to.lat !== null &&
          tripDirection.to.lon !== null && (
            <WalkCard
              from={{ lat: tripDirection.from.lat, lon: tripDirection.from.lon }}
              to={{ lat: tripDirection.to.lat, lon: tripDirection.to.lon }}
            />
          )}

        {!commitment &&
          !activeRegion().hasTransit &&
          tripDirection.to.lat !== null &&
          tripDirection.to.lon !== null && (
            <RideCard
              destination={{
                lat: tripDirection.to.lat,
                lon: tripDirection.to.lon,
                name: tripArrivalLabel,
              }}
            />
          )}

        {mapPoints.length >= 2 && (selectedMode === "drive" || Boolean(best)) && (
          <section
            className="map-shell mt-3 overflow-hidden rounded-xl"
            aria-labelledby="trip-map-title"
          >
            <div className="flex items-center justify-between px-4 py-3">
              <div>
                <h2 id="trip-map-title" className="text-sm font-bold text-foreground">
                  Your route
                </h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {tripOriginLabel} to {tripArrivalLabel}
                </p>
              </div>
              <span className="text-xs font-semibold text-muted-foreground">
                {selectedMode === "drive"
                  ? "Direct drive"
                  : `${transitMapSegments.length} trip legs`}
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
                      : transitMapSegments.map((seg) =>
                          seg.mode === "walk"
                            ? "Walk"
                            : seg.mode === "bus"
                              ? "Bus"
                              : seg.mode === "rail"
                                ? "Skyline rail"
                                : "Drive",
                        )
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
                      maneuver={
                        nextTurn
                          ? {
                              glyph: turnGlyph(nextTurn.maneuver.maneuver),
                              distanceText: formatDistance(nextTurn.distanceM),
                              road: nextTurn.maneuver.road ?? nextTurn.maneuver.instruction,
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

        {/* H-1 conditions live on Browse; on a trip, "Nalu is watching" covers the route. */}

        <section className="py-6" aria-labelledby="mode-details-title">
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
                  {driveAvailable &&
                    driveTripEstimate.expectedDurationMinutes !== null &&
                    driveDoorToDoorMinutes !== null &&
                    driveDoorToDoorMinutes > driveTripEstimate.expectedDurationMinutes && (
                      <p className="mt-2 text-sm text-muted-foreground">
                        {Math.round(driveTripEstimate.expectedDurationMinutes)} min of driving in
                        live traffic, plus about{" "}
                        {Math.round(
                          driveDoorToDoorMinutes - driveTripEstimate.expectedDurationMinutes,
                        )}{" "}
                        min to park and walk in.
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
                  {(drive?.hdotScheduledClosures?.length ?? 0) > 0 && (
                    <HdotRoadworkNotice
                      scheduledClosures={drive?.hdotScheduledClosures ?? []}
                      variant="commute"
                      liveDriveMinutes={drive?.trafficMinutes ?? null}
                      delayMinutes={drive?.delayMinutes ?? null}
                    />
                  )}
                  {!driveAvailable && carAwayReason && (
                    <p className="mt-4 text-sm text-muted-foreground">{carAwayReason}</p>
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
                                  ? "Park & ride"
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

        <Button
          variant="outline"
          onClick={endTrip}
          className="mt-2 h-14 w-full border-primary/50 bg-primary/10 text-base font-semibold text-primary hover:bg-primary/15 hover:text-primary"
        >
          <RotateCcw className="size-5" /> End trip
        </Button>

        <footer className="mt-auto flex items-center justify-between border-t border-border pt-5 text-sm text-muted-foreground">
          <span>
            {activeRegion().hasTransit
              ? "Bus and rail times from TheBus timetable"
              : "Drive times from TomTom live traffic"}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={refresh}
            disabled={refreshing}
            className="text-muted-foreground hover:text-foreground"
          >
            <RefreshCw className={refreshing ? "animate-spin" : ""} /> Refresh
          </Button>
        </footer>
      </div>

      {setupDialog}
    </main>
  );
}
