import { createPortal } from "react-dom";
import { ClientOnly, Link, createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { debugLog, endDebugSession, flushDebugLogs, startDebugSession } from "@/lib/debug-log";
import {
  ArrowRight,
  BriefcaseBusiness,
  Bus,
  Car,
  Check,
  ChevronDown,
  ChevronRight,
  Clock3,
  Footprints,
  House,
  Dumbbell,
  GraduationCap,
  MapPin,
  Pencil,
  Plus,
  LocateFixed,
  Navigation,
  Radio,
  RefreshCw,
  RotateCcw,
  Search,
  Settings,
  TrainFront,
  UserRound,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { reverseGeocode, searchPlaces, type PlaceSuggestion } from "@/lib/geocode.functions";
import { RouteCorridor } from "@/components/commute/RouteCorridor";
import { driveTime, type DriveTime } from "@/lib/drive.functions";
import { formatDriveMinutes } from "@/lib/drive/traffic-summary";
import { busArrivals, type BusArrival, type BusArrivalsResult } from "@/lib/bus-arrivals.functions";
import { confirmedLiveBus } from "@/lib/bus-match";
import { outdoorConditions, type MomentConditions } from "@/lib/weather.functions";
import {
  incidentImpactText,
  incidentText,
  incidentHeadline,
  incidentDetailText,
  mainlineClearNote,
  trafficDelayText,
} from "@/lib/traffic-incidents";
import {
  detectTrafficAlert,
  postCommuteNotification,
  requestCommuteNotificationPermission,
  speakCommuteAlert,
  primeSpeech,
  keepNavigationAudioAlive,
  type TrafficAlertSnapshot,
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
import {
  detectLocationPlatform,
  isPermissionDeniedError,
  queryLocationPermission,
} from "@/lib/location-permission";
import {
  clockInputValue,
  commutePresets,
  findByKind,
  kindLabel,
  hasValidCoordinates,
  makeSavedPlace,
  migrateSavedPlaces,
  parseSavedPlaces,
  parseClockInput,
  removePlace,
  swapHomeWork,
  upsertPlace,
  LEGACY_SAVED_PLACES_KEY,
  SAVED_PLACES_KEY,
  PLACE_KINDS,
  type PlaceKind,
  type SavedPlace,
} from "@/lib/saved-places";
import { latestRailArrival } from "@/lib/leave-by";
import { honoluluSecondsToIso, planDriveArrivalWithRange, solveFutureDrive } from "@/lib/drive/planner";
import { carAvailableForDrive } from "@/lib/car-state";
import { inboundPlannerCoordinates, resolveTripDirection } from "@/lib/trip-direction";
import { createClientRateWindow } from "@/lib/client-rate-limit";
import { decideArrival, decideTrip, type DecisionState } from "@/lib/decision/commute-decision";
import { driveEstimate, transitEstimate, type EstimateSource } from "@/lib/decision/trip-estimate";
import { collectArriveByOptions } from "@/lib/rail/arrive-by-search";
import { findInboundOptions, hubAccessFallback } from "@/lib/rail/inbound-fallback";
import { parseLockedItinerary } from "@/lib/rail/locked-itinerary";
import { ArriveByControls, type PlanMode } from "@/components/commute/ArriveByControls";
import { VerdictCard } from "@/components/commute/VerdictCard";
import { DecisionBars } from "@/components/commute/DecisionBars";
import { FareNotice, LandmarkHint } from "@/components/commute/TransitNotices";
import { AccountSection } from "@/components/account/AccountSection";
import { AccountButton, AccountDialog, type PlacesSyncStatus } from "@/components/account/AccountDialog";
import { useAuth } from "@/hooks/use-auth";
import { useWakeLock } from "@/hooks/use-wake-lock";
import { arrivalRange, destinationAccess } from "@/lib/destination-access";
import {
  VoiceGuide,
  isUsableNavigationFix,
  metersBetween,
  nextManeuver,
  smoothBearing,
  turnGlyph,
} from "@/lib/navigation-voice";
import { track } from "@/lib/analytics";
import { NotificationsSection } from "@/components/account/NotificationsSection";
import { AnalyticsConsentBanner, PrivacySection } from "@/components/account/PrivacySection";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { HOLO_FARES } from "@/lib/fares";
import { AskNalu, BeatTheRush, MorningPulse, WeeklyDigestCard } from "@/components/ai/NaluAi";
import { rescueAdvice } from "@/lib/nalu-ai.functions";
import { finishTripLog, startTripLog } from "@/lib/trip-log";

const NearbyTransitMap = lazy(() => import("@/components/NearbyTransitMap"));
import type { NearbyMapStop } from "@/components/NearbyTransitMap";
const CommuteRouteMap = lazy(() => import("@/components/commute/CommuteRouteMap"));
const LiveNavMap = lazy(() => import("@/components/commute/LiveNavMap"));
const WalkingMicroMap = lazy(() => import("@/components/commute/WalkingMicroMap"));

function WaveMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 44" fill="none" className={className} aria-hidden="true">
      <path
        d="M3 32C11 21 18 21 25 31C32 41 39 41 46 31C51 24 56 24 61 29"
        stroke="currentColor"
        strokeWidth="2.7"
        strokeLinecap="round"
        opacity=".7"
      />
      <g transform="translate(19 4)">
        <ellipse className="shell" cx="13" cy="16" rx="11" ry="8.2" />
        <path className="detail" d="M13 8v16M4 15h18M6.5 11.5 13 16l6.5-4.5M6.5 19.5 13 16l6.5 3.5" />
        <path className="body" d="M3 13.5 0 10.5 1.5 17 4.5 16.5ZM23 13.5l3-3-1.5 6.5-3-.5ZM8 22l-3 4.5 5-2.5ZM18 22l3 4.5-5-2.5Z" />
        <path className="body" d="M10.5 23.5h5L13 27Z" />
      </g>
    </svg>
  );
}

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Nalu | Rail or drive on Oʻahu?" },
      {
        name: "description",
        content: "Rail or drive? Compare Skyline, TheBus, and traffic for your Oʻahu commute. Nalu helps you choose and arrive on time.",
      },
      { property: "og:title", content: "Nalu | Rail or drive on Oʻahu?" },
      {
        property: "og:description",
        content: "Compare Skyline, TheBus, and driving for your Oʻahu commute. Know what to take and when to leave.",
      },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "Nalu" },
      { property: "og:url", content: "https://ridewithnalu.lovable.app/" },
      { property: "og:locale", content: "en_US" },
      { property: "og:image", content: "https://ridewithnalu.lovable.app/social-card.png" },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Nalu | Rail or drive on Oʻahu?" },
      { name: "twitter:description", content: "A clear commute choice for Skyline, TheBus, and driving on Oʻahu." },
      { name: "twitter:image", content: "https://ridewithnalu.lovable.app/social-card.png" },
    ],
    links: [{ rel: "canonical", href: "https://ridewithnalu.lovable.app/" }],
    scripts: [{
      type: "application/ld+json",
      children: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        name: "Nalu",
        url: "https://ridewithnalu.lovable.app/",
        image: "https://ridewithnalu.lovable.app/social-card.png",
        description: "Nalu compares rail, bus, and driving for Oʻahu commutes.",
        applicationCategory: "TravelApplication",
        operatingSystem: "Web",
        areaServed: { "@type": "Place", name: "Oʻahu, Hawaiʻi" },
        featureList: ["Skyline and TheBus trip planning", "Drive and transit comparison", "Arrive By planning"],
      }),
    }],
  }),
  component: Index,
});

type Setup = {
  homeStopId: string;
  homeStopName: string;
  homeLat: number | null;
  homeLon: number | null;
  destinationName: string;
  destinationAddress: string;
  destLat: number | null;
  destLon: number | null;
  /** Arriving stop: served by routes coming from the rail transfer points. */
  destStopId: string;
  destStopName: string;
  destStopWalkM: number | null;
  /** Boarding stop for the trip home: served by routes heading back toward the rail line. */
  destReturnStopId: string;
  destReturnStopName: string;
  destReturnWalkM: number | null;
  allowDrive: boolean;
};

type Leg = {
  kind: "access" | "rail" | "connect" | "egress";
  mode: "walk" | "drive" | "bus" | "rail";
  route_short: string | null;
  route_long: string | null;
  headsign: string | null;
  /** Display names only; identity comes from the GTFS stop ids below. */
  from: string | null;
  to: string | null;
  from_stop_id?: string | null | undefined;
  to_stop_id?: string | null | undefined;
  depart_seconds: number | null;
  arrive_seconds: number | null;
  minutes: number | null;
};

type RailLineStation = {
  stop_id: string;
  stop_name: string | null;
  stop_lat: number | null;
  stop_lon: number | null;
  line_sequence: number;
};

type TransitLegSequence = {
  legIndex: number;
  mode: "bus" | "rail";
  points: Array<{ stopId: string; stopName: string; lat: number; lon: number }>;
};

/** Anything with a name and a point: a suggestion, a saved place, or a draft. */
type PointLike = { name: string; address: string; lat: number; lon: number };

type BusStopTarget = {
  stopId: string;
  scheduled: Array<{
    routeShortName: string | null;
    headsign: string | null;
    scheduledSeconds: number;
  }>;
};

type Option = {
  leave_by_seconds: number;
  depart_seconds: number;
  arrive_seconds: number;
  total_minutes: number;
  legs: Leg[];
};

/** Departure time alone is not unique: distinct routes can leave together. */
function optionIdentity(option: Option) {
  return `${option.leave_by_seconds}:${option.depart_seconds}:${option.arrive_seconds}:${option.total_minutes}:${option.legs.map((leg) => `${leg.mode}:${leg.route_short ?? ""}:${leg.from_stop_id ?? leg.from ?? ""}:${leg.to_stop_id ?? leg.to ?? ""}`).join("|")}`;
}

const STORAGE_KEY = "nalu-setup-v3";
const SETUP_DISMISSED_KEY = "nalu-setup-dismissed-v1";
const BROWSE_STATION_KEY = "nalu-browse-station-v1";
const BROWSE_LOCATION_DENIED_KEY = "nalu-browse-location-denied-v1";
const LOCATION_DENIED_KEY = "nalu-location-denied-v1";
const KAPOLEI_POINT = { lat: 21.3358, lon: -158.0798 };
const DOWNTOWN_POINT = { lat: 21.3099, lon: -157.8644 };
const DIRECTION_KEY = "nalu-direction-v1";
const PARKED_KEY = "nalu-parked-v1";
const OVERRIDE_MS = 2 * 60 * 60 * 1000;

type RailStation = {
  stop_id: string;
  stop_name: string | null;
  stop_lat: number | null;
  stop_lon: number | null;
};

/**
 * One canonical rail-station query. Browse, the setup picker, the maps and trip
 * planning all read the same cached GTFS station list.
 */
function useRailStations(enabled: boolean) {
  return useQuery({
    queryKey: ["rail-stations"],
    enabled,
    staleTime: 6 * 60 * 60_000,
    queryFn: async (): Promise<RailStation[]> => {
      const { data, error } = await supabase.rpc("rail_stations");
      if (error) throw error;
      return (data ?? []) as RailStation[];
    },
  });
}

/** Minutes of padding on the rail chain, and how much a transfer can slip. */
const RAIL_BUFFER_MIN = 3;
const RAIL_SLIP_MIN = 4;
/** Under this gap, neither option really wins. */
const TOSS_UP_MIN = 5;
/** A long wait for the first train tips the choice toward the car. */
const LONG_WAIT_MIN = 25;
const ACTIVE_TRIP_KEY = "nalu-active-trip-v1";
const PLAN_MODE_KEY = "nalu-plan-mode-v1";
const ARRIVE_BY_KEY = "nalu-arrive-by-v1";
const COMMIT_KEY = "nalu-committed-mode-v1";
const LOCKED_OPTION_KEY = "nalu-locked-itinerary-v1";
const LIVE_ROUTE_CACHE_KEY = "nalu-live-route-v1";

/** The mode a commuter has committed to for the trip underway. */
type Commitment = { mode: "rail" | "drive"; at: number };
type DecisionSnapshot = {
  key: string;
  state: "drive" | "rail" | "same";
  driveMinutes: number | null;
  railMinutes: number | null;
  driveDelayMinutes: number | null;
  railWaitMinutes: number | null;
  busWaitMinutes: number | null;
  majorIncident: boolean;
};

function changedMinutes(now: number | null, previous: number | null) {
  if (now === null || previous === null) return null;
  const delta = Math.round(now - previous);
  return Math.abs(delta) >= 2 ? delta : null;
}

function parseCommitment(raw: string | null): Commitment | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<Commitment>;
    if (value.mode !== "rail" && value.mode !== "drive") return null;
    return { mode: value.mode, at: typeof value.at === "number" ? value.at : Date.now() };
  } catch {
    return null;
  }
}

const LEGACY_STORAGE_PREFIX = ["ki", "ne"].join("");

type DirectionOverride = { inbound: boolean; at: number };
/** Where the car is today: at home, left at the station, or driven all the way. */
type CarPlace = "home" | "station" | "destination";
type ParkedCar = { date: string; station: string; place?: CarPlace };
type BrowseStation = {
  stopId: string;
  stopName: string;
  lat: number;
  lon: number;
  userLat?: number;
  userLon?: number;
};
type BrowseDeparture = {
  departure_seconds: number;
  departure_time: string;
  route_id: string;
  route_long_name: string;
  route_short_name: string;
  stop_name: string;
  trip_headsign: string;
  direction_id: number | null;
  trip_id: string;
  direction_terminus: string;
  ride_minutes: number;
  terminus_lon: number | null;
};

type NearbyArrival = {
  departure_seconds: number;
  departure_time: string;
  route_short_name: string | null;
  route_long_name: string | null;
  headsign: string | null;
};

type NearbyStop = {
  stopId: string;
  stopName: string;
  lat: number;
  lon: number;
  routeType: number;
  distanceM: number;
  arrivals: NearbyArrival[];
};

type Coords = { lat: number; lon: number };

/** A stretch of the trip spent outside, with where and when it happens. */
type OutdoorMoment = {
  id: string;
  /** Index of the leg this sits under; -2 is the drive comparison. */
  legIndex: number;
  kind:
    | "wait-feeder"
    | "drive-station"
    | "platform"
    | "transfer-walk"
    | "wait-connect"
    | "final-walk"
    | "drive-route";
  lat: number;
  lon: number;
  offsetMinutes: number;
  outdoorMinutes: number;
  minutes?: number;
  label?: string | null;
};

type WeatherLine = { text: string; tone: "rain" | "heat" | "air"; source: string };

/** Rain is worth a word above 40%, or above 50% when the rider is driving. */
function rainLine(moment: OutdoorMoment, reading: MomentConditions): string | null {
  const chance = reading.precipPercent;
  if (chance === null) return null;
  const driving = moment.kind === "drive-station" || moment.kind === "drive-route";
  if (chance <= (driving ? 50 : 40)) return null;
  switch (moment.kind) {
    case "wait-feeder":
      return "Rain likely while waiting for your bus";
    case "drive-station":
      return `Light rain at ${moment.label || "the station"} when you arrive`;
    case "platform":
      return "Showers likely on the platform";
    case "transfer-walk":
      return `Rain during your ${moment.minutes ?? 0} min walk between rides`;
    case "wait-connect":
      return moment.label
        ? `Showers possible while waiting for Route ${moment.label}`
        : "Showers possible while waiting for your bus";
    case "final-walk":
      return `Rain likely during your ${moment.minutes ?? 0} min walk`;
    case "drive-route":
      return "Rain on the H-1 · allow extra time";
    default:
      return null;
  }
}

/** Heat and humidity always arrive as a single line, never two. */
function heatLine(moment: OutdoorMoment, reading: MomentConditions): WeatherLine | null {
  // Driving is indoors; heat only matters where the rider is standing outside.
  if (moment.kind === "drive-station" || moment.kind === "drive-route") return null;
  const feels = reading.heatIndexF;
  const humid = (reading.humidityPercent ?? 0) > 75;
  const hot = feels !== null && feels > 88;
  if (hot && humid) {
    return {
      text: `Hot and humid · feels like ${feels}°F · limit time outdoors`,
      tone: "heat",
      source: "NWS",
    };
  }
  if (hot) {
    const where =
      moment.kind === "wait-feeder"
        ? "Hot at bus stop"
        : moment.kind === "platform"
          ? "Hot on the platform"
          : "Hot";
    return { text: `${where} · feels like ${feels}°F`, tone: "heat", source: "NWS" };
  }
  if (humid) {
    return {
      text: feels !== null ? `Humid · feels like ${feels}°F` : "Humid outside right now",
      tone: "rain",
      source: "NWS",
    };
  }
  return null;
}

function airLine(category: number): WeatherLine | null {
  if (category === 2) {
    return {
      text: "Air quality: Moderate · sensitive groups limit outdoor time",
      tone: "rain",
      source: "AirNow / EPA",
    };
  }
  if (category === 3) {
    return {
      text: "Air quality: Poor · limit outdoor exposure if sensitive",
      tone: "air",
      source: "AirNow / EPA",
    };
  }
  if (category >= 4) {
    return {
      text: "Air quality: Unhealthy · minimize time outdoors",
      tone: "air",
      source: "AirNow / EPA",
    };
  }
  return null;
}

const TONE_CLASS: Record<WeatherLine["tone"], string> = {
  rain: "text-alert-rain",
  heat: "text-alert-heat",
  air: "text-alert-air",
};

/** Straight-line metros between two points; good enough to tell "am I there yet". */
function distanceM(a: Coords, b: Coords) {
  const toRad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * toRad;
  const dLon = (b.lon - a.lon) * toRad;
  const mid = ((a.lat + b.lat) / 2) * toRad;
  const x = dLon * Math.cos(mid);
  return Math.sqrt(dLat * dLat + x * x) * 6371000;
}

function readJson<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

const emptySetup: Setup = {
  homeStopId: "",
  homeStopName: "",
  homeLat: null,
  homeLon: null,
  destinationName: "",
  destinationAddress: "",
  destLat: null,
  destLon: null,
  destStopId: "",
  destStopName: "",
  destStopWalkM: null,
  destReturnStopId: "",
  destReturnStopName: "",
  destReturnWalkM: null,
  allowDrive: false,
};

function honoluluParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Pacific/Honolulu",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })
    .format(date)
    .split(":")
    .map(Number);
  return { hour: parts[0] ?? 0, minute: parts[1] ?? 0, second: parts[2] ?? 0 };
}

function honoluluSeconds(date: Date) {
  const { hour, minute, second } = honoluluParts(date);
  return hour * 3600 + minute * 60 + second;
}

function alohaGreeting(_date: Date, name?: string) {
  return name ? `Aloha, ${name}` : "Aloha";
}

/** First name from the signed-in profile: full name, then given name, then username. */
function profileFirstName(
  user: { user_metadata?: Record<string, unknown>; email?: string | null } | null,
) {
  const meta = user?.user_metadata ?? {};
  const fullName = typeof meta["full_name"] === "string" ? meta["full_name"].trim() : "";
  if (fullName) return fullName.split(/\s+/)[0];
  const given = typeof meta["given_name"] === "string" ? meta["given_name"].trim() : "";
  if (given) return given;
  const username =
    typeof meta["preferred_username"] === "string" ? meta["preferred_username"].trim() : "";
  if (username) return username.split(/[.@]/)[0];
  const email = typeof user?.email === "string" ? user.email : "";
  if (email) return email.split("@")[0];
  return undefined;
}

function honoluluIsoDow(date: Date) {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: "Pacific/Honolulu",
    weekday: "short",
  }).format(date);
  const order = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  return order.indexOf(weekday) + 1;
}

function honoluluDateKey(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Pacific/Honolulu",
    dateStyle: "short",
  }).format(date);
}

function clockFromSeconds(seconds: number | null | undefined) {
  if (seconds === null || seconds === undefined) return "—";
  const total = ((seconds % 86400) + 86400) % 86400;
  const hour24 = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const suffix = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${hour12}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

/**
 * Title case that respects the 'okina: a letter after ' or ʻ stays lowercase,
 * so KUALAKA'I reads Kualaka'i and never Kualaka'I.
 */
function titleCase(value: string | null | undefined) {
  if (!value) return "";
  return expandName(value)
    .toLowerCase()
    .replace(
      /(^|[\s\-/&(.])([a-z\u02bb\u2018'])/g,
      (_match, lead: string, letter: string) => lead + letter.toUpperCase(),
    )
    .replace(
      /([\u02bb\u2018'])([A-Z])/g,
      (_match, mark: string, letter: string) => mark + letter.toLowerCase(),
    );
}

/** GTFS ships abbreviations; spell them out for reading, database untouched. */
const ABBREVIATIONS: Array<[RegExp, string]> = [
  [/\bTRN\s+CTR\b/gi, "Transit Center"],
  [/\bTRANSIT\s+CTR\b/gi, "Transit Center"],
  [/\bCOMM\s+COLL\b/gi, "Community College"],
  [/\bHWY\b/gi, "Highway"],
  [/\bSTN\b/gi, "Station"],
  [/\bINTL\b/gi, "International"],
  [/\bOPP\b/gi, "Opposite"],
  [/\bJCT\b/gi, "Junction"],
  [/\bCTR\b/gi, "Center"],
  [/\bPK\b/gi, "Park"],
];

function expandName(value: string | null | undefined) {
  if (!value) return "";
  let out = value;
  for (const [pattern, replacement] of ABBREVIATIONS) out = out.replace(pattern, replacement);
  return out;
}

/** Rail names on the Skyline screen: expanded, with the redundant suffix gone. */
function stationLabel(value: string | null | undefined) {
  const expanded = expandName(value)
    .replace(/\s*\bSkyline\b\s*(Station)?\s*$/i, "")
    .replace(/\s*\bStation\b\s*$/i, "");
  return titleCase(expanded.trim() || expandName(value));
}

/** Full line endpoint: remove the redundant brand while retaining useful place type. */
function terminusLabel(value: string | null | undefined) {
  const expanded = expandName(value)
    .replace(/\bSkyline\b\s*/gi, "")
    .replace(/\bTransit Center Station\b/gi, "Transit Center");
  return titleCase(expanded.trim());
}

/** US customary distance: feet under 0.1 miles, otherwise miles to one decimal. */
function formatDistance(meters: number) {
  const miles = meters / 1609.344;
  if (miles < 0.1) return `${Math.round((meters * 3.28084) / 10) * 10} ft`;
  return `${miles.toFixed(1)} miles`;
}

/** Walking estimate at 3 mph, matching the trip planner's access-leg pace. */
function walkingEstimate(from: Coords, to: Coords) {
  const meters = distanceM(from, to);
  return { meters, minutes: Math.max(1, Math.ceil(meters / 80.47)) };
}

function nearbyServiceLabel(stop: NearbyStop) {
  const arrival = stop.arrivals[0];
  if (!arrival) return stop.routeType === 1 ? "Skyline" : "No arrivals";
  const route =
    stop.routeType === 1
      ? "Skyline"
      : arrival.route_short_name?.trim() || arrival.route_long_name?.trim() || "Bus";
  const destination = arrival.headsign
    ? stop.routeType === 1
      ? stationLabel(arrival.headsign)
      : titleCase(arrival.headsign)
    : "";
  return destination ? `${route} · ${destination}` : route;
}

function vehicleName(leg: Leg) {
  if (leg.mode === "rail") {
    const line = stationLabel(leg.route_long) || "Skyline";
    return leg.headsign ? `${line} (toward ${stationLabel(leg.headsign)})` : line;
  }
  if (leg.mode === "bus") {
    const label = leg.route_short ? `Route ${leg.route_short}` : "Bus";
    return leg.headsign ? `${label} (toward ${titleCase(leg.headsign)})` : label;
  }
  const verb = leg.mode === "drive" ? "Drive" : "Walk";
  // Name both ends: the last leg is only "home" when the trip ends at home.
  const to = titleCase(leg.to);
  if (!to) return leg.kind === "egress" ? `${verb} home` : verb;
  return `${verb} to ${to}`;
}

function transitStopName(leg: Leg, endpoint: "from" | "to") {
  const value = leg[endpoint];
  if (leg.mode === "rail") {
    const station = stationLabel(value);
    return station ? `${station} Station` : "the station";
  }
  return titleCase(value) || "the stop";
}

function modeIcon(mode: Leg["mode"]) {
  if (mode === "rail") return TrainFront;
  if (mode === "bus") return Bus;
  if (mode === "drive") return Car;
  return Footprints;
}

function trafficStatus(delayMinutes: number, incident?: DriveTime["incidents"][number]) {
  const delay = Math.max(0, Math.round(delayMinutes));
  if (incident) {
    const description = incident.description.trim().toLowerCase();
    const crash = /accident|crash|collision/.test(description);
    const label = crash
      ? `Crash reported${incident.road ? ` · ${incident.road}` : ""}`
      : `Traffic incident reported${incident.road ? ` · ${incident.road}` : ""}`;
    return { label, className: "text-destructive" };
  }
  if (delay === 0) return { label: "Clear", className: "text-primary" };
  if (delay > 20) return { label: `Heavy traffic · +${delay} min`, className: "text-destructive" };
  if (delay >= 10) return { label: `Slower than usual · +${delay} min`, className: "text-chart-4" };
  return { label: `Slightly slower · +${delay} min`, className: "text-foreground" };
}

function sourceFreshnessLabel(source: EstimateSource, nowMs: number) {
  if (source.quality === "unavailable") {
    return source.basis === "live" ? "Live traffic · Not available" : "Transit schedule · Not available";
  }
  if (source.fetchedAt === null) {
    return source.basis === "live" ? "Live traffic · Update time unknown" : "Transit schedule · Update time unknown";
  }

  const ageSeconds = Math.max(0, Math.round((nowMs - source.fetchedAt) / 1000));
  const age =
    ageSeconds < 10
      ? "just now"
      : ageSeconds < 60
        ? `${ageSeconds} sec ago`
        : `${Math.round(ageSeconds / 60)} min ago`;

  let label = source.basis === "live"
    ? "Live traffic"
    : source.name.includes("TheBus")
      ? "Bus schedule"
      : "Train schedule";

  if (source.basis === "future-estimate") label = "Future traffic estimate";

  return `${label} · Updated ${age}${source.quality === "stale" ? " · Stale" : ""}`;
}

function H1ConditionsCard({
  eastbound,
  westbound,
  loading,
  unavailable,
  weatherLine,
  compact = false,
}: {
  eastbound: DriveTime | undefined;
  westbound: DriveTime | undefined;
  loading: boolean;
  unavailable: boolean;
  weatherLine?: WeatherLine | null;
  compact?: boolean;
}) {
  if (compact) {
    const rows = [
      { label: "Eastbound", data: eastbound },
      { label: "Westbound", data: westbound },
    ];
    return (
      <details className="mt-4 rounded-lg border border-border bg-surface-raised/70">
        <summary className="flex min-h-14 cursor-pointer list-none items-center gap-2 px-4 py-3 [&::-webkit-details-marker]:hidden">
          <span className="font-semibold text-foreground">H-1 live</span>
          <span className="ml-auto flex flex-wrap justify-end gap-2">
            {loading ? (
              <span className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                Checking traffic…
              </span>
            ) : unavailable ? (
              <span className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                Not available
              </span>
            ) : (
              rows.map(({ label, data }) => {
                const status = data ? trafficStatus(data.delayMinutes, data.incidents[0]) : null;
                return (
                  <span
                    key={label}
                    className={`rounded-full bg-background px-2.5 py-1 text-xs font-semibold ${status?.className ?? "text-muted-foreground"}`}
                  >
                    {label} · {status?.label ?? "—"}
                  </span>
                );
              })
            )}
          </span>
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
        </summary>
        {!loading && !unavailable && eastbound && westbound && (
          <div className="border-t border-border px-4 pb-4">
            {rows.map(({ label, data }) => {
              const incident = data?.incidents[0];
              const note = mainlineClearNote(incident, data?.delayMinutes);
              return incident ? (
                <div key={label} className="mt-3">
                  <p className="text-sm text-foreground">
                    <span className="font-semibold">{label}:</span> {incidentText(incident)}
                    {incident.delayMinutes ? ` · +${incident.delayMinutes} min` : ""}
                  </p>
                  {note && <p className="mt-1 text-xs text-muted-foreground">{note}</p>}
                  <p className="mt-1 text-xs font-medium text-muted-foreground">
                    {incidentImpactText(incident)}
                  </p>
                </div>
              ) : null;
            })}
            <p className="mt-3 text-[10px] text-muted-foreground">Traffic: TomTom</p>
          </div>
        )}
      </details>
    );
  }
  return (
    <section
      className="verdict-lift mt-7 rounded-lg border border-border p-5"
      aria-labelledby="h1-conditions-title"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="h1-conditions-title" className="text-lg font-semibold">
          H-1 conditions
        </h2>
        <span className="shrink-0 text-[10px] text-muted-foreground">TomTom</span>
      </div>
      {loading && <p className="mt-4 text-sm text-muted-foreground">Checking live traffic…</p>}
      {unavailable && (
        <p className="mt-4 text-sm text-muted-foreground">Live traffic is not available right now.</p>
      )}
      {!loading && !unavailable && eastbound && westbound && (
        <div className="mt-3 divide-y divide-border">
          {[
            { label: "H-1 Eastbound (toward town)", data: eastbound },
            { label: "H-1 Westbound (toward Kapolei)", data: westbound },
          ].map((item) => {
            const status = trafficStatus(item.data.delayMinutes, item.data.incidents[0]);
            const incident = item.data.incidents[0];
            return (
              <div key={item.label} className="py-3">
                <div className="flex min-h-8 items-center justify-between gap-4">
                  <span className="text-sm text-foreground">{item.label}</span>
                  <span
                    className={`shrink-0 text-right text-sm font-semibold tabular-nums ${status.className}`}
                  >
                    {status.label}
                  </span>
                </div>
                {incident && (
                  <div className="mt-2 rounded-lg bg-surface-raised px-3 py-2 text-xs text-muted-foreground">
                    <p>
                      {incidentText(incident)}
                      {incident.delayMinutes ? ` · +${incident.delayMinutes} min` : ""}
                    </p>
                    {mainlineClearNote(incident, item.data.delayMinutes) && (
                      <p className="mt-1">{mainlineClearNote(incident, item.data.delayMinutes)}</p>
                    )}
                    <p className="mt-1 font-medium">{incidentImpactText(incident)}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {weatherLine && (
        <p className={`mt-4 text-xs ${TONE_CLASS[weatherLine.tone]}`}>
          {weatherLine.text}
          <span className="ml-1 text-[10px] text-muted-foreground">{weatherLine.source}</span>
        </p>
      )}
    </section>
  );
}

function NaluPageNav({ current, onBrowse, onTrip }: { current: "browse" | "commute"; onBrowse: () => void; onTrip: () => void }) {
  const itemClass = "flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-full px-3 text-xs font-semibold transition-colors";
  const activeClass = "bg-recommended text-recommended-foreground shadow-sm";
  const inactiveClass = "text-muted-foreground hover:bg-background/60 hover:text-foreground";
  return (
    <nav className="mt-4 flex items-center gap-1 rounded-full border border-border/70 bg-surface-raised/70 p-1 backdrop-blur-md" aria-label="Nalu pages">
      <Link to="/welcome" className={itemClass + " " + inactiveClass} aria-label="Nalu landing page"><House className="size-3.5" />Nalu</Link>
      <button type="button" onClick={onBrowse} className={itemClass + " " + (current === "browse" ? activeClass : inactiveClass)} aria-current={current === "browse" ? "page" : undefined}><MapPin className="size-3.5" />Browse</button>
      <button type="button" onClick={onTrip} className={itemClass + " " + (current === "commute" ? activeClass : inactiveClass)} aria-current={current === "commute" ? "page" : undefined}><Navigation className="size-3.5" />Trip</button>
    </nav>
  );
}

function Index() {
  const { user, loading: authLoading, signedInAt } = useAuth();
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
  const [selectedMode, setSelectedMode] = useState<"rail" | "drive">("rail");
  // Once the commuter is underway the chosen mode is locked: the verdict must
  // never flip a driver onto rail, or a rider onto the freeway, mid-trip.
  const [commitment, setCommitment] = useState<Commitment | null>(null);
  // The itinerary boarded, held for the duration of a locked transit trip.
  const lockedOptionRef = useRef<Option | null>(null);
  const lockedItineraryCandidate = useRef<Option | null>(null);
  const decisionHistoryRef = useRef<{ key: string; state: "drive" | "rail" | "same"; snapshot: DecisionSnapshot | null } | null>(null);
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
      if (storedCommitment.mode === "rail")
        lockedOptionRef.current = parseLockedItinerary(window.localStorage.getItem(LOCKED_OPTION_KEY));
    }
    const storedMode = window.localStorage.getItem(PLAN_MODE_KEY);
    if (storedMode === "arrive-by" || storedMode === "leave-now") setPlanMode(storedMode);
    setArriveByInput(window.localStorage.getItem(ARRIVE_BY_KEY) ?? "");
    setHydrated(true);
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

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
        if (writes.some((result) => result.error)) throw new Error("Could not save account preferences");
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
    return () => { cancelled = true; window.clearTimeout(timer); };
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
    setPlanMode(next);
    window.localStorage.setItem(PLAN_MODE_KEY, next);
  }

  function chooseArriveBy(next: string) {
    setArriveByInput(next);
    window.localStorage.setItem(ARRIVE_BY_KEY, next);
  }

  /** Commit to a mode for the trip underway and stop the verdict changing it. */
  function commitMode(next: "rail" | "drive") {
    requestCommuteNotificationPermission();
    const entry: Commitment = { mode: next, at: Date.now() };
    const driveEst = driveTripEstimate.expectedDurationMinutes;
    startTripLog({
      mode: next,
      startedAt: entry.at,
      chosenMinutes: next === "drive" ? driveEst : railMinutes,
      otherMinutes: next === "drive" ? railMinutes : driveEst,
    });
    track("active_trip_started", { mode: next });
    setCommitment(entry);
    setSelectedMode(next);
    // Freeze the itinerary in front of the rider, transfers included.
    lockedOptionRef.current = next === "rail" ? lockedItineraryCandidate.current : null;
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
  function chooseMode(next: "rail" | "drive") {
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
    setSelectedMode("rail");
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
    setSelectedMode("rail");
    setOnboardingOpen(false);
    setSettingsOpen(false);
  }, [signedInAt]);

  const timeParts = useMemo(
    () =>
      new Intl.DateTimeFormat("en-US", {
        timeZone: "Pacific/Honolulu",
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
  const { data: browseStations = [] } = useRailStations(hydrated);
  // plan_inbound's station is the *arrival* station. The setup station is
  // nearest the selected origin, so resolve a new one for westbound trips.
  const { data: inboundStation, isLoading: inboundStationLoading,
    isError: inboundStationFailed } = useQuery({
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
  const arrivalStationId = inbound && !reverseTrip
    ? inboundStation?.stop_id ?? null : setup.homeStopId;
  const arrivalStationName = inbound && !reverseTrip
    ? inboundStation?.stop_name ?? "" : setup.homeStopName;
  const railConfigured = configured && (inbound
    ? Boolean(arrivalStationId || browseStations.length)
    : Boolean(setup.homeStopId && setup.destStopId));
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
  const scheduleAfterSeconds = online ? afterSeconds : lastOnlineScheduleSeconds.current ?? afterSeconds;
  // Where today's car is. With station driving enabled, an unrecorded return
  // starts with the car at the home station; an explicit same-day location wins.
  const parkedToday = parked && parked.date === honoluluDateKey(now) ? parked : null;
  const carPlace: CarPlace =
    parkedToday?.place ?? (reverseTrip && setup.allowDrive ? "station" : "home");
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
          : !inbound && carPlace === "destination"
            ? `Your car is at ${setup.destinationName || "your destination"}.`
            : null;

  // An outbound plan starts at home. A station marker left by an unfinished
  // earlier plan is stale and must not suppress the drive option or contradict
  // a drive-to-station first leg.
  useEffect(() => {
    if (!hydrated || inbound || carPlace === "home") return;
    setParked(null);
    window.localStorage.removeItem(PARKED_KEY);
  }, [hydrated, inbound, carPlace]);

  function setCarPlace(place: CarPlace) {
    const entry: ParkedCar = {
      date: honoluluDateKey(new Date()),
      station: inbound ? arrivalStationId ?? setup.homeStopId : setup.homeStopId,
      place,
    };
    setParked(entry);
    window.localStorage.setItem(PARKED_KEY, JSON.stringify(entry));
  }

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
    staleTime: 30_000,
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
    browseUserPoint && browseStation ? walkingEstimate(browseUserPoint, browseStation).minutes : null;
  const trainsEveryMinutes = useMemo(() => {
    const gaps = browseDirections
      .map((d) =>
        d[0] && d[1] ? Math.round((d[1].departure_seconds - d[0].departure_seconds) / 60) : null,
      )
      .filter((g): g is number => g !== null && g > 0 && g < 60);
    return gaps.length ? Math.min(...gaps) : null;
  }, [browseDirections]);
  const { data: feederBuses = [] } = useQuery({
    queryKey: [
      "feeder-bus",
      browseStation?.stopId,
      browseUserPoint?.lat.toFixed(3),
      browseUserPoint?.lon.toFixed(3),
      Math.floor(scheduleAfterSeconds / 300),
    ],
    enabled: browseActive && Boolean(browseStation && browseUserPoint) && (browseWalkMinutes ?? 0) > 18,
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
    staleTime: 30_000,
    refetchInterval: 60_000,
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
  const { data: options = [], isLoading: planLoading, isError: planFailed,
    dataUpdatedAt: optionsFetchedAt } = useQuery({
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
      Math.floor(scheduleAfterSeconds / 60),
      planMode,
      planMode === "arrive-by" ? arriveByTarget : null,
    ],
    enabled: hydrated && railConfigured,
    staleTime: 60_000,
    queryFn: async () => {
      let selectedInboundStation = arrivalStationId;
      let fallbackChecked = false;
      const fetchPage = async (cursor: number): Promise<Option[]> => {
      if (inbound) {
        const fetchAtStation = async (stationId: string) => {
          const params = {
            ...inboundPlannerCoordinates(tripDirection),
            p_station: stationId,
            // Only use a parked car at the station where it was recorded.
            p_allow_drive: stationId === arrivalStationId ? carAtStation : Boolean(
              setup.allowDrive && parkedToday?.place === "station" && parkedToday.station === stationId,
            ),
            p_after_seconds: cursor,
            p_limit: planMode === "arrive-by" ? 8 : 4,
          };
          if (import.meta.env.DEV) console.info("[transit] plan_inbound", {
            p_dest_lat: params.p_dest_lat, p_dest_lon: params.p_dest_lon,
            p_station: params.p_station, p_home_lat: params.p_home_lat,
            p_home_lon: params.p_home_lon,
          });
          const { data, error } = await supabase.rpc("plan_inbound", params);
          if (error) throw error;
          return (data ?? []).map((row) => ({
            ...row,
            legs: row.legs as unknown as Leg[],
          })) as Option[];
        };
        if (fallbackChecked)
          return selectedInboundStation ? fetchAtStation(selectedInboundStation) : [];
        // The primary RPC can return no rows even when another nearby station
        // has an active rail ride and a bus/walk/parked-car egress to the door.
        let stations = browseStations;
        let primaryAlreadyChecked = false;
        if (!stations.length) {
          if (selectedInboundStation) {
            const primary = await fetchAtStation(selectedInboundStation);
            if (primary.length) {
              fallbackChecked = true;
              return primary;
            }
            primaryAlreadyChecked = true;
          }
          const stationResult = await supabase.rpc("rail_stations");
          if (stationResult.error) throw stationResult.error;
          stations = (stationResult.data ?? []) as RailStation[];
        }
        const result = await findInboundOptions({
          primaryStationId: primaryAlreadyChecked ? null : selectedInboundStation,
          stations: primaryAlreadyChecked
            ? stations.filter((station) => station.stop_id !== selectedInboundStation)
            : stations,
          destination: tripDirection.to as Coords,
          fetchAtStation,
        });
        selectedInboundStation = result.stationId ?? selectedInboundStation;
        fallbackChecked = true;
        if (result.options.length || !selectedInboundStation) return result.options;
        // No direct walk/bus from the origin reaches Skyline: board at the rail
        // hub nearest the origin with an estimated road access leg instead.
        const homeStation = selectedInboundStation;
        return (await hubAccessFallback({
          origin: tripDirection.from as Coords,
          stations: stations.filter((station) => station.stop_id !== homeStation),
          afterSeconds: cursor,
          fetchFromHub: async (hub, after) => {
            const { data, error } = await supabase.rpc("plan_inbound", {
              ...inboundPlannerCoordinates(tripDirection),
              p_dest_lat: hub.lat,
              p_dest_lon: hub.lon,
              p_station: homeStation,
              p_allow_drive: homeStation === arrivalStationId ? carAtStation : false,
              p_after_seconds: after,
              p_limit: planMode === "arrive-by" ? 8 : 4,
            });
            if (error) throw error;
            return (data ?? []).map((row) => ({ ...row, legs: row.legs as unknown as Leg[] }));
          },
        })) as Option[];
      }
      const { data, error } = await supabase.rpc("plan_outbound", {
        p_origin_lat: setup.homeLat as number,
        p_origin_lon: setup.homeLon as number,
        p_station: setup.homeStopId,
        p_dest_stop: setup.destStopId,
        p_allow_drive: driveAvailable,
        p_after_seconds: cursor,
        p_limit: planMode === "arrive-by" ? 8 : 4,
        // Any stop within a quarter mile of the door is fair game, walk included.
        p_dest_lat: setup.destLat as number,
        p_dest_lon: setup.destLon as number,
      });
      if (error) throw error;
      return (data ?? []).map((row) => ({
        ...row,
        legs: row.legs as unknown as Leg[],
      })) as Option[];
      };
      if (planMode !== "arrive-by" || arriveByTarget === null || arriveByTarget < nowSeconds)
        return fetchPage(scheduleAfterSeconds);
      const result = await collectArriveByOptions({
        nowSeconds: scheduleAfterSeconds, targetSeconds: arriveByTarget, fetchPage,
      });
      if (!result.complete) throw new Error("Arrival timetable search reached its safe page limit.");
      return result.options;
    },
  });
  const optionsLoading = planLoading || inboundStationLoading;
  const optionsFailed = planFailed ||
    (inboundStationFailed && browseStations.length === 0 && options.length === 0);

  // Options arrive in earliest-door-arrival order. A slightly later trip is
  // available by choice, but is never silently preferred.
  const earliest = options[0];
  const [selectedDeparture, setSelectedDeparture] = useState<string | null>(null);
  useEffect(() => {
    // A locked transit trip keeps its itinerary even as fresher options arrive.
    if (commitment?.mode === "rail") return;
    setSelectedDeparture(null);
  }, [inbound, earliest?.leave_by_seconds, earliest?.arrive_seconds, commitment]);
  const liveBest =
    options.find((option) => optionIdentity(option) === selectedDeparture) ?? earliest;
  // While riding, the itinerary on screen is the one boarded — including its
  // transfers — not whatever is fastest to leave now.
  const best =
    commitment?.mode === "rail" && lockedOptionRef.current ? lockedOptionRef.current : liveBest;
  lockedItineraryCandidate.current = liveBest ?? null;

  const stationCoords = browseStations;
  /* One authoritative rail-station query serves browse, setup, maps and planning. */
  function stationPoint(name: string | null | undefined): Coords | null {
    if (!name) return null;
    const wanted = name.trim().toLowerCase();
    const hit = stationCoords.find(
      (station) => (station.stop_name ?? "").trim().toLowerCase() === wanted,
    );
    if (!hit || hit.stop_lat === null || hit.stop_lon === null) return null;
    return { lat: Number(hit.stop_lat), lon: Number(hit.stop_lon) };
  }

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
          const { data, error } = await supabase.rpc("leg_stop_sequence", {
            p_from_name: leg.from,
            p_to_name: leg.to,
            p_depart_seconds: leg.depart_seconds,
            ...(leg.mode === "bus" && leg.route_short ? { p_route_short: leg.route_short } : {}),
            p_rail: leg.mode === "rail",
            p_tolerance_seconds: 300,
          });
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
    retry: false,
    queryFn: () => fetchBusArrivals({ data: busTarget as BusStopTarget }),
  });
  const confirmedBusArrival = plannedBusLeg && liveBus
    ? matchLiveArrival(liveBus, plannedBusLeg.route_short, plannedBusLeg.headsign,
        plannedBusLeg.depart_seconds)
    : null;

  // --- Automatic "approaching your stop" tracking -------------------------
  // No button: whenever the current plan has a transit leg underway, follow it
  // with GPS when granted and fall back to the timetable when it is not.
  const activeTransitLeg = useMemo(() => {
    if (!best || commitment?.mode !== "rail") return null;
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
  const showApproach =
    Boolean(approach) && approachDismissed !== `${approach?.key}-${approach?.state}`;

  // Real driving time between the two points that matter for this direction.
  const driveFrom = tripDirection.from;
  const driveTo = tripDirection.to;
  const rawFetchDriveTime = useServerFn(driveTime);
  const fetchDriveTime = async (input: Parameters<typeof rawFetchDriveTime>[0]): Promise<DriveTime> => {
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
    if (spike < 8 || rescueAsked.current) return;
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
        range: `${clockFromSeconds(win.earliestSeconds)} – ${clockFromSeconds(win.latestSeconds)}`,
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
    if (rescue && !navMuted) speakCommuteAlert(rescue.spoken);
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
    setNavBearing((previous) =>
      smoothBearing(previous, {
        gpsHeading: riderHeading,
        speedMps: riderSpeed,
        from: lastNavPoint.current,
        to: riderPoint,
      }),
    );
    lastNavPoint.current = riderPoint;
  }, [riderPoint, riderHeading, riderSpeed, drivingCommitted]);
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
    if (phrase && !navMuted) speakCommuteAlert(phrase);
  }, [nextTurn, drivingCommitted, navMuted, riderSpeed, rerouting]);

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

    const corridor =
      drive.corridorLabel?.replace(/^Via\s+/i, "") || drive.incidents[0]?.road || "your route";
    const message =
      change.kind === "delay"
        ? `Traffic update: delay increased on ${corridor} by ${change.increaseMinutes} minutes.`
        : `Traffic alert: reported incident on ${corridor}.`;
    if (alertPrefs.sound) {
      playChime();
      speakCommuteAlert(message);
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
  const railPick = useMemo(
    () => (arriveByTarget === null ? null : latestRailArrival(options, arriveByTarget)),
    [options, arriveByTarget],
  );
  const gtfsExpiry = useDataExpiry();
  const driveAccess = destinationAccess(driveTo, arrivingHome ? "home" : null);
  const futureCandidateSeconds = arriveByActive && settledTrafficTarget === arriveByTarget && drive
    ? arriveByTarget - (drive.highMinutes + driveAccess.highMin) * 60 : null;
  const futureDepartureIso = futureCandidateSeconds !== null && !arriveByPassed && futureCandidateSeconds > nowSeconds
    ? honoluluSecondsToIso(futureCandidateSeconds, now) : null;
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
        : planDriveArrivalWithRange(
            arriveByTarget,
            arriveByDrive,
            driveAccess,
            nowSeconds,
            { estimated: Boolean(futureDrive), converged: futureDriveResult?.converged,
              iterations: futureDriveResult?.iterations, futureFailed: futureDriveResult?.futureFailed },
          ),
    [arriveByTarget, arriveByDrive, driveAvailable, driveAccess, nowSeconds, futureDrive, futureDriveResult],
  );
  const arrivalDriveEstimate = driveEstimate({
    drive: arriveByDrive ?? null, access: driveAccess, nowSeconds, nowMs: now.getTime(),
    leaveAtSeconds: drivePlan?.leaveBySeconds ?? nowSeconds, carAvailable: driveAvailable,
    failed: driveFailed, targetArrivalSeconds: arriveByTarget,
    ...(arriveByActive && (!futureDrive || !futureDriveResult?.converged || futureDriveResult.futureFailed)
      ? { qualityOverride: "limited" as const } : {}),
  });
  const arrivalRailEstimate = transitEstimate({
    option: railPick?.option ?? null, nowSeconds, nowMs: now.getTime(),
    scheduleFetchedAt: optionsFetchedAt || null, failed: optionsFailed,
    targetArrivalSeconds: arriveByTarget,
    feedExpired: gtfsExpiry !== null && gtfsExpiry.daysRemaining < 0,
    liveBusFetchedAt: confirmedBusArrival ? (liveBus?.fetchedAt ?? null) : null,
  });
  const arriveByComparison = arriveByTarget === null ? null
    : decideArrival(arrivalDriveEstimate, arrivalRailEstimate, arriveByTarget);

  // In arrive-by mode the itinerary shown is the latest one that still makes it.
  const arriveByLeaveBy =
    arriveByActive && railPick?.option ? optionIdentity(railPick.option) : null;
  useEffect(() => {
    if (arriveByLeaveBy !== null) setSelectedDeparture(arriveByLeaveBy);
  }, [arriveByLeaveBy]);

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
  const railClosedForEvening = Boolean(
    todayHours && nowSeconds >= Number(todayHours.last_seconds),
  );
  const railNotRunningYet = Boolean(
    todayHours && nowSeconds < Number(todayHours.first_seconds),
  );
  // Rail total carries a safety buffer, and a range for transfers that slip.
  const driveTripEstimate = driveEstimate({
    drive: drive ?? null, access: driveAccess, nowSeconds, nowMs: now.getTime(),
    carAvailable: driveAvailable, failed: driveFailed,
    majorIncident: Boolean(drive?.incidents[0]),
  });
  const railTripEstimate = transitEstimate({
    option: best ?? null, nowSeconds, nowMs: now.getTime(),
    scheduleFetchedAt: optionsFetchedAt || null, failed: optionsFailed,
    feedExpired: gtfsExpiry !== null && gtfsExpiry.daysRemaining < 0,
    liveBusFetchedAt: confirmedBusArrival ? (liveBus?.fetchedAt ?? null) : null,
  });
  const railMinutes = railTripEstimate.expectedDurationMinutes;
  const railRange = railTripEstimate.availability === "available" ? {
    low: Math.round(((railTripEstimate.earliestArrival as number) - nowSeconds) / 60),
    high: Math.round(((railTripEstimate.latestArrival as number) - nowSeconds) / 60),
  } : null;
  const itineraryRange = arriveByActive && best ? {
    low: Math.max(0, best.total_minutes - 1),
    high: Math.round(best.total_minutes + (railTripEstimate.uncertaintyMinutes ?? 0)),
  } : railRange;
  const driveArrival = drive
    ? arrivalRange(nowSeconds,
        { low: drive.lowMinutes, expected: drive.trafficMinutes, high: drive.highMinutes },
        driveAccess)
    : null;
  const driveBufferNote =
    driveAccess.highMin > 0
      ? `Includes ${driveAccess.lowMin}–${driveAccess.highMin} min to park and walk in`
      : null;
  const driveWindow = driveArrival
    ? `${clockFromSeconds(driveArrival.earliestSeconds)} – ${clockFromSeconds(driveArrival.latestSeconds)}`
    : null;
  const driveRange = driveTripEstimate.availability === "available" ? {
    low: Math.round(((driveTripEstimate.earliestArrival as number) - nowSeconds) / 60),
    high: Math.round(((driveTripEstimate.latestArrival as number) - nowSeconds) / 60),
  } : null;
  const railWindow = best && railTripEstimate.earliestArrival !== null && railTripEstimate.latestArrival !== null
    ? `${clockFromSeconds(railTripEstimate.earliestArrival)} – ${clockFromSeconds(railTripEstimate.latestArrival)}`
    : null;
  const leaveIn = best ? Math.round((best.leave_by_seconds - nowSeconds) / 60) : null;
  const decisionKey = `${planMode}:${inbound}:${setup.homeLat}:${setup.homeLon}:${setup.destLat}:${setup.destLon}`;
  const previousVerdict =
    decisionHistoryRef.current?.key === decisionKey &&
    decisionHistoryRef.current.state !== "same"
      ? decisionHistoryRef.current.state
      : null;
  const previousDecisionSnapshot = decisionHistoryRef.current?.key === decisionKey
    ? decisionHistoryRef.current.snapshot : null;
  const decision = decideTrip(driveTripEstimate, railTripEstimate, previousVerdict,
    { tossUpMinutes: TOSS_UP_MIN });
  const activeDecision = arriveByActive && arriveByComparison ? arriveByComparison : decision;
  const verdict: DecisionState = commitment?.mode ??
    (!arriveByActive && railServiceClosed
      ? activeDecision.state
      : optionsLoading || driveLoading
        ? "uncertain"
        : activeDecision.state);
  const gap = !commitment && !arriveByActive && (verdict === "rail" || verdict === "drive")
    ? decision.differenceMinutes : null;
  const incidentDecides = verdict === "rail" && activeDecision.primary.kind === "major_incident";
  const currentDecisionSnapshot: DecisionSnapshot = {
    key: decisionKey,
    state: verdict === "same" ? "same" : verdict === "drive" || verdict === "rail" ? verdict : "same",
    driveMinutes: driveTripEstimate.expectedDurationMinutes,
    railMinutes: railTripEstimate.expectedDurationMinutes,
    driveDelayMinutes: driveTripEstimate.trafficDelayMinutes,
    railWaitMinutes: railTripEstimate.railWaitMinutes,
    busWaitMinutes: railTripEstimate.busWaitMinutes,
    majorIncident: Boolean(driveTripEstimate.majorIncident),
  };
  const decisionChanges = useMemo(() => {
    if (commitment || !previousDecisionSnapshot || previousDecisionSnapshot.key !== decisionKey || !["drive", "rail", "same"].includes(verdict)) return [] as string[];
    const changes: string[] = [];
    if (previousDecisionSnapshot.state !== currentDecisionSnapshot.state) {
      const labels = { drive: "driving", rail: "Skyline", same: "neither option" } as const;
      changes.push(`Nalu changed the recommendation from ${labels[previousDecisionSnapshot.state]} to ${labels[currentDecisionSnapshot.state]}.`);
    }
    const driveDelta = changedMinutes(currentDecisionSnapshot.driveMinutes, previousDecisionSnapshot.driveMinutes);
    if (driveDelta !== null) changes.push(`Driving is now about ${Math.abs(driveDelta)} min ${driveDelta > 0 ? "slower" : "faster"} than your last check.`);
    const railDelta = changedMinutes(currentDecisionSnapshot.railMinutes, previousDecisionSnapshot.railMinutes);
    if (railDelta !== null) changes.push(`Skyline is now about ${Math.abs(railDelta)} min ${railDelta > 0 ? "slower" : "faster"} than your last check.`);
    const trafficDelta = changedMinutes(currentDecisionSnapshot.driveDelayMinutes, previousDecisionSnapshot.driveDelayMinutes);
    if (trafficDelta !== null) changes.push(`Traffic is adding about ${Math.abs(trafficDelta)} min ${trafficDelta > 0 ? "more" : "less"} time than at your last check.`);
    const railWaitDelta = changedMinutes(currentDecisionSnapshot.railWaitMinutes, previousDecisionSnapshot.railWaitMinutes);
    if (railWaitDelta !== null) changes.push(`The next train wait is about ${Math.abs(railWaitDelta)} min ${railWaitDelta > 0 ? "longer" : "shorter"} than at your last check.`);
    const busWaitDelta = changedMinutes(currentDecisionSnapshot.busWaitMinutes, previousDecisionSnapshot.busWaitMinutes);
    if (busWaitDelta !== null) changes.push(`Your bus wait is about ${Math.abs(busWaitDelta)} min ${busWaitDelta > 0 ? "longer" : "shorter"} than at your last check.`);
    if (currentDecisionSnapshot.majorIncident && !previousDecisionSnapshot.majorIncident) changes.push("A crash or major slowdown is now affecting the drive.");
    if (!currentDecisionSnapshot.majorIncident && previousDecisionSnapshot.majorIncident) changes.push("The reported crash or major slowdown is no longer affecting the comparison.");
    return changes.slice(0, 3);
  }, [commitment, previousDecisionSnapshot, decisionKey, currentDecisionSnapshot.driveMinutes, currentDecisionSnapshot.railMinutes, currentDecisionSnapshot.driveDelayMinutes, currentDecisionSnapshot.railWaitMinutes, currentDecisionSnapshot.busWaitMinutes, currentDecisionSnapshot.majorIncident, currentDecisionSnapshot.state]);
  useEffect(() => {
    if (commitment || !["drive", "rail", "same"].includes(verdict)) return;
    const historyState =
      verdict === "drive" || verdict === "rail" || verdict === "same"
        ? verdict
        : "same";
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
    currentDecisionSnapshot.railMinutes,
    currentDecisionSnapshot.driveDelayMinutes,
    currentDecisionSnapshot.railWaitMinutes,
    currentDecisionSnapshot.busWaitMinutes,
    currentDecisionSnapshot.majorIncident,
    currentDecisionSnapshot.state,
  ]);
  // The verdict only steers the view until the commuter commits; after that the
  // locked mode stays on screen for the rest of the trip.
  useEffect(() => {
    if (commitment) return;
    if (verdict === "drive") setSelectedMode("drive");
    else if (verdict === "rail") setSelectedMode("rail");
  }, [verdict, inbound, commitment]);
  const reasoning = commitment
    ? "Your selected trip stays locked while conditions update."
    : railClosedForEvening
      ? "Skyline service has ended for the evening, so Nalu is comparing the remaining option."
      : railNotRunningYet
        ? "Skyline service has not started yet today, so Nalu is comparing the available option."
        : activeDecision.primary.text;

  const whyNaluText =
    railClosedForEvening
      ? "Skyline has finished service for the evening. Nalu is using the live driving estimate because rail is not operating right now."
      : railNotRunningYet
        ? "Skyline has not started service yet. Nalu is using the available option until rail service begins."
        : verdict === "drive"
        ? "Nalu compares the full trip from where you start to where you’re going, including getting to transit, waiting for your ride, and walking at the end—not just the freeway drive."
        : verdict === "rail"
          ? "The Skyline option includes getting to the station, waiting, the train ride, any bus connection, and the walk to your destination."
          : verdict === "same"
            ? "The estimated arrival times are close enough that neither option has a clear time advantage right now."
            : activeDecision.primary.text;

  const decisionSignals = useMemo(() => {
    const signals: Array<{
      label: string;
      value: string;
      detail?: string;
      tone: "neutral" | "alert" | "positive";
    }> = [];

    const delay = Math.round(driveTripEstimate.trafficDelayMinutes ?? 0);
    if (verdict === "drive") {
      const trafficValue =
        delay >= 15
          ? `Heavy · +${delay} min vs usual`
          : delay >= 5
            ? `Slower · +${delay} min vs usual`
            : delay > 0
              ? `Slightly slower · +${delay} min`
              : "Moving normally";
      signals.push({
        label: "Traffic",
        value: trafficValue,
        tone: delay >= 5 ? "alert" : "neutral",
      });

      const incident = driveTripEstimate.majorIncident ? drive?.incidents[0] : null;
      if (incident) {
        signals.push({
          label: "Road incident",
          value: incidentHeadline(incident),
          detail: incidentDetailText(incident) ?? incidentImpactText(incident),
          tone: "alert",
        });
      } else if (drive?.corridorLabel) {
        signals.push({
          label: "Route",
          value: drive.corridorLabel,
          tone: "neutral",
        });
      }
    } else if (verdict === "rail") {
      const railWait = Math.round(railTripEstimate.railWaitMinutes ?? 0);
      const busWait = Math.round(railTripEstimate.busWaitMinutes ?? 0);
      if (railWait >= 5) signals.push({ label: "Skyline wait", value: `${railWait} min`, tone: railWait >= 10 ? "alert" : "neutral" });
      if (busWait >= 5) signals.push({ label: "Bus wait", value: `${busWait} min`, tone: busWait >= 10 ? "alert" : "neutral" });
      if (drive?.incidents[0] && driveTripEstimate.majorIncident) {
        signals.push({
          label: "Road incident",
          value: incidentHeadline(drive.incidents[0]),
          detail: incidentDetailText(drive.incidents[0]) ?? incidentImpactText(drive.incidents[0]),
          tone: "neutral",
        });
      }
    } else {
      if (delay >= 5) signals.push({ label: "Traffic", value: `+${delay} min vs usual`, tone: "alert" });
      const incident = driveTripEstimate.majorIncident ? drive?.incidents[0] : null;
      if (incident) {
        signals.push({
          label: "Road incident",
          value: incidentHeadline(incident),
          detail: incidentDetailText(incident) ?? incidentImpactText(incident),
          tone: "alert",
        });
      }
      const railWait = Math.round(railTripEstimate.railWaitMinutes ?? 0);
      if (railWait >= 5) signals.push({ label: "Skyline wait", value: `${railWait} min`, tone: "neutral" });
    }

    return signals.slice(0, 4);
  }, [
    drive,
    driveTripEstimate.trafficDelayMinutes,
    driveTripEstimate.majorIncident,
    railTripEstimate.railWaitMinutes,
    railTripEstimate.busWaitMinutes,
    verdict,
  ]);
  const destinationLabel = setup.destinationName || setup.destinationAddress || "your destination";
  const tripOriginLabel = reverseTrip ? destinationLabel
    : departingFromSavedHome || (!savedHome && !inbound)
      ? "Home" : "Current location";
  const tripArrivalLabel = arrivingHome ? "Home" : destinationLabel;
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

  // ---- Outdoor conditions --------------------------------------------------
  // Every moment of this trip spent outside: where it happens, when, how long.
  const homePoint =
    setup.homeLat !== null && setup.homeLon !== null
      ? { lat: setup.homeLat, lon: setup.homeLon }
      : null;
  const destPoint =
    setup.destLat !== null && setup.destLon !== null
      ? { lat: setup.destLat, lon: setup.destLon }
      : null;

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
      const station = stationPoint(name);
      if (station) return station;
      const stop = itineraryStopCoords.find(
        (row) => (row.stop_name ?? "").trim().toLowerCase() === normalized,
      );
      if (!stop || stop.stop_lat === null || stop.stop_lon === null) return null;
      return { lat: Number(stop.stop_lat), lon: Number(stop.stop_lon) };
    };

    best.legs.forEach((leg, index) => {
      if (leg.mode !== "rail" && leg.mode !== "bus") return;
      const transitKind: "rail" | "bus" = leg.mode;
      const endpoints: Array<[string | null, string | null | undefined]> = [
        [leg.from, leg.from_stop_id],
        [leg.to, leg.to_stop_id],
      ];
      endpoints.forEach(([name, stopId], endpointIndex) => {
        const point = stopPoint(name, stopId);
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
  }, [best, homePoint, destPoint, reverseTrip, tripOriginLabel, tripArrivalLabel, itineraryStopCoords, stationCoords]);

  const transitMapSegments = useMemo(() => {
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
    return best.legs.flatMap((leg, legIndex) => {
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
      const from = leg.kind === "access" ? origin : pointForStop(leg.from_stop_id, leg.from);
      const to = leg.kind === "egress" ? destination : pointForStop(leg.to_stop_id, leg.to);
      if (!from || !to) return [];
      return [{ id: `leg-${legIndex}`, mode: leg.mode, points: [from, to] }];
    });
  }, [best, homePoint, destPoint, reverseTrip, itineraryLegSequences, itineraryStopCoords, railLine]);

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

  const moments = useMemo<OutdoorMoment[]>(() => {
    if (!best) return [];
    const originPoint = reverseTrip ? destPoint : homePoint;
    const arrivalPoint = reverseTrip ? homePoint : destPoint;
    const railLegHere = best.legs.find((leg) => leg.kind === "rail") ?? null;
    const boardStation = stationPoint(railLegHere?.from);
    const transferStation = stationPoint(railLegHere?.to);
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

    for (const moment of moments) {
      const reading = readings.get(moment.id);
      if (!reading) continue;
      const lines: WeatherLine[] = [];
      const rain = rainLine(moment, reading);
      if (rain) lines.push({ text: rain, tone: "rain", source: "NWS" });
      const heat = heatLine(moment, reading);
      if (heat) lines.push(heat);
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
        p_lat: stop.lat, p_lon: stop.lon, p_rail_only: true,
      });
      if (error || !data?.[0]) throw new Error("Could not find a rail station near this stop.");
      const next = {
        ...setup,
        homeLat: stop.lat, homeLon: stop.lon,
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
        homeLat: browseUserPoint.lat, homeLon: browseUserPoint.lon,
        homeStopId: rail.stop_id, homeStopName: rail.stop_name ?? "",
        destinationName: stop.stopName,
        destinationAddress: stop.stopName,
        destLat: stop.lat, destLon: stop.lon,
        // The tapped icon is the rider's exact destination stop, not a
        // similarly named stop chosen by a nearest-stop lookup.
        destStopId: stop.stopId, destStopName: stop.stopName,
        destStopWalkM: 0,
        destReturnStopId: back?.stop_id ?? "", destReturnStopName: back?.stop_name ?? "",
        destReturnWalkM: Number(back?.distance_m ?? 0),
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not set this destination.");
    } finally {
      mapStopActionBusyRef.current = false;
      setMapStopActionBusy(false);
    }
  }

  async function quickStartRoutine() {
    if (alertPrefs.sound) primeChimeAudio();
    requestCommuteNotificationPermission();
    void refreshTrafficNow();
    const home = findByKind(savedPlaces, "home");
    const destination =
      findByKind(savedPlaces, "work") ?? savedPlaces.find((place) => place.kind !== "home") ?? null;
    if (!home || !destination) {
      setOnboardingOpen(true);
      return;
    }
    let stops: Awaited<ReturnType<typeof findTripStops>>;
    try {
      stops = await findTripStops(home, destination);
    } catch (error) {
      console.error("Quick start stop lookup failed", error);
      stops = { rail: undefined, out: undefined, back: undefined };
    }
    const { rail, out, back } = stops;
    saveSetup({
      ...emptySetup,
      homeStopId: rail?.stop_id ?? "",
      homeStopName: rail?.stop_name ?? "",
      homeLat: home.lat,
      homeLon: home.lon,
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
    chooseDirection(honoluluParts(now).hour >= 12);
  }

  async function quickStartSavedPlace(slot: string) {
    const destination = resolveShortcut(savedPlaces, slot);
    if (!destination) {
      if (authLoading || !user || syncReadyUser !== user.id) {
        setRestoreSlot(slot);
        setAccountOpen(true);
      } else {
        setQuickPlaceSlot(slot);
      }
      return;
    }
    if (alertPrefs.sound) primeChimeAudio();
    requestCommuteNotificationPermission();
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
      onClose={() => { setAccountOpen(false); setRestoreSlot(null); }}
      restoreLabel={restoreSlot ? shortcutLabel(savedPlaces, restoreSlot) : null}
      restored={Boolean(restoreSlot && resolveShortcut(savedPlaces, restoreSlot))}
      syncStatus={placesSyncStatus}
      onRetry={() => { syncedUserRef.current = null; setSyncReadyUser(null); setSyncRetry((value) => value + 1); }}
      placeLabels={savedPlaces.map((place) => place.label)}
      onSearch={() => { setAccountOpen(false); setQuickPlaceSlot(restoreSlot); setRestoreSlot(null); }}
      onStart={() => { const slot = restoreSlot; setAccountOpen(false); setRestoreSlot(null); if (slot) void quickStartSavedPlace(slot); }}
    />
    <QuickPlaceDialog slot={quickPlaceSlot} places={savedPlaces}
      onClose={() => setQuickPlaceSlot(null)}
      onSave={(next) => { persistPlaces(next); setQuickPlaceSlot(null); }} />
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
    />
    </>
  );

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
    // Routine window: work mornings (5:00 AM–11:59 AM), home from noon on —
    // overnight hours count as heading home.
    const routineHour = honoluluParts(now).hour;
    const routineInbound = routineHour >= 12 || routineHour < 5;
    const routineDestination =
      findByKind(savedPlaces, "work") ?? savedPlaces.find((place) => place.kind !== "home") ?? null;
    return (
      <main className="browse-radiance min-h-dvh px-5 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))] text-foreground">
        <div className="mx-auto flex w-full max-w-[440px] flex-col">
          <header className="flex min-h-11 items-start justify-between gap-4">
            <div>
              <p className="mb-1 text-[11px] font-semibold text-recommended">
                {alohaGreeting(now, profileName)}
              </p>
              <div className="flex items-center gap-1.5">
                <WaveMark className="h-6 w-auto text-recommended" />
                <p className="text-lg font-medium tracking-wide text-foreground">Nalu</p>
              </div>
              <div className="mt-1.5 h-px bg-border/70" />
              <p className="mt-1 text-xs font-semibold uppercase text-muted-foreground">
                Oahu commute conditions
              </p>
            </div>
            <div className="flex max-w-[65%] flex-wrap items-center justify-end gap-1">
              <p className="w-full text-right text-xs font-medium text-foreground">{timeText}</p>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Refresh commute conditions"
                onClick={() => void refresh()}
                disabled={refreshing}
                className="shrink-0 rounded-full text-muted-foreground hover:text-foreground"
              >
                <RefreshCw />
              </Button>
              <AccountButton onClick={() => { setRestoreSlot(null); setAccountOpen(true); }} />
              <Button
                variant="ghost"
                size="icon"
                aria-label="Open settings"
                onClick={() => setSettingsOpen(true)}
                className="shrink-0 rounded-full text-muted-foreground hover:text-foreground"
              >
                <Settings className="size-5" />
              </Button>
            </div>
          </header>

          <NaluPageNav
            current="browse"
            onBrowse={() => setPageView("browse")}
            onTrip={() => {
              if (configured) {
                setPageView("commute");
                return;
              }
              setOnboardingOpen(true);
            }}
          />

          {findByKind(savedPlaces, "home") && routineDestination && (
            <button
              type="button"
              onClick={() => void quickStartRoutine()}
              className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-primary/40 bg-primary/10 px-3.5 py-3 text-left shadow-sm backdrop-blur-md transition-colors hover:bg-primary/15"
            >
              <span className="truncate text-sm font-semibold text-foreground">
                {routineInbound ? "Head Home" : `Head to ${routineDestination.label}`}
              </span>
              <span className="shrink-0 rounded-full bg-primary px-3 py-1 text-[11px] font-bold text-primary-foreground">
                Start
              </span>
            </button>
          )}

          <DataExpiryNotice />
          {!online && (
            <p role="status" className="mt-3 rounded-lg border border-border bg-surface-raised px-4 py-3 text-sm text-muted-foreground">
              You’re offline. Available schedules stay visible; live arrivals will refresh when you reconnect.
            </p>
          )}
          <MorningPulse
            home={browseHome}
            work={browseWork}
            trainsEveryMinutes={trainsEveryMinutes}
          />
          <BeatTheRush home={browseHome} work={browseWork} />
          <WeeklyDigestCard />

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
            {(["home", "work", "gym"] as const).map((kind) => {
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
              onClick={() => setSettingsOpen(true)}
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
                        minutesAway: Math.max(0, Math.ceil((arrival.departure_seconds - nowSeconds) / 60)),
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
                  className="size-3 rounded-full border-2 border-foreground bg-location shadow-[0_0_10px_var(--color-location)]"
                  aria-label="Your location"
                />
                <span className="text-xs font-semibold text-foreground">You</span>
              </div>
            </section>
          )}

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
            <div className="flex items-center gap-3">
              <TrainFront className="size-6 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase text-muted-foreground">
                  Closest Skyline station
                </p>
                <h2
                  id="browse-station-title"
                  className="truncate text-xl font-semibold text-foreground"
                >
                  {browseStation
                    ? `${stationLabel(browseStation.stopName)} Station`
                    : "Finding your station…"}
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
              <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-semibold">
                {stationParking && (
                  <span className="rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-primary">
                    {stationParking.status === "limited"
                      ? "Limited parking"
                      : "Park & Ride available"}
                    {stationParking.note ? ` · ${stationParking.note}` : ""}
                  </span>
                )}
                {trainsEveryMinutes && (
                  <span className="rounded-full border border-border px-2 py-0.5 text-muted-foreground">
                    Trains every {trainsEveryMinutes} min
                  </span>
                )}
              </div>
            )}
            {browseStation && browseUserPoint && (
              <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-foreground">
                {browseWalkMinutes !== null && browseWalkMinutes <= 18 && (
                  <span className="browse-eta-chip">
                    Walk {browseWalkMinutes} min ·{" "}
                    {formatDistance(walkingEstimate(browseUserPoint, browseStation).meters)}
                  </span>
                )}
                {browseWalkMinutes !== null &&
                  browseWalkMinutes > 18 &&
                  feederBuses.slice(0, 2).map((bus) => (
                    <span key={bus.route_short_name} className="browse-eta-chip">
                      <Bus className="mr-1 inline size-3.5" />
                      Take TheBus {bus.route_short_name} · {bus.ride_minutes} min ride · leaves{" "}
                      {clockFromSeconds(bus.depart_seconds)}
                    </span>
                  ))}
                <span className="browse-eta-chip">
                  Drive about{" "}
                  {Math.max(1, Math.ceil(distanceM(browseUserPoint, browseStation) / 670))} min
                </span>
              </div>
            )}
            {browseStation && (
              <p className="mt-2 text-[11px] text-muted-foreground">
                HOLO fare {HOLO_FARES.singleRide} includes free transfers between TheBus and
                Skyline for {HOLO_FARES.transferWindowHours} hours.
              </p>
            )}
            {browseLocationDenied && browseStation && (
              <p className="mt-2 text-xs text-muted-foreground">
                Location unavailable · showing a data-derived West Oahu station
              </p>
            )}
            {browseLocationDenied && locationDenied && (
              <Button
                variant="link"
                onClick={() => setSettingsOpen(true)}
                className="mt-1 h-auto px-0 text-xs text-muted-foreground"
              >
                Location blocked · see how to allow it
              </Button>
            )}
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
                className="mt-4 h-12 w-full bg-background"
                aria-label="Choose Skyline station"
              >
                <SelectValue placeholder="Choose a station" />
              </SelectTrigger>
              <SelectContent>
                {browseStations.map((station) => (
                  <SelectItem key={station.stop_id} value={station.stop_id}>
                    {stationLabel(station.stop_name)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {browseStation && (
              <div
                className={`mt-4 grid grid-cols-2 gap-3 ${refreshing ? "animate-in fade-in duration-300" : ""}`}
                aria-label={`Departures from ${stationLabel(browseStation.stopName)}`}
              >
                {browseDeparturesLoading && (
                  <p className="text-sm text-muted-foreground">Loading departures…</p>
                )}
                {browseDeparturesFailed && (
                  <p className="col-span-2 text-sm text-warning">Rail departure times are not available right now.</p>
                )}
                {!browseDeparturesLoading && !browseDeparturesFailed && browseDirections.length === 0 && (
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
                  const directionName = towardDowntown ? "Downtown Honolulu" : "Kapolei";
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
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        to {directionName} · {endpoint}
                      </p>
                      {first && (
                        <div className="mt-3">
                          <p className="text-2xl font-semibold tabular-nums text-primary">
                            {nowDeparture ? (
                              <>
                                Now{" "}
                                <span className="block text-xs font-normal text-muted-foreground">
                                  · {clockFromSeconds(first.departure_seconds)}
                                </span>
                              </>
                            ) : soon ? (
                              <>
                                in {minutesAway} min{" "}
                                <span className="block text-xs font-normal text-muted-foreground">
                                  · {clockFromSeconds(first.departure_seconds)}
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
                              Miss it? Next train at {clockFromSeconds(second.departure_seconds)}
                            </p>
                          )}
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
            <p className="mt-3 text-[10px] text-muted-foreground">
              TheBus / DTS
              {h1HasMeaningfulDelay ? " · H-1 is delayed, so Skyline may be especially useful" : ""}
            </p>
          </section>
          )}

          <AnalyticsConsentBanner />

          <AskNalu origin={browseUserPoint} />

          {browseUserPoint && (
            <details className="glass-panel mt-3 rounded-lg">
              <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
                <Bus className="size-5 text-primary" />
                <span className="font-semibold text-foreground">Nearby stops & arrivals</span>
                <span className="ml-auto text-xs text-muted-foreground">
                  {nearbyStops.length} stops
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
                        className="h-auto max-w-52 shrink-0 justify-start gap-2 px-3 py-2"
                        aria-label={`Show ${nearbyServiceLabel(stop)} at ${titleCase(stop.stopName)}`}
                      >
                        <Icon className="size-4 shrink-0" />
                        <span className="truncate font-semibold">{nearbyServiceLabel(stop)}</span>
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
                      <div>
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
                        <p className="text-lg font-bold tabular-nums text-primary">
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
                            <span className="min-w-0 flex-1 truncate font-medium">
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

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <H1ConditionsCard
              eastbound={eastboundTraffic}
              westbound={westboundTraffic}
              loading={trafficLoading}
              unavailable={trafficUnavailable}
              compact
            />
            <details className="glass-panel mt-4 rounded-lg">
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
                <p className="mt-2 text-[10px] text-muted-foreground">
                  Weather: NWS · Air quality: AirNow / EPA
                </p>
              </div>
            </details>
          </div>
        </div>
        {setupDialog}
      </main>
    );
  }

  return (
    <main
      className={`min-h-dvh bg-page-gradient px-5 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))] text-foreground ${verdict === "rail" ? "commute-radiance-rail" : verdict === "drive" ? "commute-radiance-drive" : ""}`}
    >
      <div className="mx-auto flex w-full max-w-[680px] flex-col">
        <NaluPageNav current="commute" onBrowse={() => setPageView("browse")} onTrip={() => setPageView("commute")} />

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

        <div
          role="group"
          aria-label="Trip direction"
          className="grid grid-cols-2 gap-1 rounded-full bg-surface-raised p-1"
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

        <header className="mt-5 flex min-h-11 items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5">
              <div className="nalu-brand flex items-center gap-2.5">
                <WaveMark className="nalu-honu h-8 w-12" />
                <p className="nalu-brand-title text-lg font-semibold tracking-wide">Nalu</p>
              </div>
            </div>
            <div className="mt-1.5 h-px bg-border/70" />
            <p className="mt-1 text-xs font-semibold uppercase text-muted-foreground">
              {arrivingHome ? "Heading home" : inbound ? "Heading west" : "Heading out"}
            </p>
            <p className="mt-1 text-[15px] font-medium text-foreground">{timeText}</p>
          </div>
          <div className="flex items-center gap-1">
          <AccountButton onClick={() => { setRestoreSlot(null); setAccountOpen(true); }} />
          <Button
            variant="ghost"
            size="icon"
            aria-label="Open settings"
            onClick={() => setSettingsOpen(true)}
            className="rounded-full text-muted-foreground hover:text-foreground"
          >
            <Settings className="size-5" />
          </Button>
          </div>
        </header>

        <DataExpiryNotice />
        {!online && (
          <p role="status" className="mt-3 rounded-lg border border-border bg-surface-raised px-4 py-3 text-sm text-muted-foreground">
            You’re offline. Your trip stays visible; live traffic and arrivals will refresh when you reconnect.
          </p>
        )}

        <section
          className="mt-4 rounded-lg border border-border bg-surface-raised p-4"
          aria-labelledby="plan-mode-title"
        >
          <h2 id="plan-mode-title" className="sr-only">
            When do you need to travel?
          </h2>
          <div
            role="group"
            aria-label="Planning mode"
            className="grid grid-cols-2 gap-1 rounded-full bg-background/60 p-1"
          >
            {[
              { label: "Leave now", value: "leave-now" as PlanMode },
              { label: "Arrive by", value: "arrive-by" as PlanMode },
            ].map((tab) => (
              <button
                key={tab.value}
                aria-pressed={planMode === tab.value}
                onClick={() => choosePlanMode(tab.value)}
                className={`min-h-11 rounded-full text-sm font-semibold transition-colors ${
                  planMode === tab.value
                    ? "bg-recommended text-recommended-foreground"
                    : "text-muted-foreground"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {planMode === "arrive-by" && (
            <div className="mt-4">
              <Label
                htmlFor="arrive-by-time"
                className="text-xs font-semibold uppercase text-muted-foreground"
              >
                Be at {tripArrivalLabel} by
              </Label>
              <Input
                id="arrive-by-time"
                type="time"
                value={arriveByInput}
                onChange={(event) => chooseArriveBy(event.target.value)}
                className="mt-2 h-12 w-full bg-background/60 text-2xl font-bold tabular-nums"
              />
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
                      {railPick?.option && (
                        <p className="text-xs font-semibold text-muted-foreground">
                          {railPick.option.total_minutes} min total
                        </p>
                      )}
                    </div>
                    {railPick?.option && !arriveByPassed ? (
                      <p className="mt-2 text-lg font-bold tabular-nums text-foreground">
                        Leave by {clockFromSeconds(railPick.option.leave_by_seconds)}
                        <span className="ml-2 text-sm font-medium text-muted-foreground">
                          · arrive {clockFromSeconds(railPick.option.arrive_seconds)}
                        </span>
                      </p>
                    ) : railClosedForEvening ? (
                      <p className="mt-2 text-sm text-warning">
                        Rail is closed for the evening. Today's service ended at{" "}
                        {todayHours ? clockFromSeconds(todayHours.last_seconds) : "the scheduled end time"}.
                      </p>
                    ) : railNotRunningYet ? (
                      <p className="mt-2 text-sm text-muted-foreground">
                        Rail is not running yet. Today's service starts at{" "}
                        {todayHours ? clockFromSeconds(todayHours.first_seconds) : "the scheduled start time"}.
                      </p>
                    ) : optionsLoading ? (
                      <p className="mt-2 text-sm text-muted-foreground">Checking the timetable…</p>
                    ) : optionsFailed ? (
                      <p className="mt-2 text-sm text-warning">Rail information is not available right now.</p>
                    ) : railPick?.earliestOption ? (
                      <p className="mt-2 text-sm text-warning">
                        {arriveByPassed
                          ? "Earliest option: "
                          : `Rail can't get you there by ${clockFromSeconds(arriveByTarget)}. Earliest option: `}
                        leave at {clockFromSeconds(railPick.earliestOption.leave_by_seconds)} ·
                        arrive {clockFromSeconds(railPick.earliestOption.arrive_seconds)}.
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
                      {!drivePlan.protected && <p className="mt-1 text-xs text-warning">Traffic could make you late.</p>}
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
                      <p className="mt-2 text-[10px] text-muted-foreground">
                        Includes {drivePlan.bufferMinutes} min to park and walk in ·{" "}
                        {driveBasisLabel}
                      </p>
                    )}
                  </div>

                  {arriveByComparison && (
                    <div className="space-y-1 text-sm text-muted-foreground">
                      <p className="font-semibold text-foreground">{arriveByComparison.primary.text}</p>
                      {arriveByComparison.driveMarginMinutes !== null && arriveByComparison.driveMarginMinutes >= 0 && (
                        <p>Drive: about {Math.round(arriveByComparison.driveMarginMinutes)} min to spare.</p>
                      )}
                      {arriveByComparison.railMarginMinutes !== null && arriveByComparison.railMarginMinutes >= 0 && (
                        <p>Rail: about {Math.round(arriveByComparison.railMarginMinutes)} min to spare.</p>
                      )}
                    </div>
                  )}
                  <p className="text-[10px] text-muted-foreground">
                    All times are Hawaii Standard Time (UTC−10).
                  </p>
                </div>
              )}
            </div>
          )}
        </section>

        <section
          className="verdict-lift glass-panel -mx-2 mt-5 rounded-2xl px-5 py-7 animate-in fade-in duration-300"
          aria-labelledby="verdict-title"
        >
          <div className="mb-5 flex items-center gap-2 text-recommended">
            <span className="flex size-6 items-center justify-center rounded-full bg-recommended text-recommended-foreground">
              <Check className="size-4 stroke-[3]" />
            </span>
            <span className="text-xs font-semibold">{commitment ? "On this trip" : "Nalu says"}</span>
          </div>
          <h1
            id="verdict-title"
            className="max-w-[390px] text-4xl font-bold leading-none text-foreground"
          >
            {!configured
              ? "Where to?"
              : verdict === "none"
                ? "No valid option"
                : verdict === "uncertain"
                  ? optionsLoading || driveLoading
                    ? "Checking…"
                    : "Not enough current information"
                : verdict === "same"
                  ? "Too close to call"
                  : verdict === "rail"
                    ? `Take Skyline${gap !== null ? ` · ${Math.abs(gap)} min faster` : ""}`
                    : `Drive${gap !== null ? ` · ${Math.abs(gap)} min faster` : ""}`}
          </h1>
          {configured && verdict !== "none" && !optionsLoading && !driveLoading && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-border/70 bg-background/40 px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
                {activeDecision.confidence === "high"
                  ? "Strong signal"
                  : activeDecision.confidence === "moderate"
                    ? "Moderate signal"
                    : "Limited confidence"}
              </span>
              {activeDecision.differenceMinutes !== null && (
                <span className="text-xs text-muted-foreground">
                  {activeDecision.differenceMinutes === 0
                    ? "Nearly identical times"
                    : `${activeDecision.differenceMinutes} min separates the options`}
                </span>
              )}
            </div>
          )}
          {configured && !arriveByActive && <DecisionBars drive={{ label: "Drive", minutes: driveTripEstimate.expectedDurationMinutes,
            low: driveRange?.low, high: driveRange?.high }} transit={{ label: "Rail", minutes: railTripEstimate.expectedDurationMinutes,
            low: railRange?.low, high: railRange?.high }} />}
          {verdict === "rail" && best && railRange && (
            <div className="mt-6 grid grid-cols-3 gap-2 border-t border-border/70 pt-5">
              <div className="metric-glass">
                <p className="text-xs text-muted-foreground">Leave by</p>
                <p className="mt-1 text-xl font-bold tabular-nums text-recommended">
                  {clockFromSeconds(best.leave_by_seconds)}
                </p>
              </div>
              <div className="metric-glass">
                <p className="text-xs text-muted-foreground">Arrive</p>
                <p className="mt-1 text-xl font-bold tabular-nums text-foreground">
                  {clockFromSeconds(best.arrive_seconds)}
                </p>
              </div>
              <div className="metric-glass">
                <p className="text-xs text-muted-foreground">{arriveByActive ? "Trip" : "From now"}</p>
                <p className="mt-1 text-3xl font-bold leading-none tabular-nums text-foreground">
                  {arriveByActive ? formatDriveMinutes(best.total_minutes) : railTripEstimate.expectedDurationMinutes !== null ? formatDriveMinutes(railTripEstimate.expectedDurationMinutes) : "—"}
                  <span className="ml-1 text-xs font-semibold text-muted-foreground">min</span>
                </p>
              </div>
              {railWindow && (
                <p className="col-span-3 text-sm font-semibold tabular-nums text-muted-foreground">
                  Arrive {railWindow}
                </p>
              )}
            </div>
          )}
          {verdict === "drive" && drive && driveRange && driveArrival && (
            <div className="mt-6 grid grid-cols-3 gap-2 border-t border-border/70 pt-5">
              <div className="metric-glass">
                <p className="text-xs text-muted-foreground">Leave</p>
                <p className="mt-1 text-xl font-bold text-recommended">Now</p>
              </div>
              <div className="metric-glass">
                <p className="text-xs text-muted-foreground">Arrive</p>
                <p className="mt-1 text-xl font-bold tabular-nums text-foreground">
                  {clockFromSeconds(driveTripEstimate.arrivalTime ?? driveArrival.expectedSeconds)}
                </p>
              </div>
              <div className="metric-glass">
                <p className="text-xs text-muted-foreground">Total trip</p>
                <p className="mt-1 text-3xl font-bold leading-none tabular-nums text-foreground">
                  {Math.round(driveTripEstimate.expectedDurationMinutes ?? 0)}
                  <span className="ml-1 text-xs font-semibold text-muted-foreground">min</span>
                </p>
              </div>
              <p className="col-span-3 text-sm font-semibold tabular-nums text-muted-foreground">
                Arrive {driveWindow}
                {driveBufferNote && (
                  <span className="mt-1 block text-xs font-medium">{driveBufferNote}.</span>
                )}
              </p>
            </div>
          )}
          {verdict === "drive" && drive && <RouteCorridor label={drive.corridorLabel} />}
          {configured && (verdict === "same" || verdict === "none" || verdict === "uncertain") && (
            <p className="mt-4 text-lg font-medium text-muted-foreground">
              {verdict === "same"
                ? "Both options are close once arrival ranges are considered."
                : activeDecision.primary.text}
            </p>
          )}
          {configured && (verdict === "rail" || verdict === "drive") && reasoning && <p className="mt-3 text-base font-medium text-foreground">{reasoning}</p>}
          {configured && !commitment && decisionSignals.length > 0 && (
            <section
              className="nalu-card-surface mt-4 overflow-hidden rounded-2xl border border-border/60 bg-background/25"
              aria-label="What Nalu is watching"
            >
              <div className="flex items-center gap-3 px-4 py-3">
                <span className="size-1.5 shrink-0 animate-pulse rounded-full bg-primary" aria-hidden="true" />
                <span className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">Nalu is watching</span>
                <span className="ml-auto text-[11px] font-semibold text-muted-foreground">Live conditions</span>
              </div>
              <div className="border-t border-border/50 px-4 py-3">
                <div className="grid gap-2 sm:grid-cols-2">
                  {decisionSignals.map((signal) => (
                    <div key={signal.label} className="rounded-xl border border-border/50 bg-background/35 px-3 py-2.5">
                      <p className="text-[11px] font-semibold text-muted-foreground">{signal.label}</p>
                      <p className={signal.tone === "alert" ? "mt-0.5 text-sm font-bold leading-5 text-warning" : signal.tone === "positive" ? "mt-0.5 text-sm font-bold leading-5 text-primary" : "mt-0.5 text-sm font-bold leading-5 text-foreground"}>{signal.value}</p>
                      {signal.detail && <p className="mt-1 text-xs leading-5 text-muted-foreground">{signal.detail}</p>}
                    </div>
                  ))}
                </div>
                <div className="mt-3 border-t border-border/50 pt-3 text-xs text-muted-foreground">
                  <p>{sourceFreshnessLabel(driveTripEstimate.source, now.getTime())}</p>
                  <p className="mt-1">{sourceFreshnessLabel(railTripEstimate.source, now.getTime())}</p>
                </div>
              </div>
            </section>
          )}          {configured && !commitment && decisionChanges.length > 0 && (
            <details className="mt-3 overflow-hidden rounded-2xl border border-border/60 bg-background/25 text-sm">
              <summary className="cursor-pointer list-none px-4 py-3 font-semibold text-foreground marker:hidden">
                <span className="inline-flex items-center gap-2">
                  <span className="text-[11px] text-muted-foreground">↻</span>
                  What changed?
                </span>
              </summary>
              <div className="border-t border-border/50 px-4 py-4">
                <p className="text-sm font-semibold leading-6 text-foreground">{decisionChanges[0]}</p>
                {decisionChanges.slice(1).map((change) => (
                  <p key={change} className="mt-2 text-sm leading-6 text-muted-foreground">{change}</p>
                ))}
                {whyNaluText && <p className="mt-2 text-sm leading-6 text-muted-foreground">{whyNaluText}</p>}
                {verdict === "same" && <p className="mt-2 text-sm leading-6 text-muted-foreground">Driving is about {formatDriveMinutes(driveTripEstimate.expectedDurationMinutes ?? 0)}; transit is about {formatDriveMinutes(railTripEstimate.expectedDurationMinutes ?? 0)}.</p>}
                {verdict === "uncertain" && <p className="mt-2 text-sm leading-6 text-muted-foreground">{activeDecision.primary.text}.</p>}
              </div>
            </details>
          )}
        </section>

        {/* Keep the trip commitment action directly beneath the verdict so it
            remains visible before route and comparison details. */}
        {configured && <section
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
              <HoldToEndButton
                onEnd={endTrip}
                label="End Trip"
                className="h-12 w-full shrink-0 px-6 sm:w-auto"
              />
            </div>
          ) : (
            <Button
              type="button"
              disabled={selectedMode === "rail" ? !best : !driveAvailable || !drive}
              onClick={() => {
                // Starting a trip means "tell me everything": unlock chime and speech
                // inside this tap (iOS Safari), unmute voice and turn every alert on.
                primeChimeAudio();
                primeSpeech();
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
              ) : (
                <TrainFront className="size-6 shrink-0" />
              )}
              <span className="min-w-0 flex-1 text-center">
                <span className="block text-base font-black uppercase">
                  Start {selectedMode === "drive" ? "Drive" : "Rail"}
                </span>
                <span className="mt-0.5 block text-[10px] font-black uppercase text-primary-foreground/75">
                  Lock {selectedMode === "drive" ? "GPS & traffic" : "stops & alerts"}
                </span>
              </span>
              <Radio className="size-5 shrink-0" />
            </Button>
          )}
        </section>}

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
                  mode={lockedMode === "drive" ? "drive" : "rail"}
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
                    <Button size="sm" variant="ghost" className="mt-1 h-7 px-2" onClick={() => setRescue(null)}>
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
                      rerouting={rerouting}
                      onRouteStateChange={handleRouteStateChange}
                      traffic={lockedMode === "drive" ? (liveDrive ?? drive)?.trafficSections ?? [] : []}
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
                      followLive={Boolean(commitment)}
                      {...(selectedMode === "rail" && transitMapSegments.length > 0
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

        <H1ConditionsCard
          eastbound={eastboundTraffic}
          westbound={westboundTraffic}
          loading={eastboundTrafficLoading || westboundTrafficLoading}
          unavailable={
            eastboundTrafficFailed ||
            westboundTrafficFailed ||
            (!(eastboundTrafficLoading || westboundTrafficLoading) &&
              (!eastboundTraffic || !westboundTraffic))
          }
          compact
        />

        <section className="py-6" aria-labelledby="mode-details-title">
          <h2 id="mode-details-title" className="sr-only">
            Trip details
          </h2>
          <div
            role="group"
            aria-label="Travel mode"
            className="glass-panel grid grid-cols-2 gap-1 rounded-lg p-1"
          >
            <Button
              type="button"
              aria-pressed={selectedMode === "rail"}
              disabled={Boolean(commitment)}
              variant="ghost"
              onClick={() => chooseMode("rail")}
              className={`relative h-14 disabled:opacity-100 ${selectedMode === "rail" ? "bg-recommended text-recommended-foreground hover:bg-recommended" : commitment ? "opacity-35" : "text-muted-foreground"}`}
            >
              <TrainFront /> Rail {arriveByActive && best ? `· ${best.total_minutes} min` : railTripEstimate.expectedDurationMinutes !== null ? `· ${formatDriveMinutes(railTripEstimate.expectedDurationMinutes)}` : ""}
              {!commitment && verdict === "rail" && (
                <span className="mode-winner-badge">Faster than driving</span>
              )}
              {lockedMode === "rail" && <span className="mode-winner-badge">On this trip</span>}
            </Button>
            <Button
              type="button"
              aria-pressed={selectedMode === "drive"}
              disabled={Boolean(commitment)}
              variant="ghost"
              onClick={() => chooseMode("drive")}
              className={`relative h-14 disabled:opacity-100 ${selectedMode === "drive" ? "bg-recommended text-recommended-foreground hover:bg-recommended" : commitment ? "opacity-35" : "text-muted-foreground"}`}
            >
              <Car /> Drive {driveTripEstimate.expectedDurationMinutes !== null ? `· ${formatDriveMinutes(driveTripEstimate.expectedDurationMinutes)}` : ""}
              {!commitment && verdict === "drive" && (
                <span className="mode-winner-badge">Faster than transit</span>
              )}
              {lockedMode === "drive" && <span className="mode-winner-badge">On this trip</span>}
            </Button>
          </div>

          {selectedMode === "rail" && (
            <div className="mt-6">
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="text-xl font-bold text-foreground">Rail itinerary</h3>
                {itineraryRange && (
                  <p className="text-sm font-semibold text-muted-foreground">
                    {itineraryRange.low}–{itineraryRange.high} min
                  </p>
                )}
              </div>
              {best ? (
                <RailTripBreakdown
                  option={best}
                  inbound={arrivingHome}
                  liveBus={liveBus}
                  liveBusRefreshing={liveBusRefreshing}
                  weatherLines={weatherLines}
                  points={commuteMapPoints}
                />
              ) : (
                <p className="mt-5 text-sm text-muted-foreground">
                  {optionsLoading ? "Building your trip…" : "No rail trip available."}
                </p>
              )}
            </div>
          )}

          {selectedMode === "drive" && (
            <div className="nalu-card-surface mt-6 rounded-2xl border border-border p-5">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <h3 className="text-xl font-bold text-foreground">Drive details</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {tripOriginLabel} to {tripArrivalLabel}
                  </p>
                </div>
                <p className="text-4xl font-bold tabular-nums text-foreground">
                  {driveAvailable ? (driveTripEstimate.expectedDurationMinutes !== null ? Math.round(driveTripEstimate.expectedDurationMinutes) : driveLoading ? "…" : "—") : "—"}
                  <span className="ml-1 text-base">min</span>
                </p>
              </div>
              {drive?.corridorLabel ? (
                <RouteCorridor label={drive.corridorLabel} size="compact" />
              ) : (
                <p className="mt-4 text-sm font-medium text-foreground">
                  Drive straight from {tripOriginLabel} to {tripArrivalLabel}{" "}
                  — no stop at a rail station.
                </p>
              )}
              {driveAvailable && driveRange && drive && (
                <p className="mt-3 text-[10px] text-muted-foreground">{driveBasisLabel}</p>
              )}
              {!driveAvailable && carAwayReason && (
                <p className="mt-4 text-sm text-muted-foreground">{carAwayReason}</p>
              )}
              {driveAvailable && driveFailed && (
                <p className="mt-4 text-sm text-muted-foreground">
                  Live traffic is not available right now.
                </p>
              )}
              {driveAvailable && drive?.incidents[0] && verdict !== "drive" && !incidentDecides && (
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
                  <span className="ml-1 text-[10px] text-muted-foreground">{line.source}</span>
                </p>
              ))}
              {!inbound && driveAvailable && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCarPlace("destination")}
                  className="mt-5"
                >
                  I'm driving all the way
                </Button>
              )}
              {inbound && carPlace === "destination" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCarPlace("home")}
                  className="mt-5"
                >
                  My car isn't here
                </Button>
              )}
            </div>
          )}
        </section>

        {selectedMode === "rail" && options.length > 1 && (
          <section
            className="alternative-panel mb-8 min-w-0 max-w-full overflow-hidden rounded-lg p-4 sm:p-5"
            aria-labelledby="later-title"
          >
            <div className="flex items-start gap-3">
              <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-full border border-recommended/35 bg-recommended/10 text-recommended">
                <Clock3 className="size-4" />
              </span>
              <div>
                <h2 id="later-title" className="text-xl font-bold text-foreground">
                  Alternative departures
                </h2>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  Choose another trip.
                </p>
              </div>
            </div>
            <ol className="mt-5 grid min-w-0 max-w-full gap-3">
              {options
                .filter((option) => !best || optionIdentity(option) !== optionIdentity(best))
                .slice(0, 3)
                .map((option, index) => {
                  const arrivalDifference = best
                    ? Math.round((option.arrive_seconds - best.arrive_seconds) / 60)
                    : 0;
                  const departureDifference = best
                    ? Math.round((option.leave_by_seconds - best.leave_by_seconds) / 60)
                    : 0;
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
                              <span className="block text-[10px] font-bold uppercase text-muted-foreground">
                                Option {String.fromCharCode(65 + index)}
                              </span>
                              <span className="mt-1 grid grid-cols-[auto_auto_auto] items-center justify-start gap-2 text-xl font-bold tabular-nums text-foreground">
                                <span>{clockFromSeconds(option.leave_by_seconds)}</span>
                                <ArrowRight className="size-4 shrink-0 text-recommended transition-transform group-hover:translate-x-0.5" />
                                <span>{clockFromSeconds(option.arrive_seconds)}</span>
                              </span>
                            </span>
                            <span className="w-fit max-w-full rounded-full border border-border bg-muted/70 px-2.5 py-1 text-left text-[10px] font-bold leading-snug tabular-nums text-muted-foreground sm:text-right">
                              {arrivalDifference > 0
                                ? `Arrives ${arrivalDifference} min later than current`
                                : arrivalDifference < 0
                                  ? `Arrives ${Math.abs(arrivalDifference)} min earlier than current`
                                  : "Same arrival as current"}
                            </span>
                          </span>
                          <span className="mt-4 grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-3 border-t border-border/70 pt-3 text-sm">
                            <span className="min-w-0">
                              <span className="block text-[10px] font-semibold uppercase text-muted-foreground">
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
                              <span className="block text-[10px] font-semibold uppercase text-muted-foreground">
                                Total trip
                              </span>
                              <span className="mt-1 block text-lg font-bold tabular-nums text-foreground">
                                {option.total_minutes} min
                              </span>
                            </span>
                          </span>
                          {option.legs[0] && (
                            <span className="mt-3 flex min-w-0 max-w-full items-center gap-2 overflow-hidden rounded-md bg-recommended/5 px-3 py-2 text-xs text-muted-foreground">
                              <span className="size-1.5 shrink-0 rounded-full bg-recommended" />
                              <span className="truncate">{vehicleName(option.legs[0])}</span>
                            </span>
                          )}
                        </span>
                      </Button>
                    </li>
                  );
                })}
            </ol>
          </section>
        )}

        <Button
          variant="destructive"
          onClick={endTrip}
          className="end-trip-action mt-2 h-14 w-full text-base font-black uppercase"
        >
          <RotateCcw className="size-5" /> Reset
        </Button>

        <footer className="mt-auto flex items-center justify-between border-t border-border pt-5 text-sm text-muted-foreground">
          <span>Schedule data from the agency feed</span>
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

function RailTripBreakdown({
  option,
  inbound,
  liveBus,
  liveBusRefreshing,
  weatherLines,
  points,
}: {
  option: Option;
  inbound: boolean;
  liveBus: BusArrivalsResult | undefined;
  liveBusRefreshing: boolean;
  weatherLines: Map<number, WeatherLine[]>;
  points: Array<{ id?: string; name: string; lat: number; lon: number }>;
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
      const ta = a.leg.depart_seconds, tb = b.leg.depart_seconds;
      return ta !== null && tb !== null && ta !== tb ? ta - tb : a.i - b.i;
    })
    .map(({ leg }) => leg);

  return (
    <>
      <ol className="mt-7" aria-label="Rail trip breakdown">
        {rows.map((leg, index) => {
          const Icon = modeIcon(leg.mode);
          const previous = rows[index - 1];
          const waitMinutes =
            previous?.arrive_seconds !== null &&
            previous?.arrive_seconds !== undefined &&
            leg.depart_seconds !== null
              ? Math.max(0, Math.round((leg.depart_seconds - previous.arrive_seconds) / 60))
              : 0;
          const legMinutes = duration(leg);
          const stationName = stationLabel(leg.to);
          const label =
            leg.kind === "access"
              ? leg.mode === "walk"
                ? `Walk to ${stationName || "the station"} Station`
                : stationName
                  ? `To ${stationName} Station`
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
                ? `${stationName || titleCase(leg.to) || "station"} Station platform`
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
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-xs font-bold uppercase text-foreground">
                    {followsTransit && previous
                      ? `Get off at ${transitStopName(previous, "to")}`
                      : label}
                  </p>
                  {legMinutes !== null && (
                    <p className="shrink-0 text-xs font-semibold tabular-nums text-foreground">
                      {legMinutes} min
                    </p>
                  )}
                </div>
                <p
                  className={`mt-1 text-sm font-bold leading-snug text-foreground ${followsTransit ? "rounded-md border border-recommended/50 bg-recommended/10 px-2.5 py-2" : ""}`}
                >
                  {followsTransit
                    ? `${vehicleName(leg)} from ${transitStopName(previous, "to")}`
                    : vehicleName(leg)}
                </p>
                {accessWalk && <WalkSegment walk={accessWalk} />}
                {leg.mode === "bus" ? (
                  <div className="mt-2">
                    {waitMinutes > 0 && (
                      <p className="text-xs font-semibold text-foreground">
                        Walk/wait between rides · {waitMinutes} min
                      </p>
                    )}
                    <p className="text-sm font-semibold text-foreground">
                      Board at: {transitStopName(leg, "from")}
                    </p>
                    <LandmarkHint name={transitStopName(leg, "from")} />
                    <BusArrivalTime
                      arrival={liveArrival}
                      scheduledSeconds={leg.depart_seconds}
                      fetchedAt={liveBus?.fetchedAt}
                      refreshing={liveBusRefreshing}
                      compact
                    />
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
                    <span className="ml-1 text-[10px] text-muted-foreground">{line.source}</span>
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

type WalkHop = {
  from: { lat: number; lon: number; label: string };
  to: { lat: number; lon: number; label: string };
  meters: number;
  minutes: number;
};

/** Origin -> boarding stop (or drop-off -> door) on foot, when both points resolve. */
function walkBetween(
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

function WalkSegment({ walk }: { walk: WalkHop }) {
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

function matchLiveArrival(
  result: BusArrivalsResult | undefined,
  route: string | null,
  headsign: string | null,
  scheduledSeconds: number | null,
) {
  if (!result || result.error) return null;
  return confirmedLiveBus(result.arrivals, route, headsign, scheduledSeconds);
}

function BusArrivalTime({
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
        timeZone: "Pacific/Honolulu",
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

type SetupDialogProps = {
  open: boolean;
  firstRun: boolean;
  setup: Setup;
  onClose: () => void;
  onSave: (next: Setup) => void;
  alertPrefs: AlertPrefs;
  onAlertPrefsChange: (next: AlertPrefs) => void;
  savedPlaces: SavedPlace[];
  onPlacesChange: (next: SavedPlace[]) => void;
};

const EXPIRY_DISMISS_KEY = "nalu-expiry-dismissed-v1";

/** The expiry date is read from the loaded feed's calendar, never hardcoded. */
function useDataExpiry() {
  const { data } = useQuery({
    queryKey: ["gtfs-expiry"],
    staleTime: 12 * 60 * 60_000,
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("gtfs_data_expiry");
      if (error) throw error;
      const row = (data ?? [])[0];
      return row
        ? { expiresOn: row.expires_on as string, daysRemaining: row.days_remaining as number }
        : null;
    },
  });
  return data ?? null;
}

function expiryLabel(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year!, (month ?? 1) - 1, day ?? 1).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

/** Sticky, automatic alert for the stop the rider needs to get off at. */
function ApproachBanner({
  state,
  stopsAway,
  minutesToAlight,
  nextStopName,
  alightName,
  vehicle,
  live,
  onDismiss,
}: {
  state: ApproachState;
  stopsAway: number;
  minutesToAlight: number | null;
  nextStopName: string;
  alightName: string;
  vehicle: "bus" | "rail";
  live: boolean;
  onDismiss: () => void;
}) {
  const stopLabel = (name: string) =>
    vehicle === "rail" ? `${stationLabel(name) || titleCase(name)} Station` : titleCase(name);
  const exitName = stopLabel(alightName);
  const nextName = stopLabel(nextStopName);
  const minutesText =
    minutesToAlight !== null && minutesToAlight > 0 ? ` · ${minutesToAlight} min` : "";

  if (state === "cruising" || state === "off-route") {
    return (
      <div
        role="status"
        className="sticky top-0 z-40 -mx-2 mb-2 flex items-center justify-between gap-2 rounded-full border border-border bg-surface-raised px-3.5 py-2"
      >
        <p className="text-xs font-semibold text-foreground">
          {state === "off-route"
            ? `Off route · alerts paused · exit at ${exitName}`
            : `En route · Next: ${nextName} · Exit at ${exitName}${minutesText}`}
        </p>
        <button
          aria-label="Dismiss stop alert"
          onClick={onDismiss}
          className="shrink-0 text-muted-foreground"
        >
          <X className="size-3.5" />
        </button>
      </div>
    );
  }

  const urgent = state === "urgent";
  const passed = state === "passed";
  return (
    <div
      role="alert"
      aria-live="assertive"
      className={`sticky top-0 z-40 -mx-2 mb-3 rounded-2xl border-2 px-4 py-3 shadow-lg ${
        passed
          ? "border-border bg-surface-raised"
          : urgent
            ? "border-white bg-[#b91c1c]"
            : "border-[#fbbf24] bg-[#78350f]"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p
            className={`text-base font-extrabold uppercase tracking-wide ${passed ? "text-foreground" : "text-white"}`}
          >
            {passed
              ? "Looks like you passed your stop"
              : urgent
                ? "⚠️ Pull cord · your stop is next!"
                : "🔔 Get ready · 2 stops away"}
          </p>
          <p
            className={`mt-1 text-[15px] font-bold leading-snug ${passed ? "text-foreground" : "text-white"}`}
          >
            {passed
              ? `Your exit was ${exitName}. Get off at the next stop and head back.`
              : urgent
                ? `Get off at ${exitName}`
                : `Next stop is ${nextName}, then get off at ${exitName}.`}
          </p>
          <p
            className={`mt-1 text-xs font-semibold ${passed ? "text-muted-foreground" : "text-white/80"}`}
          >
            {passed
              ? live
                ? "Tracking your location"
                : "Using the timetable"
              : `${stopsAway <= 1 ? "1 stop to go" : `${stopsAway} stops to go`}${minutesText}${
                  live ? " · tracking your location" : " · using the timetable"
                }`}
          </p>
        </div>
        <button
          aria-label="Dismiss stop alert"
          onClick={onDismiss}
          className="shrink-0 rounded-full p-1 text-white/80 hover:text-white"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}

function DataExpiryNotice() {
  const expiry = useDataExpiry();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!expiry) return;
    setDismissed(window.localStorage.getItem(EXPIRY_DISMISS_KEY) === expiry.expiresOn);
  }, [expiry]);

  if (!expiry) return null;
  const expired = expiry.daysRemaining < 0;
  if (!expired && (expiry.daysRemaining > 7 || dismissed)) return null;

  return (
    <div
      className={`mt-4 flex items-start justify-between gap-3 rounded-lg border px-4 py-3 text-xs ${
        expired ? "border-destructive/40 text-destructive" : "border-chart-4/40 text-chart-4"
      }`}
      role="status"
    >
      <p>
        {expired
          ? "Transit data is out of date · times may be off"
          : "Transit schedules are getting old · times may be off"}
      </p>
      {!expired && (
        <button
          type="button"
          aria-label="Dismiss schedule expiry notice"
          className="shrink-0 text-muted-foreground"
          onClick={() => {
            window.localStorage.setItem(EXPIRY_DISMISS_KEY, expiry.expiresOn);
            setDismissed(true);
          }}
        >
          Dismiss
        </button>
      )}
    </div>
  );
}

/** Friendly recovery steps shown when the browser has blocked location access. */
function LocationBlockedCard({ onDismiss }: { onDismiss: () => void }) {
  const platform = useState(() =>
    typeof navigator === "undefined"
      ? "desktop"
      : detectLocationPlatform(
          navigator.userAgent,
          typeof document !== "undefined" && "ontouchend" in document,
        ),
  )[0] as ReturnType<typeof detectLocationPlatform>;

  const steps =
    platform === "ios"
      ? {
          label: "iPhone or iPad · Safari",
          body: (
            <>
              Tap the <strong className="font-semibold">aA</strong> or page-settings icon in your
              address bar, open <strong className="font-semibold">Website Settings</strong>, change{" "}
              <strong className="font-semibold">Location</strong> to{" "}
              <strong className="font-semibold">Allow</strong>, then refresh.
            </>
          ),
        }
      : platform === "android"
        ? {
            label: "Chrome · Android",
            body: (
              <>
                Tap the <strong className="font-semibold">tune / lock</strong> icon next to the URL,
                open <strong className="font-semibold">Permissions</strong>, set{" "}
                <strong className="font-semibold">Location</strong> to{" "}
                <strong className="font-semibold">Allow</strong>, then refresh.
              </>
            ),
          }
        : {
            label: "Chrome or Edge · desktop",
            body: (
              <>
                Click the <strong className="font-semibold">lock</strong> icon in the address bar,
                open <strong className="font-semibold">Site settings</strong>, set{" "}
                <strong className="font-semibold">Location</strong> to{" "}
                <strong className="font-semibold">Allow</strong>, then reload.
              </>
            ),
          };

  return (
    <div
      className="relative rounded-lg border border-chart-4/40 bg-surface-raised p-4 pr-9"
      role="status"
    >
      <p className="text-sm font-semibold text-foreground">Location is blocked</p>
      <p className="mt-0.5 text-[11px] uppercase tracking-wide text-muted-foreground">
        {steps.label}
      </p>
      <p className="mt-1.5 text-sm leading-relaxed text-foreground">{steps.body}</p>
      <p className="mt-2 text-xs text-muted-foreground">
        Nalu also works without location — you can always pick a station by hand.
      </p>
      <button
        type="button"
        aria-label="Dismiss location help"
        onClick={onDismiss}
        className="absolute right-2 top-2 rounded-full p-1 text-muted-foreground transition-colors hover:text-foreground"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}

/** Settings-only controls for how the stop alert announces itself. */
function AlertPrefsSection({
  prefs,
  onChange,
}: {
  prefs: AlertPrefs;
  onChange: (next: AlertPrefs) => void;
}) {
  const rows: { id: keyof AlertPrefs; label: string; hint: string }[] = [
    { id: "sound", label: "Sound alert", hint: "A soft chime when your stop is next." },
    { id: "haptics", label: "Haptic vibration", hint: "Buzz your phone when your stop is next." },
    {
      id: "keepOnTransfer",
      label: "Keep alerts while changing rides",
      hint: "Stay visible when the trip moves to the next leg.",
    },
  ];
  return (
    <section className="space-y-2 border-t border-border pt-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Stop alerts
      </p>
      {rows.map((row) => (
        <div
          key={row.id}
          className="flex items-center justify-between gap-4 rounded-lg bg-surface-raised px-4 py-3"
        >
          <Label htmlFor={`alert-${row.id}`} className="leading-snug">
            {row.label}
            <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
              {row.hint}
            </span>
          </Label>
          <Switch
            id={`alert-${row.id}`}
            checked={prefs[row.id]}
            onCheckedChange={(checked) => {
              onChange({ ...prefs, [row.id]: checked });
              if (row.id === "sound" && checked) playChime();
            }}
          />
        </div>
      ))}
    </section>
  );
}

function SettingsExpiryBanner() {
  const expiry = useDataExpiry();
  if (!expiry || expiry.daysRemaining > 14) return null;
  return (
    <p
      className="mb-4 rounded-lg border border-chart-4/40 px-4 py-3 text-xs text-chart-4"
      role="status"
    >
      Transit data expires {expiryLabel(expiry.expiresOn)} · refresh needed
    </p>
  );
}

function PlacePills({
  places,
  disabled,
  onPick,
}: {
  places: SavedPlace[];
  disabled: boolean;
  onPick: (place: SavedPlace) => void;
}) {
  if (!places.length) return null;
  return (
    <div className="flex flex-wrap gap-2" aria-label="Saved places">
      {places.map((place) => {
        const Icon = shortcutIcon(place.kind);
        return (
          <Button
            key={place.id}
            type="button"
            variant="secondary"
            size="sm"
            disabled={disabled}
            onClick={() => onPick(place)}
            className="h-9 gap-1.5 rounded-full px-3"
          >
            <Icon className="size-3.5" /> {place.label}
          </Button>
        );
      })}
    </div>
  );
}

const SHORTCUTS_KEY = "nalu-shortcuts-v1";
const DEFAULT_SHORTCUTS = ["home", "work"];
const MAX_SHORTCUTS = 4;

/** A shortcut slot is a place kind (home/work/school/gym) or a saved place id. */
function resolveShortcut(places: SavedPlace[], slot: string): SavedPlace | null {
  if ((PLACE_KINDS as string[]).includes(slot) && slot !== "custom") {
    return findByKind(places, slot as PlaceKind);
  }
  return places.find((place) => place.id === slot) ?? null;
}
function shortcutLabel(places: SavedPlace[], slot: string): string {
  if ((PLACE_KINDS as string[]).includes(slot)) return kindLabel(slot as PlaceKind);
  return places.find((place) => place.id === slot)?.label ?? "Saved place";
}
function shortcutIcon(slot: string) {
  if (slot === "home") return House;
  if (slot === "work") return BriefcaseBusiness;
  if (slot === "school") return GraduationCap;
  if (slot === "gym") return Dumbbell;
  return MapPin;
}

function ShortcutGrid({
  places,
  onStart,
  onPlacesChange,
}: {
  places: SavedPlace[];
  onStart: (slot: string) => void;
  onPlacesChange: (next: SavedPlace[]) => void;
}) {
  const [slots, setSlots] = useState<string[]>(DEFAULT_SHORTCUTS);
  const [quickEdit, setQuickEdit] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(SHORTCUTS_KEY);
      const parsed: unknown = raw ? JSON.parse(raw) : null;
      if (
        Array.isArray(parsed) &&
        parsed.every((item) => typeof item === "string") &&
        parsed.length
      ) {
        setSlots(parsed.slice(0, MAX_SHORTCUTS));
      }
    } catch {
      // Keep defaults when storage is unreadable.
    }
  }, []);
  function update(next: string[]) {
    setSlots(next);
    window.localStorage.setItem(SHORTCUTS_KEY, JSON.stringify(next));
  }
  const choices = [
    ...(["home", "work", "school", "gym"] as const).map((kind) => ({
      value: kind as string,
      label: kindLabel(kind),
    })),
    ...places
      .filter((place) => place.kind === "custom")
      .map((place) => ({ value: place.id, label: place.label })),
  ];
  const unused = choices.filter((choice) => !slots.includes(choice.value));

  return (
    <div className="mt-2">
      <div className="grid grid-cols-2 gap-2" aria-label="Saved place shortcuts">
        {slots.map((slot, index) => {
          const place = resolveShortcut(places, slot);
          const Icon = shortcutIcon(slot);
          const label = shortcutLabel(places, slot);
          if (editing) {
            return (
              <div
                key={`${slot}-${index}`}
                className="glass-panel flex h-14 items-center gap-1 rounded-md border border-primary/30 px-2"
              >
                <Select
                  value={slot}
                  onValueChange={(value) => {
                    const next = [...slots];
                    const swapIndex = next.indexOf(value);
                    // Picking a slot already pinned elsewhere swaps the two.
                    if (swapIndex >= 0) next[swapIndex] = slot;
                    next[index] = value;
                    update(next);
                  }}
                >
                  <SelectTrigger
                    className="h-10 min-w-0 flex-1 bg-transparent"
                    aria-label={`Shortcut ${index + 1}`}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {choices.map((choice) => (
                      <SelectItem key={choice.value} value={choice.value}>
                        {choice.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-9 shrink-0"
                  aria-label={`Remove ${label} shortcut`}
                  disabled={slots.length <= 1}
                  onClick={() => update(slots.filter((_, i) => i !== index))}
                >
                  <X className="size-4" />
                </Button>
              </div>
            );
          }
          return (
            <div key={`${slot}-${index}`} className="relative min-w-0">
              <Button
                variant="outline"
                onClick={() => onStart(slot)}
                className="glass-panel h-14 w-full min-w-0 justify-start gap-3 border-primary/30 bg-primary/5 pl-3 pr-9 text-foreground hover:bg-primary/10"
                aria-label={place ? `Start a trip to ${label}` : `Set your ${label} location`}
              >
                <span className="grid size-8 shrink-0 place-items-center rounded-md bg-primary/15 text-primary">
                  <Icon className="size-4" />
                </span>
                <span className="min-w-0 text-left">
                  <span className="block truncate text-sm font-bold">{label}</span>
                  <span className="block truncate text-[11px] font-medium text-muted-foreground">
                    {place ? place.name : "Set location"}
                  </span>
                </span>
              </Button>
              <button
                type="button"
                onClick={() => setQuickEdit(slot)}
                aria-label={`Change ${label} address`}
                className="absolute right-1 top-1 grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-primary/10 hover:text-foreground"
              >
                <Pencil className="size-3.5" />
              </button>
            </div>
          );
        })}
        {editing && slots.length < MAX_SHORTCUTS && unused.length > 0 && (
          <Button
            variant="outline"
            className="h-14 gap-2 border-dashed border-primary/40 bg-transparent text-muted-foreground"
            onClick={() => update([...slots, unused[0]!.value])}
          >
            <Plus className="size-4" /> Add shortcut
          </Button>
        )}
      </div>
      <div className="mt-1 flex justify-end">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 text-xs text-muted-foreground"
          onClick={() => setEditing((value) => !value)}
        >
          {editing ? <Check className="size-3.5" /> : <Pencil className="size-3.5" />}
          {editing ? "Done" : "Edit shortcuts"}
        </Button>
      </div>
      <QuickPlaceDialog
        slot={quickEdit}
        places={places}
        onClose={() => setQuickEdit(null)}
        onSave={(next) => {
          onPlacesChange(next);
          setQuickEdit(null);
        }}
      />
    </div>
  );
}

/** Search and replace one shortcut's address in place, without opening Settings. */
function QuickPlaceDialog({
  slot,
  places,
  onClose,
  onSave,
}: {
  slot: string | null;
  places: SavedPlace[];
  onClose: () => void;
  onSave: (next: SavedPlace[]) => void;
}) {
  const findPlaces = useServerFn(searchPlaces);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    setQuery("");
    setDebounced("");
  }, [slot]);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(query.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [query]);
  const { data: results = [], isFetching } = useQuery({
    queryKey: ["place-search", debounced],
    enabled: Boolean(slot) && debounced.length >= 2,
    staleTime: 5 * 60_000,
    queryFn: async () => (await findPlaces({ data: { query: debounced } })).results,
  });
  const current = slot ? resolveShortcut(places, slot) : null;
  const label = slot ? shortcutLabel(places, slot) : "";

  function choose(hit: PlaceSuggestion) {
    if (!slot) return;
    const kind: PlaceKind =
      current?.kind ?? ((PLACE_KINDS as string[]).includes(slot) ? (slot as PlaceKind) : "custom");
    const place = makeSavedPlace({
      ...(current
        ? {
            id: current.id,
            label: current.label,
            typicalArrivalSeconds: current.typicalArrivalSeconds,
          }
        : {}),
      kind,
      name: hit.name,
      address: hit.address,
      lat: hit.lat,
      lon: hit.lon,
    });
    onSave(upsertPlace(places, place));
    toast(`${label} updated`, { description: hit.address || hit.name });
  }

  return (
    <Dialog open={Boolean(slot)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Change {label}</DialogTitle>
          <DialogDescription>
            {current ? `Now: ${current.address}` : "Search for a place or street address."}
          </DialogDescription>
        </DialogHeader>
        <Input
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search a place or address"
          aria-label={`New ${label} address`}
        />
        <ul className="max-h-72 space-y-1 overflow-y-auto" aria-live="polite">
          {isFetching && <li className="px-2 py-2 text-sm text-muted-foreground">Searching…</li>}
          {!isFetching && debounced.length >= 2 && results.length === 0 && (
            <li className="px-2 py-2 text-sm text-muted-foreground">No places found on Oʻahu.</li>
          )}
          {results.map((hit) => (
            <li key={hit.id}>
              <button
                type="button"
                onClick={() => choose(hit)}
                className="w-full rounded-md px-3 py-2 text-left hover:bg-primary/10"
              >
                <span className="block truncate text-sm font-bold text-foreground">{hit.name}</span>
                <span className="block truncate text-xs text-muted-foreground">{hit.address}</span>
              </button>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}

function SetupDialog({
  open,
  firstRun,
  setup,
  onClose,
  onSave,
  alertPrefs,
  onAlertPrefsChange,
  savedPlaces,
  onPlacesChange,
}: SetupDialogProps) {
  const findPlaces = useServerFn(searchPlaces);
  const lookupAddress = useServerFn(reverseGeocode);
  const [draft, setDraft] = useState<Setup>(setup);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [placeQuery, setPlaceQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  // Whether the browser currently blocks location, so recovery steps can be shown.
  const [permissionBlocked, setPermissionBlocked] = useState(false);
  const [saveKind, setSaveKind] = useState<PlaceKind>("work");
  const [saveTime, setSaveTime] = useState("");
  const [originLabel, setOriginLabel] = useState("Current location");
  // Distance to the best boarding station; decides walk vs park-and-ride.
  const [stationDistanceM, setStationDistanceM] = useState<number | null>(null);

  useEffect(() => {
    if (open) {
      setDraft(setup);
      setStatus(null);
      setOriginLabel(setup.homeLat !== null ? "Your starting point" : "Current location");
      setPlaceQuery("");
      setDebouncedQuery("");
    }
    if (!open) return;
    let cancelled = false;
    if (window.localStorage.getItem(LOCATION_DENIED_KEY) === "1") setPermissionBlocked(true);
    queryLocationPermission()
      .then((state) => {
        if (cancelled) return;
        if (state === "denied") {
          setPermissionBlocked(true);
          window.localStorage.setItem(LOCATION_DENIED_KEY, "1");
        } else if (state === "granted" || state === "prompt") {
          setPermissionBlocked(false);
          window.localStorage.removeItem(LOCATION_DENIED_KEY);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [open, setup]);

  // From defaults to the current location the first time a trip is set up.
  useEffect(() => {
    if (!open || setup.homeLat !== null) return;
    void queryLocationPermission().then((state) => {
      if (state === "granted") void locateMe();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // 300ms debounce so typing does not fire a search per keystroke.
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(placeQuery.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [placeQuery]);

  const { data: suggestions = [], isFetching: searching } = useQuery({
    queryKey: ["place-search", debouncedQuery],
    enabled: open && debouncedQuery.length >= 2,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const result = await findPlaces({ data: { query: debouncedQuery } });
      return result.results;
    },
  });

  const { data: stations = [] } = useRailStations(open);

  async function locateMe() {
    if (!navigator.geolocation) {
      setStatus("This device cannot share its location. Pick a saved place below.");
      return;
    }
    // Check without prompting first: if it is already blocked, skip the request
    // and show the recovery steps right away.
    const permission = await queryLocationPermission();
    if (permission === "denied") {
      setPermissionBlocked(true);
      window.localStorage.setItem(LOCATION_DENIED_KEY, "1");
      setStatus(
        "Location is blocked in your browser. Follow the steps below to allow it, or pick a saved place.",
      );
      return;
    }
    setBusy(true);
    setStatus("Finding where you are…");
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;
        const { data, error } = await supabase.rpc("nearest_stop", {
          p_lat: lat,
          p_lon: lon,
          p_rail_only: true,
        });
        setBusy(false);
        const nearest = data?.[0];
        if (error || !nearest) {
          setStatus("Could not plan from here. Pick a saved place.");
          return;
        }
        setDraft((current) => ({
          ...current,
          homeLat: lat,
          homeLon: lon,
          homeStopId: nearest.stop_id,
          homeStopName: nearest.stop_name ?? "",
        }));
        setOriginLabel("Current location");
        setStationDistanceM(Number(nearest.distance_m));
        const accuracy = position.coords.accuracy;
        const precision = Number.isFinite(accuracy)
          ? ` Accurate to about ${formatDistance(accuracy)}.`
          : "";
        setStatus(`Using your current location.${precision}`);
        // Confirm the exact spot in plain words, so a wrong pin is obvious.
        const address = await lookupAddress({ data: { lat, lon } }).catch(() => null);
        if (address?.label) {
          setStatus(`Detected: ${address.label}.${precision}`);
        }
      },
      (error) => {
        setBusy(false);
        if (isPermissionDeniedError(error)) {
          setPermissionBlocked(true);
          window.localStorage.setItem(LOCATION_DENIED_KEY, "1");
          setStatus(
            "Location is blocked in your browser. Follow the steps below to allow it, or pick a saved place.",
          );
          return;
        }
        setStatus("Location was not shared. Pick a saved place below.");
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
    );
  }

  /** Use a point as the starting side: remember the door and derive its station. */
  async function applyOrigin(place: PointLike, label?: string) {
    setBusy(true);
    setOriginLabel(label ?? place.name);
    setStatus(null);
    try {
      const { data } = await supabase.rpc("nearest_stop", {
        p_lat: place.lat,
        p_lon: place.lon,
        p_rail_only: true,
      });
      const nearest = data?.[0];
      setDraft((current) => ({
        ...current,
        homeLat: place.lat,
        homeLon: place.lon,
        homeStopId: nearest?.stop_id ?? current.homeStopId,
        homeStopName: nearest?.stop_name ?? current.homeStopName,
      }));
      if (nearest) setStationDistanceM(Number(nearest.distance_m));
    } finally {
      setBusy(false);
    }
  }

  async function applyPreset(from: PointLike, to: PointLike) {
    await applyOrigin(from);
    await selectPlace(to);
  }

  function savePlace(kind: PlaceKind, point: PointLike, arriveBySeconds: number | null) {
    const label = kind === "custom" ? point.name : kindLabel(kind);
    onPlacesChange(
      upsertPlace(savedPlaces, {
        id: `${kind}-${Date.now()}`,
        kind,
        label,
        name: point.name,
        address: point.address || point.name,
        lat: point.lat,
        lon: point.lon,
        typicalArrivalSeconds: arriveBySeconds,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }),
    );
    setStatus(`Saved ${label}: ${point.name}.`);
  }

  async function selectPlace(place: PointLike) {
    setBusy(true);
    setStatus("Finding the stops on each side of that place…");
    try {
      // A stop serves one direction only, so resolve the arriving stop and the
      // stop heading back toward the rail line separately, from the data.
      const [arriving, boarding, fallback] = await Promise.all([
        supabase.rpc("directional_dest_stop", {
          p_lat: place.lat,
          p_lon: place.lon,
          p_toward_rail: false,
        }),
        supabase.rpc("directional_dest_stop", {
          p_lat: place.lat,
          p_lon: place.lon,
          p_toward_rail: true,
        }),
        supabase.rpc("nearest_stop", { p_lat: place.lat, p_lon: place.lon, p_rail_only: false }),
      ]);
      const near = fallback.data?.[0];
      const out = arriving.data?.[0] ?? near;
      const back = boarding.data?.[0] ?? near;
      if (!out || !back) {
        setStatus("No stop found near that place.");
        return;
      }
      setDraft((current) => ({
        ...current,
        destinationName: place.name,
        destinationAddress: place.address || place.name,
        destLat: place.lat,
        destLon: place.lon,
        destStopId: out?.stop_id ?? "",
        destStopName: out?.stop_name ?? "",
        destStopWalkM: Number(out?.distance_m ?? 0),
        destReturnStopId: back?.stop_id ?? "",
        destReturnStopName: back?.stop_name ?? "",
        destReturnWalkM: Number(back?.distance_m ?? 0),
      }));
      setPlaceQuery("");
      setDebouncedQuery("");
      setStatus(null);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Place search failed.");
    } finally {
      setBusy(false);
    }
  }

  function save() {
    // A commute requires exact places. A station is transit access metadata,
    // never a substitute for the rider's Home coordinates.
    const home = findByKind(savedPlaces, "home");
    onSave({
      ...draft,
      // Walk when the station is close; otherwise plan park-and-ride driving.
      allowDrive: stationDistanceM === null ? draft.allowDrive : stationDistanceM > 1200,
      homeLat: draft.homeLat ?? home?.lat ?? null,
      homeLon: draft.homeLon ?? home?.lon ?? null,
    });
  }

  const canSave =
    hasValidCoordinates({ lat: draft.homeLat, lon: draft.homeLon }) &&
    hasValidCoordinates({ lat: draft.destLat, lon: draft.destLon });
  const presets = commutePresets(savedPlaces);
  const originPoint: PointLike | null =
    draft.homeLat !== null && draft.homeLon !== null
      ? {
          name: draft.homeStopName
            ? `Near ${stationLabel(draft.homeStopName)}`
            : "My starting point",
          address: draft.homeStopName ? `${stationLabel(draft.homeStopName)} area` : "",
          lat: draft.homeLat,
          lon: draft.homeLon,
        }
      : null;
  const destinationPoint: PointLike | null =
    draft.destLat !== null && draft.destLon !== null
      ? {
          name: draft.destinationName,
          address: draft.destinationAddress,
          lat: draft.destLat,
          lon: draft.destLon,
        }
      : null;
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent className="bottom-0 left-0 top-auto max-h-[90dvh] w-full max-w-none translate-x-0 translate-y-0 gap-6 overflow-y-auto rounded-t-lg border-x-0 border-b-0 bg-background p-6 sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-lg">
        <SettingsExpiryBanner />
        <DialogHeader className="text-left">
          <DialogTitle className="text-2xl">{firstRun ? "WHERE TO?" : "Your trip"}</DialogTitle>
          <DialogDescription>
            Where you’re starting and where you’re going. Nalu picks the best station and route for
            you.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5">
          <div className="grid gap-2">
            <Label>From</Label>
            <div className="flex items-center justify-between gap-3 rounded-lg bg-surface-raised px-4 py-3">
              <div className="flex min-w-0 items-center gap-2">
                <LocateFixed className="size-4 shrink-0 text-primary" />
                <p className="truncate font-medium">{originLabel}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="shrink-0"
                disabled={busy}
                onClick={locateMe}
              >
                <LocateFixed className="size-4" /> Locate
              </Button>
            </div>
            <PlacePills
              places={savedPlaces}
              disabled={busy}
              onPick={(place) => void applyOrigin(place, place.label)}
            />
            {permissionBlocked && (
              <LocationBlockedCard onDismiss={() => setPermissionBlocked(false)} />
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="destination">To</Label>
            {draft.destinationName ? (
              <div className="flex items-center justify-between gap-3 rounded-lg bg-surface-raised px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{draft.destinationName}</p>
                  {draft.destinationAddress !== draft.destinationName && (
                    <p className="truncate text-xs text-muted-foreground">
                      {draft.destinationAddress}
                    </p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  className="shrink-0"
                  onClick={() =>
                    setDraft((current) => ({
                      ...current,
                      destinationName: "",
                      destinationAddress: "",
                      destLat: null,
                      destLon: null,
                      destStopId: "",
                      destStopName: "",
                      destStopWalkM: 0,
                      destReturnStopId: "",
                      destReturnStopName: "",
                      destReturnWalkM: 0,
                    }))
                  }
                >
                  Change
                </Button>
              </div>
            ) : (
              <>
                <PlacePills places={savedPlaces} disabled={busy} onPick={selectPlace} />
                <Input
                  id="destination"
                  className="h-12 bg-surface-raised"
                  placeholder="Search for a place or address"
                  autoComplete="off"
                  value={placeQuery}
                  onChange={(event) => setPlaceQuery(event.target.value)}
                />
                {searching && <p className="text-sm text-muted-foreground">Searching…</p>}
                {suggestions.length > 0 && (
                  <ul className="divide-y divide-border overflow-hidden rounded-lg bg-surface-raised">
                    {suggestions.map((place) => (
                      <li key={place.id}>
                        <button
                          type="button"
                          onClick={() => selectPlace(place)}
                          disabled={busy}
                          className="w-full px-4 py-3 text-left transition-colors hover:bg-muted/40"
                        >
                          <span className="block truncate font-medium">{place.name}</span>
                          {place.address && place.address !== place.name && (
                            <span className="block truncate text-xs text-muted-foreground">
                              {place.address}
                            </span>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {!searching && debouncedQuery.length >= 2 && suggestions.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No places matched. Try a different name.
                  </p>
                )}
              </>
            )}
          </div>

          <Button onClick={save} disabled={!canSave || busy} className="h-12 w-full shadow-none">
            GO
          </Button>

          {!firstRun && permissionBlocked && (
            <section className="space-y-2 border-t border-border pt-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Location
              </p>
              <LocationBlockedCard onDismiss={() => setPermissionBlocked(false)} />
            </section>
          )}

          {!firstRun && (
            <section className="grid gap-3 rounded-lg border border-border p-4">
              <div className="flex items-center justify-between gap-3">
                <Label className="text-sm">Saved places</Label>
                {findByKind(savedPlaces, "home") && findByKind(savedPlaces, "work") && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onPlacesChange(swapHomeWork(savedPlaces))}
                  >
                    Swap Home &amp; Work
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Save Home, Work, School, Gym or anywhere else once, then start a trip with one tap.
              </p>

              {presets.length > 0 && (
                <div className="flex flex-wrap gap-2" aria-label="Commute presets">
                  {presets.map((preset) => (
                    <Button
                      key={preset.id}
                      variant="secondary"
                      size="sm"
                      disabled={busy}
                      onClick={() => applyPreset(preset.from, preset.to)}
                    >
                      {preset.label}
                    </Button>
                  ))}
                </div>
              )}

              {savedPlaces.length > 0 && (
                <ul className="grid gap-3">
                  {savedPlaces.map((place) => (
                    <li key={place.id} className="grid gap-2 rounded-lg bg-surface-raised p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <Input
                            aria-label={`Label for ${place.name}`}
                            value={place.label}
                            onChange={(event) =>
                              onPlacesChange(
                                upsertPlace(savedPlaces, { ...place, label: event.target.value }),
                              )
                            }
                            className="h-9 bg-background/60 font-semibold"
                          />
                          <p className="mt-1 truncate text-xs text-muted-foreground">
                            {place.name}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Remove ${place.label}`}
                          onClick={() => onPlacesChange(removePlace(savedPlaces, place.id))}
                        >
                          <X className="size-4" />
                        </Button>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Label
                          htmlFor={`arrive-${place.id}`}
                          className="text-xs text-muted-foreground"
                        >
                          Typical arrival
                        </Label>
                        <Input
                          id={`arrive-${place.id}`}
                          type="time"
                          value={clockInputValue(place.typicalArrivalSeconds)}
                          onChange={(event) =>
                            onPlacesChange(
                              upsertPlace(savedPlaces, {
                                ...place,
                                typicalArrivalSeconds: parseClockInput(event.target.value),
                              }),
                            )
                          }
                          className="h-9 w-32 bg-background/60 tabular-nums"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={busy}
                          onClick={() => applyOrigin(place)}
                        >
                          Start here
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={busy}
                          onClick={() => selectPlace(place)}
                        >
                          Go here
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
                <Select value={saveKind} onValueChange={(value) => setSaveKind(value as PlaceKind)}>
                  <SelectTrigger className="h-10 w-32 bg-surface-raised">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PLACE_KINDS.map((kind) => (
                      <SelectItem key={kind} value={kind}>
                        {kind === "custom" ? "Custom" : kindLabel(kind)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="time"
                  aria-label="Typical arrival time for the place you are saving"
                  value={saveTime}
                  onChange={(event) => setSaveTime(event.target.value)}
                  className="h-10 w-32 bg-surface-raised tabular-nums"
                />
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!originPoint}
                  onClick={() =>
                    originPoint && savePlace(saveKind, originPoint, parseClockInput(saveTime))
                  }
                >
                  Save start
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!destinationPoint}
                  onClick={() =>
                    destinationPoint &&
                    savePlace(saveKind, destinationPoint, parseClockInput(saveTime))
                  }
                >
                  Save destination
                </Button>
              </div>
            </section>
          )}

          {!firstRun && <AlertPrefsSection prefs={alertPrefs} onChange={onAlertPrefsChange} />}

          {!firstRun && <NotificationsSection />}

          {!firstRun && <PrivacySection />}

          {!firstRun && <AccountSection />}

          {!firstRun && <AboutSection />}

          {status && <p className="text-sm text-muted-foreground">{status}</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}

const DATA_SOURCES = [
  {
    label: "Transit schedules: TheBus / Oahu Transit Services (thebus.org)",
    href: "https://www.thebus.org",
  },
  { label: "Live bus arrivals: TheBus HEA API", href: "https://hea.thebus.org" },
  { label: "Traffic and drive times: TomTom (tomtom.com)", href: "https://www.tomtom.com" },
  {
    label: "Weather: National Weather Service / NOAA (weather.gov)",
    href: "https://www.weather.gov",
  },
  { label: "Air quality: AirNow / US EPA (airnow.gov)", href: "https://www.airnow.gov" },
];

function AboutSection() {
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  return (
    <div className="border-t border-border pt-8">
      <div className="flex flex-col items-center pb-7 text-center">
        <WaveMark className="nalu-honu h-16 w-24" />
        <p className="nalu-brand-title mt-3 text-2xl font-bold tracking-wide">Nalu</p>
        <p className="mt-1 text-xs text-muted-foreground">version 1.0</p>
        <p className="mt-2 text-sm italic text-muted-foreground">
          Hawaiian for wave, and to think deeply.
        </p>
      </div>
      <div className="h-px bg-border/60" />

      <p className="mt-6 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        What is Nalu
      </p>
      <div className="mt-2 grid gap-2 text-sm leading-relaxed text-muted-foreground">
        <p>
          Nalu helps Oahu commuters decide whether to take Skyline rail or drive, using real-time
          traffic and live bus schedules.
        </p>
        <p>Built for Oahu. Transit data covers TheBus and Skyline rail.</p>
        <Link
          to="/oahu-commute"
          className="mt-2 inline-block text-sm font-semibold text-foreground underline-offset-4 hover:underline"
        >
          Oʻahu commute guide
        </Link>
        <Link
          to="/welcome"
          className="mt-4 inline-flex min-h-10 w-full items-center justify-center rounded-xl border border-border bg-background/40 px-4 text-sm font-semibold text-foreground transition-colors hover:bg-accent"
        >
          View Welcome page
        </Link>
      </div>
      <div className="mt-6 h-px bg-border/60" />

      <p className="mt-6 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        Data sources
      </p>
      <ul className="mt-1">
        {DATA_SOURCES.map((source) => (
          <li key={source.href} className="border-b border-border/50 last:border-b-0">
            <a
              href={source.href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between gap-3 py-2.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <span>{source.label}</span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground/60" />
            </a>
          </li>
        ))}
      </ul>
      <div className="mt-6 h-px bg-border/60" />

      <p className="mt-6 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        Privacy
      </p>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        Guest trips stay on this device. If you choose to sign in, your profile, saved places, and
        preferences are stored privately so they can sync across your devices. Feedback you submit
        is sent directly to the Nalu team and not shared.
      </p>
      <div className="mt-6 h-px bg-border/60" />

      <p className="mt-6 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        Contact
      </p>
      <a
        href="mailto:HelloNalu14@gmail.com"
        className="mt-2 inline-block text-sm text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline"
      >
        HelloNalu14@gmail.com
      </a>
      <Button
        type="button"
        variant="outline"
        className="mt-3 w-full shadow-none"
        onClick={() => {
          setFeedbackOpen(true);
        }}
      >
        Send feedback
      </Button>
      <FeedbackForm open={feedbackOpen} onOpenChange={setFeedbackOpen} />
    </div>
  );
}

const FEEDBACK_ENDPOINT = "https://formspree.io/f/mppwqpaz";

function FeedbackForm({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { user } = useAuth();
  const [message, setMessage] = useState("");
  const [component, setComponent] = useState("");
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [failed, setFailed] = useState(false);

  const signedInName = profileFirstName(user);
  const signedInEmail = typeof user?.email === "string" ? user.email : "";

  useEffect(() => {
    if (open) {
      setSent(false);
      setFailed(false);
      // Pre-fill from the signed-in account so riders never retype.
      setEmail((current) => current || signedInEmail);
    }
  }, [open, signedInEmail]);

  async function submit() {
    if (!message.trim() || sending) return;
    setSending(true);
    setFailed(false);
    try {
      const response = await fetch(FEEDBACK_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          message: message.trim(),
          component,
          name: signedInName || undefined,
          email: email.trim() || undefined,
        }),
      });
      if (!response.ok) throw new Error(`status ${response.status}`);
      setSent(true);
      setMessage("");
      setComponent("");
      setEmail("");
    } catch {
      setFailed(true);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className={open ? "mt-3" : ""}>
      {open && (
        <div className="grid gap-3 rounded-lg bg-surface-raised p-4">
          <div className="grid gap-1.5">
            <Label htmlFor="feedback-message">What happened?</Label>
            <Textarea
              id="feedback-message"
              rows={4}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="feedback-component">Which part of the app?</Label>
            <Select value={component} onValueChange={setComponent}>
              <SelectTrigger id="feedback-component" className="bg-background">
                <SelectValue placeholder="Choose one" />
              </SelectTrigger>
              <SelectContent>
                {["Browse mode", "Trip setup", "Verdict", "Departures", "Weather", "Other"].map(
                  (part) => (
                    <SelectItem key={part} value={part}>
                      {part}
                    </SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="feedback-email">Your email (optional)</Label>
            <Input
              id="feedback-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="text-xs text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline"
            >
              Cancel
            </button>
            <Button
              size="sm"
              onClick={submit}
              disabled={!message.trim() || sending}
              className="shadow-none"
            >
              {sending ? "Sending…" : "Submit"}
            </Button>
          </div>
          {sent && <p className="text-xs text-muted-foreground">Thanks, we read everything.</p>}
          {failed && (
            <p className="text-xs text-muted-foreground">
              Couldn't send · try HelloNalu14@gmail.com
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/** Inline map card normally; an edge-to-edge navigation screen during a live trip. */
function NavShell({
  fullscreen,
  overlay,
  children,
}: {
  fullscreen: boolean;
  overlay: ReactNode;
  children: ReactNode;
}) {
  if (!fullscreen || typeof document === "undefined") {
    return <div className="h-72 border-t border-border sm:h-80">{children}</div>;
  }
  return createPortal(
    <div className="fixed inset-0 z-50 bg-background" role="dialog" aria-label="Live navigation">
      <div className="h-full w-full">{children}</div>
      {overlay}
    </div>,
    document.body,
  );
}

/** Hold for 1 s to end, so a bump on the freeway can't cancel navigation. */
function HoldToEndButton({
  onEnd,
  label,
  className,
}: {
  onEnd: () => void;
  label: string;
  className?: string;
}) {
  const [holding, setHolding] = useState(false);
  const timer = useRef<number | null>(null);
  const start = () => {
    if (timer.current !== null) return;
    setHolding(true);
    timer.current = window.setTimeout(() => {
      timer.current = null;
      setHolding(false);
      if ("vibrate" in navigator) navigator.vibrate?.(40);
      onEnd();
    }, 1000);
  };
  const cancel = () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
    setHolding(false);
  };
  useEffect(() => cancel, []);
  return (
    <Button
      type="button"
      variant="destructive"
      aria-label={`Hold to ${label.toLowerCase()}`}
      onPointerDown={start}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
      onContextMenu={(e) => e.preventDefault()}
      onKeyDown={(e) => {
        if ((e.key === "Enter" || e.key === " ") && !e.repeat) {
          e.preventDefault();
          start();
        }
      }}
      onKeyUp={cancel}
      className={`relative touch-none select-none overflow-hidden font-black uppercase ${className ?? ""}`}
    >
      <span
        aria-hidden="true"
        className="absolute inset-y-0 left-0 bg-foreground/25"
        style={{
          width: holding ? "100%" : "0%",
          transition: holding ? "width 1s linear" : "width 150ms ease-out",
        }}
      />
      <span className="relative flex items-center gap-2">
        <X className="size-4" /> {holding ? "Keep holding…" : `Hold to ${label}`}
      </span>
    </Button>
  );
}

function NavBottomCard({
  mode,
  delayMinutes,
  steps,
  onEnd,
}: {
  mode: "drive" | "rail";
  delayMinutes: number | null;
  steps: string[];
  onEnd: () => void;
}) {
  const [open, setOpen] = useState(false);
  const traffic =
    mode === "rail"
      ? "Transit live"
      : delayMinutes === null
        ? "Checking traffic"
        : delayMinutes >= 5
          ? `Heavy · +${Math.round(delayMinutes)} min`
          : delayMinutes >= 2
            ? `Moderate · +${Math.round(delayMinutes)} min`
            : "Traffic clear";
  return (
    <div className="pointer-events-none absolute inset-x-2 bottom-[max(0.5rem,env(safe-area-inset-bottom))] z-20 max-lg:landscape:left-auto max-lg:landscape:w-80">
      <div className="nav-hud pointer-events-auto rounded-2xl p-3">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="flex min-w-0 items-center gap-2 text-left"
          >
            <span className="truncate rounded-full bg-muted px-3 py-1 text-xs font-black uppercase text-foreground">
              {traffic}
            </span>
            <span className="shrink-0 text-xs font-bold text-muted-foreground">
              {open ? "Hide route" : "Route details"}
            </span>
          </button>
          <HoldToEndButton onEnd={onEnd} label="End" className="h-11 shrink-0 px-5" />
        </div>
        {open && (
          <ol className="mt-3 max-h-[40dvh] space-y-2 overflow-y-auto overscroll-contain text-sm text-foreground">
            {steps.length ? (
              steps.map((step, i) => (
                <li key={`${i}-${step}`} className="flex gap-2">
                  <span className="w-5 shrink-0 text-right font-bold tabular-nums text-muted-foreground">
                    {i + 1}
                  </span>
                  <span className="min-w-0">{step}</span>
                </li>
              ))
            ) : (
              <li className="text-muted-foreground">
                Route steps will appear once the route loads.
              </li>
            )}
          </ol>
        )}
      </div>
    </div>
  );
}
