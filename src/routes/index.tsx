import { ClientOnly, createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BriefcaseBusiness, Bus, Car, Check, ChevronDown, ChevronRight, Footprints, House, LocateFixed, RefreshCw, Search, Settings, TrainFront, UserRound, X } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { reverseGeocode, searchPlaces, type PlaceSuggestion } from "@/lib/geocode.functions";
import { RouteCorridor } from "@/components/commute/RouteCorridor";
import { driveTime, type DriveTime } from "@/lib/drive.functions";
import { busArrivals, type BusArrival, type BusArrivalsResult } from "@/lib/bus-arrivals.functions";
import { outdoorConditions, type MomentConditions } from "@/lib/weather.functions";
import { incidentText, trafficDelayText } from "@/lib/traffic-incidents";
import {
  ALERT_PREFS_KEY,
  defaultAlertPrefs,
  evaluateApproach,
  parseAlertPrefs,
  playChime,
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
import {
  compareArriveBy,
  driveArriveBy,
  latestRailArrival,
} from "@/lib/leave-by";
import { honoluluSecondsToIso } from "@/lib/drive/planner";
import { compareCommute } from "@/lib/decision/commute-decision";
import { ArriveByControls, type PlanMode } from "@/components/commute/ArriveByControls";
import { VerdictCard } from "@/components/commute/VerdictCard";
import { FareNotice, LandmarkHint } from "@/components/commute/TransitNotices";
import { AccountSection } from "@/components/account/AccountSection";
import { SignInBanner } from "@/components/account/SignInBanner";
import { useAuth } from "@/hooks/use-auth";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

const NearbyTransitMap = lazy(() => import("@/components/NearbyTransitMap"));
const CommuteRouteMap = lazy(() => import("@/components/commute/CommuteRouteMap"));
const WalkingMicroMap = lazy(() => import("@/components/commute/WalkingMicroMap"));

function WaveMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 30 20" fill="none" className={className} aria-hidden="true">
      <path
        d="M2 12C6 4.2 11 4.2 15 11C19 17.8 24 17.8 28 11"
        stroke="currentColor"
        strokeWidth="3.4"
        strokeLinecap="round"
      />
    </svg>
  );
}



export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Nalu" },
      {
        name: "description",
        content: "Rail or drive? Nalu gives Oahu commuters a real-time answer every morning.",
      },
      { property: "og:title", content: "Nalu" },
      {
        property: "og:description",
        content: "Rail or drive? Nalu gives Oahu commuters a real-time answer every morning.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
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
  from_stop_id?: string | null;
  to_stop_id?: string | null;
  depart_seconds: number | null;
  arrive_seconds: number | null;
  minutes: number | null;
};


/** Anything with a name and a point: a suggestion, a saved place, or a draft. */
type PointLike = { name: string; address: string; lat: number; lon: number };

type BusStopTarget = {
  stopId: string;
  scheduled: Array<{ routeShortName: string | null; headsign: string | null; scheduledSeconds: number }>;
};

type Option = {
  leave_by_seconds: number;
  depart_seconds: number;
  arrive_seconds: number;
  total_minutes: number;
  legs: Leg[];
};

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

const LEGACY_STORAGE_PREFIX = ["ki", "ne"].join("");

type DirectionOverride = { inbound: boolean; at: number };
/** Where the car is today: at home, left at the station, or driven all the way. */
type CarPlace = "home" | "station" | "destination";
type ParkedCar = { date: string; station: string; place?: CarPlace };
type BrowseStation = { stopId: string; stopName: string; lat: number; lon: number; userLat?: number; userLon?: number };
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
      return `Rain during your ${moment.minutes ?? 0} min transfer walk`;
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
    return { text: `Hot and humid · feels like ${feels}°F · limit time outdoors`, tone: "heat", source: "NWS" };
  }
  if (hot) {
    const where =
      moment.kind === "wait-feeder" ? "Hot at bus stop" : moment.kind === "platform" ? "Hot on the platform" : "Hot";
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
    return { text: "Air quality: Moderate · sensitive groups limit outdoor time", tone: "rain", source: "AirNow / EPA" };
  }
  if (category === 3) {
    return { text: "Air quality: Poor · limit outdoor exposure if sensitive", tone: "air", source: "AirNow / EPA" };
  }
  if (category >= 4) {
    return { text: "Air quality: Unhealthy · minimize time outdoors", tone: "air", source: "AirNow / EPA" };
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
  const mid = (a.lat + b.lat) / 2 * toRad;
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

function alohaGreeting(date: Date, name?: string) {
  const hour = honoluluParts(date).hour;
  const greeting = hour >= 4 && hour < 12
    ? "Aloha kakahiaka"
    : hour >= 12 && hour < 17
      ? "Aloha ʻauinalā"
      : "Aloha ahiahi";
  return name ? `${greeting}, ${name}` : greeting;
}

/** First name from the signed-in profile: full name, then given name, then username. */
function profileFirstName(user: { user_metadata?: Record<string, unknown>; email?: string | null } | null) {
  const meta = user?.user_metadata ?? {};
  const fullName = typeof meta["full_name"] === "string" ? meta["full_name"].trim() : "";
  if (fullName) return fullName.split(/\s+/)[0];
  const given = typeof meta["given_name"] === "string" ? meta["given_name"].trim() : "";
  if (given) return given;
  const username = typeof meta["preferred_username"] === "string" ? meta["preferred_username"].trim() : "";
  if (username) return username.split(/[.@]/)[0];
  const email = typeof user?.email === "string" ? user.email : "";
  if (email) return email.split("@")[0];
  return undefined;
}

function honoluluIsoDow(date: Date) {
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: "Pacific/Honolulu", weekday: "short" }).format(date);
  const order = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  return order.indexOf(weekday) + 1;
}

function honoluluDateKey(date: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Pacific/Honolulu", dateStyle: "short" }).format(date);
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
    .replace(/(^|[\s\-/&(.])([a-z\u02bb\u2018'])/g, (_match, lead: string, letter: string) => lead + letter.toUpperCase())
    .replace(/([\u02bb\u2018'])([A-Z])/g, (_match, mark: string, letter: string) => mark + letter.toLowerCase());
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
  const expanded = expandName(value).replace(/\s*\bSkyline\b\s*(Station)?\s*$/i, "").replace(/\s*\bStation\b\s*$/i, "");
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
  if (miles < 0.1) return `${Math.round(meters * 3.28084 / 10) * 10} ft`;
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
  const route = stop.routeType === 1 ? "Skyline" : arrival.route_short_name?.trim() || arrival.route_long_name?.trim() || "Bus";
  const destination = arrival.headsign ? (stop.routeType === 1 ? stationLabel(arrival.headsign) : titleCase(arrival.headsign)) : "";
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

function trafficStatus(delayMinutes: number) {
  const delay = Math.max(0, Math.round(delayMinutes));
  if (delay === 0) return { label: "Clear", className: "text-primary" };
  if (delay > 20) return { label: `${delay} min slower than usual`, className: "text-destructive" };
  if (delay >= 10) return { label: `${delay} min slower than usual`, className: "text-chart-4" };
  return { label: `${delay} min slower than usual`, className: "text-foreground" };
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
              <span className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">Checking traffic…</span>
            ) : unavailable ? (
              <span className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">Unavailable</span>
            ) : rows.map(({ label, data }) => {
              const status = data ? trafficStatus(data.delayMinutes) : null;
              return (
                <span key={label} className={`rounded-full bg-background px-2.5 py-1 text-xs font-semibold ${status?.className ?? "text-muted-foreground"}`}>
                  {label} · {status?.label ?? "—"}
                </span>
              );
            })}
          </span>
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
        </summary>
        {!loading && !unavailable && eastbound && westbound && (
          <div className="border-t border-border px-4 pb-4">
            {rows.map(({ label, data }) => {
              const incident = data?.incidents[0];
              return incident ? (
                <p key={label} className="mt-3 text-sm text-foreground">
                  <span className="font-semibold">{label}:</span> {incidentText(incident)}
                  {incident.delayMinutes ? ` · +${incident.delayMinutes} min` : ""}
                </p>
              ) : null;
            })}
            <p className="mt-3 text-[10px] text-muted-foreground">Traffic: TomTom</p>
          </div>
        )}
      </details>
    );
  }
  return (
    <section className="verdict-lift mt-7 rounded-lg border border-border p-5" aria-labelledby="h1-conditions-title">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="h1-conditions-title" className="text-lg font-semibold">H-1 conditions</h2>
        <span className="shrink-0 text-[10px] text-muted-foreground">TomTom</span>
      </div>
      {loading && <p className="mt-4 text-sm text-muted-foreground">Checking live traffic…</p>}
      {unavailable && <p className="mt-4 text-sm text-muted-foreground">Traffic data unavailable</p>}
      {!loading && !unavailable && eastbound && westbound && (
        <div className="mt-3 divide-y divide-border">
          {[
            { label: "H-1 Eastbound (toward town)", data: eastbound },
            { label: "H-1 Westbound (toward Kapolei)", data: westbound },
          ].map((item) => {
            const status = trafficStatus(item.data.delayMinutes);
            const incident = item.data.incidents[0];
            return (
              <div key={item.label} className="py-3">
                <div className="flex min-h-8 items-center justify-between gap-4">
                  <span className="text-sm text-foreground">{item.label}</span>
                  <span className={`shrink-0 text-right text-sm font-semibold tabular-nums ${status.className}`}>{status.label}</span>
                </div>
                {incident && (
                  <p className="mt-2 rounded-lg bg-surface-raised px-3 py-2 text-xs text-muted-foreground">
                    {incidentText(incident)}
                    {incident.delayMinutes ? ` · +${incident.delayMinutes} min` : ""}
                  </p>
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

function Index() {
  const { user } = useAuth();
  const [now, setNow] = useState(() => new Date());
  const [hydrated, setHydrated] = useState(false);
  const [setup, setSetup] = useState<Setup>(emptySetup);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [override, setOverride] = useState<DirectionOverride | null>(null);
  const [parked, setParked] = useState<ParkedCar | null>(null);
  const [browseStation, setBrowseStation] = useState<BrowseStation | null>(null);
  const [selectedNearbyStopId, setSelectedNearbyStopId] = useState<string | null>(null);
  const [browseLocationDenied, setBrowseLocationDenied] = useState(false);
  const [locationDenied, setLocationDenied] = useState(false);
  const [selectedMode, setSelectedMode] = useState<"rail" | "drive">("rail");
  const [savedPlaces, setSavedPlaces] = useState<SavedPlace[]>([]);
  const [planMode, setPlanMode] = useState<PlanMode>("leave-now");
  const [arriveByInput, setArriveByInput] = useState("");
  const [alertPrefs, setAlertPrefs] = useState<AlertPrefs>(defaultAlertPrefs);
  const syncedUserRef = useRef<string | null>(null);

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
    if (migratedPlaces.length) window.localStorage.setItem(SAVED_PLACES_KEY, JSON.stringify(migratedPlaces));
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
    void (async () => {
      const { data } = await supabase.from("user_preferences").select("saved_places,preferences,last_setup").eq("user_id", user.id).maybeSingle();
      if (cancelled) return;
      const remotePlaces = Array.isArray(data?.saved_places) ? (data.saved_places as unknown as SavedPlace[]) : [];
      const merged = new Map<string, SavedPlace>();
      for (const place of [...remotePlaces, ...savedPlaces]) {
        const current = merged.get(place.id);
        if (!current || place.updatedAt >= current.updatedAt) merged.set(place.id, place);
      }
      const nextPlaces = Array.from(merged.values());
      if (nextPlaces.length) persistPlaces(nextPlaces);
      if (!window.localStorage.getItem(STORAGE_KEY) && data?.last_setup && typeof data.last_setup === "object") {
        const restored = { ...emptySetup, ...(data.last_setup as Partial<Setup>) };
        persist(restored);
      }
      const preferences = data?.preferences && typeof data.preferences === "object" && !Array.isArray(data.preferences)
        ? data.preferences as Record<string, unknown>
        : {};
      if (!window.localStorage.getItem(ALERT_PREFS_KEY) && preferences["alertPrefs"]) {
        const restored = parseAlertPrefs(JSON.stringify(preferences["alertPrefs"]));
        saveAlertPrefs(restored);
      }
      const displayName = typeof user.user_metadata?.["full_name"] === "string" ? user.user_metadata["full_name"] : null;
      const avatarUrl = typeof user.user_metadata?.["avatar_url"] === "string" ? user.user_metadata["avatar_url"] : null;
      await Promise.all([
        supabase.from("profiles").upsert({ id: user.id, display_name: displayName, avatar_url: avatarUrl, updated_at: new Date().toISOString() }),
        supabase.from("user_preferences").upsert({
          user_id: user.id,
          saved_places: nextPlaces,
          preferences: { alertPrefs, planMode, arriveByInput },
          last_setup: window.localStorage.getItem(STORAGE_KEY) ? setup : data?.last_setup ?? null,
          updated_at: new Date().toISOString(),
        }),
      ]);
      if (!cancelled) syncedUserRef.current = user.id;
    })();
    return () => { cancelled = true; };
  }, [hydrated, user?.id]);

  useEffect(() => {
    if (!user) syncedUserRef.current = null;
  }, [user]);

  useEffect(() => {
    if (!user || syncedUserRef.current !== user.id) return;
    const timer = window.setTimeout(() => {
      void supabase.from("user_preferences").upsert({
        user_id: user.id,
        saved_places: savedPlaces,
        preferences: { alertPrefs, planMode, arriveByInput },
        last_setup: configured ? setup : null,
        updated_at: new Date().toISOString(),
      });
    }, 500);
    return () => window.clearTimeout(timer);
  }, [user?.id, savedPlaces, alertPrefs, planMode, arriveByInput, setup]);

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
    navigator.permissions?.query({ name: "geolocation" as PermissionName }).then((result) => {
      if (cancelled) return;
      status = result;
      status.onchange = sync;
      sync();
    }).catch(() => {});
    return () => {
      cancelled = true;
      if (status) status.onchange = null;
    };
  }, []);

  function recordLocationDenied() {
    setLocationDenied(true);
    window.localStorage.setItem(LOCATION_DENIED_KEY, "1");
  }

  // Direction is explicit. Time of day can inform the first suggestion, but it
  // must never silently reverse a saved commute for shift or weekend riders.
  const overrideActive = Boolean(override && now.getTime() - override.at < OVERRIDE_MS);
  const inbound = overrideActive ? Boolean(override?.inbound) : false;

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

  // "End trip" clears the saved commute and its overrides, returning to browse
  // mode where departures stay visible and a new trip can be set up anytime.
  function endTrip() {
    setSetup(emptySetup);
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
  }

  const timeText = useMemo(
    () =>
      new Intl.DateTimeFormat("en-US", {
        timeZone: "Pacific/Honolulu",
        weekday: "long",
        hour: "numeric",
        minute: "2-digit",
      }).format(now),
    [now],
  );

  const configured = hasValidCoordinates({ lat: setup.homeLat, lon: setup.homeLon })
    && hasValidCoordinates({ lat: setup.destLat, lon: setup.destLon });
  const railConfigured = configured && Boolean(setup.homeStopId && setup.destStopId);
  const browseActive = hydrated && !configured;
  const nowSeconds = honoluluSeconds(now);
  const afterSeconds = Math.floor(nowSeconds / 60) * 60;
  // Where today's car is. With station driving enabled, an unrecorded return
  // starts with the car at the home station; an explicit same-day location wins.
  const parkedToday = parked && parked.date === honoluluDateKey(now) ? parked : null;
  const carPlace: CarPlace = parkedToday?.place ?? (inbound && setup.allowDrive ? "station" : "home");
  const carAtStation = Boolean(
    setup.allowDrive
      && carPlace === "station"
      && (!parkedToday || parkedToday.station === setup.homeStopId),
  );
  // Door-to-door driving is always compared. "I can drive to the station" only
  // governs the park-and-ride first leg; it never removes the drive option.
  // The only genuine blocker is a car recorded today somewhere else.
  const driveAvailable = parkedToday
    ? inbound
      ? parkedToday.place === "destination"
      : parkedToday.place === "home"
    : true;
  // Only an explicitly recorded car location explains a missing drive option.
  const carAwayReason = driveAvailable
    ? null
    : inbound && carPlace === "station"
      ? `Your car is parked at ${
          parkedToday && parkedToday.station !== setup.homeStopId
            ? "your station"
            : `${stationLabel(setup.homeStopName)} Station`
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
    const entry: ParkedCar = { date: honoluluDateKey(new Date()), station: setup.homeStopId, place };
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
        supabase.rpc("directional_dest_stop", { p_lat: setup.destLat!, p_lon: setup.destLon!, p_toward_rail: false }),
        supabase.rpc("directional_dest_stop", { p_lat: setup.destLat!, p_lon: setup.destLon!, p_toward_rail: true }),
      ]);
      const out = arriving.data?.[0];
      const back = boarding.data?.[0];
      if (cancelled || !back) return;
      setSetup((current) => ({
        ...current,
        destStopId: out?.stop_id ?? current.destStopId,
        destStopName: out?.stop_name ?? current.destStopName,
        destStopWalkM: out ? Number(out.distance_m) : current.destStopWalkM,
        destReturnStopId: back.stop_id,
        destReturnStopName: back.stop_name ?? "",
        destReturnWalkM: Number(back.distance_m),
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
        const { data, error } = await supabase.rpc("nearest_stop", { p_lat: lat, p_lon: lon, p_rail_only: true });
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

  const { data: browseStations = [] } = useRailStations(hydrated);


  // If location is unavailable, derive the west-side default from live station
  // coordinates rather than pinning a station name or id into the app.
  useEffect(() => {
    if (!browseActive || !browseLocationDenied || browseStation || browseStations.length === 0) return;
    const nearest = browseStations
      .filter((station) => station.stop_lat !== null && station.stop_lon !== null)
      .map((station) => ({
        station,
        distance: distanceM(KAPOLEI_POINT, { lat: Number(station.stop_lat), lon: Number(station.stop_lon) }),
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
    refetch: refetchBrowseDepartures,
  } = useQuery({
    queryKey: ["browse-departures", browseStation?.stopId, Math.floor(afterSeconds / 60)],
    enabled: browseActive && Boolean(browseStation?.stopId),
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("rail_departures", {
        p_home_stop: browseStation?.stopId as string,
        p_after_seconds: afterSeconds,
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

  const { data: nearbyStops = [], isLoading: nearbyStopsLoading } = useQuery({
    queryKey: ["nearby-transit-stops", browseUserPoint?.lat.toFixed(5), browseUserPoint?.lon.toFixed(5), Math.floor(afterSeconds / 60)],
    enabled: browseActive && Boolean(browseUserPoint),
    staleTime: 30_000,
    refetchInterval: 60_000,
    queryFn: async () => {
      const point = browseUserPoint as Coords;
      const { data, error } = await supabase.rpc("nearby_transit_stops", {
        p_lat: point.lat,
        p_lon: point.lon,
        p_after_seconds: afterSeconds,
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
    if (!selectedNearbyStopId || !nearbyStops.some((stop) => stop.stopId === selectedNearbyStopId)) {
      setSelectedNearbyStopId(nearbyStops[0]?.stopId ?? null);
    }
  }, [nearbyStops, selectedNearbyStopId]);

  const selectedNearbyStop = nearbyStops.find((stop) => stop.stopId === selectedNearbyStopId) ?? nearbyStops[0] ?? null;


  const { data: options = [], isLoading: optionsLoading } = useQuery({
    queryKey: [
      "trip",
      inbound ? "inbound" : "outbound",
      setup.homeStopId,
      setup.destStopId,
      setup.allowDrive,
      carAtStation,
      driveAvailable,
      Math.floor(afterSeconds / 60),
      planMode,
    ],
    enabled: hydrated && railConfigured,
    staleTime: 60_000,
    queryFn: async () => {
      if (inbound) {
        const { data, error } = await supabase.rpc("plan_inbound", {
          p_dest_lat: setup.destLat as number,
          p_dest_lon: setup.destLon as number,
          p_station: setup.homeStopId,
          p_home_lat: setup.homeLat as number,
          p_home_lon: setup.homeLon as number,
          p_allow_drive: carAtStation,
          p_after_seconds: afterSeconds,
          p_limit: planMode === "arrive-by" ? 12 : 4,
        });
        if (error) throw error;
        return (data ?? []).map((row) => ({ ...row, legs: row.legs as unknown as Leg[] })) as Option[];
      }
      const { data, error } = await supabase.rpc("plan_outbound", {
        p_origin_lat: setup.homeLat as number,
        p_origin_lon: setup.homeLon as number,
        p_station: setup.homeStopId,
        p_dest_stop: setup.destStopId,
        p_allow_drive: driveAvailable,
        p_after_seconds: afterSeconds,
        p_limit: planMode === "arrive-by" ? 12 : 4,
        // Any stop within a quarter mile of the door is fair game, walk included.
        p_dest_lat: setup.destLat as number,
        p_dest_lon: setup.destLon as number,
      });
      if (error) throw error;
      return (data ?? []).map((row) => ({ ...row, legs: row.legs as unknown as Leg[] })) as Option[];
    },
  });

  // Options arrive in earliest-door-arrival order. A slightly later trip is
  // available by choice, but is never silently preferred.
  const earliest = options[0];
  const [selectedDeparture, setSelectedDeparture] = useState<number | null>(null);
  useEffect(() => {
    setSelectedDeparture(null);
  }, [inbound, earliest?.leave_by_seconds, earliest?.arrive_seconds]);
  const best = options.find((option) => option.leave_by_seconds === selectedDeparture) ?? earliest;

  const stationCoords = browseStations;
  /* One authoritative rail-station query serves browse, setup, maps and planning. */
  function stationPoint(name: string | null | undefined): Coords | null {
    if (!name) return null;
    const wanted = name.trim().toLowerCase();
    const hit = stationCoords.find((station) => (station.stop_name ?? "").trim().toLowerCase() === wanted);
    if (!hit || hit.stop_lat === null || hit.stop_lon === null) return null;
    return { lat: Number(hit.stop_lat), lon: Number(hit.stop_lon) };
  }

  const itineraryStopNames = useMemo(
    () => Array.from(new Set((best?.legs ?? []).flatMap((leg) => [leg.from, leg.to]).filter((name): name is string => Boolean(name)))),
    [best],
  );
  const { data: itineraryStopCoords = [] } = useQuery({
    queryKey: ["itinerary-stop-coords", itineraryStopNames],
    enabled: configured && itineraryStopNames.length > 0,
    staleTime: 6 * 60 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stops")
        .select("stop_id,stop_name,stop_lat,stop_lon")
        .in("stop_name", itineraryStopNames);
      if (error) throw error;
      return data ?? [];
    },
  });

  const plannedBusLeg = best?.legs.find((leg) => leg.mode === "bus" && leg.kind === "connect")
    ?? best?.legs.find((leg) => leg.mode === "bus")
    ?? null;
  const busStopName = plannedBusLeg?.from;
  const { data: activeBusStopId = null } = useQuery({
    queryKey: ["active-bus-stop", busStopName],
    enabled: Boolean(busStopName),
    staleTime: 3 * 60 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("stops").select("stop_id").eq("stop_name", busStopName as string).limit(1);
      if (error) throw error;
      return data?.[0]?.stop_id ?? null;
    },
  });
  const busTarget: BusStopTarget | null = activeBusStopId ? {
    stopId: activeBusStopId,
    scheduled: plannedBusLeg?.depart_seconds ? [{
        routeShortName: plannedBusLeg.route_short,
        headsign: plannedBusLeg.headsign,
        scheduledSeconds: plannedBusLeg.depart_seconds,
      }] : [],
  } : null;
  const fetchBusArrivals = useServerFn(busArrivals);
  const { data: liveBus, isFetching: liveBusRefreshing } = useQuery({
    queryKey: ["hea-arrivals", busTarget?.stopId, busTarget?.scheduled],
    enabled: Boolean(busTarget),
    staleTime: 30_000,
    refetchInterval: 30_000,
    retry: false,
    queryFn: () => fetchBusArrivals({ data: busTarget as BusStopTarget }),
  });

  // --- Automatic "approaching your stop" tracking -------------------------
  // No button: whenever the current plan has a transit leg underway, follow it
  // with GPS when granted and fall back to the timetable when it is not.
  const activeTransitLeg = useMemo(() => {
    if (!best) return null;
    return (
      best.legs.find(
        (leg) =>
          (leg.mode === "bus" || leg.mode === "rail")
          && leg.depart_seconds !== null
          && leg.arrive_seconds !== null
          && nowSeconds >= leg.depart_seconds - 60
          && nowSeconds <= leg.arrive_seconds + 60,
      ) ?? null
    );
  }, [best, nowSeconds]);

  const { data: legStops = [] } = useQuery({
    queryKey: [
      "leg-stop-sequence",
      activeTransitLeg?.from,
      activeTransitLeg?.to,
      activeTransitLeg?.depart_seconds,
      activeTransitLeg?.route_short,
      activeTransitLeg?.mode,
    ],
    enabled: Boolean(activeTransitLeg?.from && activeTransitLeg?.to && activeTransitLeg?.depart_seconds !== null),
    staleTime: 30 * 60_000,
    queryFn: async () => {
      const leg = activeTransitLeg as Leg;
      const { data, error } = await supabase.rpc("leg_stop_sequence", {
        p_from_name: leg.from as string,
        p_to_name: leg.to as string,
        p_depart_seconds: leg.depart_seconds as number,
        ...(leg.mode === "bus" && leg.route_short ? { p_route_short: leg.route_short } : {}),
        p_rail: leg.mode === "rail",
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
  const distanceTrend = useRef<number[]>([]);
  useEffect(() => {
    if (!activeTransitLeg || !navigator.geolocation) {
      setRiderPoint(null);
      return;
    }
    const watch = navigator.geolocation.watchPosition(
      (position) => setRiderPoint({ lat: position.coords.latitude, lon: position.coords.longitude }),
      (error) => {
        setRiderPoint(null);
        if (isPermissionDeniedError(error)) recordLocationDenied();
      },
      { enableHighAccuracy: true, maximumAge: 15_000, timeout: 20_000 },
    );
    return () => navigator.geolocation.clearWatch(watch);
  }, [activeTransitLeg]);

  // Legs change: start the distance history over so an old ride cannot trigger
  // a "passed your stop" notice on the next one.
  const legKey = activeTransitLeg ? `${activeTransitLeg.from}-${activeTransitLeg.depart_seconds}` : null;
  useEffect(() => {
    distanceTrend.current = [];
  }, [legKey]);

  const alightPoint = useMemo(() => {
    const alight = legStops.find((stop) => stop.isAlight) ?? legStops[legStops.length - 1];
    return alight && alight.lat !== null && alight.lon !== null ? { lat: alight.lat, lon: alight.lon } : null;
  }, [legStops]);
  if (riderPoint && alightPoint) {
    const distance = distanceM(riderPoint, alightPoint);
    const trend = distanceTrend.current;
    if (trend[trend.length - 1] !== distance) {
      distanceTrend.current = [...trend, distance].slice(-4);
    }
  }

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
    if (!approach || approach.state !== "urgent") return;
    const pulseKey = `${approach.key}-urgent`;
    if (lastPulse.current === pulseKey) return;
    lastPulse.current = pulseKey;
    if (alertPrefs.haptics) navigator.vibrate?.([200, 100, 200]);
    if (alertPrefs.sound) playChime();
  }, [approach, alertPrefs.haptics, alertPrefs.sound]);
  // On a leg change the banner clears unless the rider asked to keep it.
  useEffect(() => {
    if (!alertPrefs.keepOnTransfer) setApproachDismissed(null);
  }, [legKey, alertPrefs.keepOnTransfer]);
  const showApproach = Boolean(approach) && approachDismissed !== `${approach?.key}-${approach?.state}`;

  // Real driving time between the two points that matter for this direction.
  const driveFrom = inbound
    ? { lat: setup.destLat, lon: setup.destLon }
    : { lat: setup.homeLat, lon: setup.homeLon };
  const driveTo = inbound
    ? { lat: setup.homeLat, lon: setup.homeLon }
    : { lat: setup.destLat, lon: setup.destLon };
  const fetchDriveTime = useServerFn(driveTime);
  const lookupOriginAddress = useServerFn(reverseGeocode);
  const {
    data: drive,
    isLoading: driveLoading,
    isError: driveFailed,
  } = useQuery({
    queryKey: ["drive", driveFrom.lat, driveFrom.lon, driveTo.lat, driveTo.lon],
    enabled: hydrated && configured && driveFrom.lat !== null && driveTo.lat !== null,
    staleTime: 5 * 60_000,
    refetchInterval: 5 * 60_000,
    retry: 1,
    queryFn: () =>
      fetchDriveTime({
        data: {
          fromLat: driveFrom.lat as number,
          fromLon: driveFrom.lon as number,
          toLat: driveTo.lat as number,
          toLon: driveTo.lon as number,
        },
      }),
  });

  // ---- "Arrive by" planning -------------------------------------------------
  // Work backwards from the target time to the latest honest departure for each
  // mode, using the same TomTom drive time and GTFS itineraries as Leave now.
  const arriveByTarget = parseClockInput(arriveByInput);
  const arriveByActive = planMode === "arrive-by" && arriveByTarget !== null;
  const arriveByPassed = arriveByActive && arriveByTarget < nowSeconds;
  const railPick = useMemo(
    () => (arriveByTarget === null ? null : latestRailArrival(options, arriveByTarget)),
    [options, arriveByTarget],
  );
  const futureDepartureIso = arriveByActive && !arriveByPassed && drive
    ? honoluluSecondsToIso(arriveByTarget - (drive.trafficMinutes + 5) * 60, now)
    : null;
  const { data: futureDrive } = useQuery({
    queryKey: ["drive-future", driveFrom.lat, driveFrom.lon, driveTo.lat, driveTo.lon, futureDepartureIso],
    enabled: Boolean(futureDepartureIso && driveAvailable && configured),
    staleTime: 5 * 60_000,
    retry: 1,
    queryFn: () => fetchDriveTime({ data: {
      fromLat: driveFrom.lat as number,
      fromLon: driveFrom.lon as number,
      toLat: driveTo.lat as number,
      toLon: driveTo.lon as number,
      departureTime: futureDepartureIso as string,
    } }),
  });
  const arriveByDrive = futureDrive ?? drive;
  const drivePlan = useMemo(
    () =>
      arriveByTarget === null || !arriveByDrive || !driveAvailable
        ? null
        : driveArriveBy(arriveByTarget, arriveByDrive.trafficMinutes, nowSeconds, 5, Boolean(futureDrive)),
    [arriveByTarget, arriveByDrive, driveAvailable, nowSeconds, futureDrive],
  );
  const arriveByComparison = useMemo(
    () =>
      compareArriveBy({
        railLeaveBySeconds: railPick?.option?.leave_by_seconds ?? null,
        railArriveSeconds: railPick?.option?.arrive_seconds ?? null,
        driveLeaveBySeconds: drivePlan?.feasible ? drivePlan.leaveBySeconds : null,
        driveArriveSeconds: drivePlan?.feasible ? drivePlan.arriveSeconds : null,
      }),
    [railPick, drivePlan],
  );

  // In arrive-by mode the itinerary shown is the latest one that still makes it.
  const arriveByLeaveBy = arriveByActive ? railPick?.option?.leave_by_seconds ?? null : null;
  useEffect(() => {
    if (arriveByLeaveBy !== null) setSelectedDeparture(arriveByLeaveBy);
  }, [arriveByLeaveBy]);

  // A saved place with a typical arrival time pre-fills the target once.
  const activeSavedPlace = useMemo(() => {
    if (setup.destLat === null || setup.destLon === null) return null;
    return (
      savedPlaces.find(
        (place) => distanceM(place, { lat: setup.destLat as number, lon: setup.destLon as number }) < 120,
      ) ?? null
    );
  }, [savedPlaces, setup.destLat, setup.destLon]);
  const typicalArrival = inbound ? null : activeSavedPlace?.typicalArrivalSeconds ?? null;
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
    staleTime: 3 * 60_000,
    refetchInterval: 3 * 60_000,
    retry: 1,
    queryFn: () =>
      fetchDriveTime({
        data: {
          fromLat: KAPOLEI_POINT.lat,
          fromLon: KAPOLEI_POINT.lon,
          toLat: DOWNTOWN_POINT.lat,
          toLon: DOWNTOWN_POINT.lon,
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
    staleTime: 3 * 60_000,
    refetchInterval: 3 * 60_000,
    retry: 1,
    queryFn: () =>
      fetchDriveTime({
        data: {
          fromLat: DOWNTOWN_POINT.lat,
          fromLon: DOWNTOWN_POINT.lon,
          toLat: KAPOLEI_POINT.lat,
          toLon: KAPOLEI_POINT.lon,
        },
      }),
  });

  // Real service hours for the rail station, used when nothing is reachable.
  const { data: railHours = [] } = useQuery({
    queryKey: ["service-hours", setup.homeStopId],
    enabled: hydrated && Boolean(setup.homeStopId) && !optionsLoading && options.length === 0,
    staleTime: 12 * 60 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("service_hours", { p_stop_id: setup.homeStopId, p_route_type: 1 });
      if (error) throw error;
      return data ?? [];
    },
  });

  const todayHours = railHours.find((row) => row.dow === honoluluIsoDow(now));
  // Rail total carries a safety buffer, and a range for transfers that slip.
  const railMinutes = best ? best.total_minutes + RAIL_BUFFER_MIN : null;
  const railRange = railMinutes === null ? null : { low: railMinutes - 1, high: railMinutes + RAIL_SLIP_MIN };
  const driveRange = drive
    ? { low: drive.lowMinutes, high: drive.highMinutes }
    : null;
  // The verdict compares exactly the number each column shows: the worst case.
  const driveMinutes = driveRange ? driveRange.high : null;
  const leaveIn = best ? Math.round((best.leave_by_seconds - nowSeconds) / 60) : null;
  const waitForTrain = best ? Math.round((best.leave_by_seconds - nowSeconds) / 60) : null;
  const longWait = waitForTrain !== null && waitForTrain > LONG_WAIT_MIN;

  const usableDrive = driveAvailable && driveMinutes !== null;
  // Compare worst case against worst case: the exact figures headlining each
  // column. When driving is not an option there is nothing to compare, so the
  // gap stays null and the headline never claims a margin.
  const railWorst = railRange ? railRange.high : null;
  const gap = railWorst !== null && usableDrive && driveMinutes !== null ? driveMinutes - railWorst : null;
  // An incident only explains the verdict when it is what actually pushes the
  // drive past rail; otherwise it is noise and must not colour the headline.
  const incidentDecides =
    Boolean(drive?.incidents[0])
    && railWorst !== null
    && driveMinutes !== null
    && driveMinutes > railWorst
    && driveMinutes - (drive?.incidents[0]?.delayMinutes ?? 0) <= railWorst;
  const decision = compareCommute({
    railMinutes: railWorst,
    driveMinutes,
    driveAvailable,
    driveDelayMinutes: drive?.delayMinutes ?? null,
    hasMajorIncident: incidentDecides,
    railWaitMinutes: waitForTrain,
    thresholdMinutes: TOSS_UP_MIN,
  });
  const verdict = decision.recommendation;
  useEffect(() => {
    if (verdict === "drive") setSelectedMode("drive");
    else if (verdict === "rail") setSelectedMode("rail");
  }, [verdict, inbound]);
  // One line naming the single thing that decides it.
  const reasoning = useMemo(() => {
    const incident = drive?.incidents[0];
    if (verdict === "drive" && longWait && waitForTrain !== null) {
      return `Next reachable train is ${waitForTrain} min out`;
    }
    if (verdict === "rail" && incident && incidentDecides) {
      return trafficDelayText(incident, drive?.delayMinutes ?? 0);
    }
    if (verdict === "rail" && best) {
      // Biggest wait inside the chain is the bottleneck worth naming.
      let worstLabel: string | null = null;
      let worstWait = 0;
      for (let index = 1; index < best.legs.length; index += 1) {
        const previous = best.legs[index - 1];
        const leg = best.legs[index];
        const wait = (leg?.depart_seconds ?? 0) - (previous?.arrive_seconds ?? 0);
        if (wait > worstWait && leg) {
          worstWait = wait;
          worstLabel = vehicleName(leg);
        }
      }
      if (worstLabel && worstWait >= 5 * 60) {
        return `${worstLabel} connection adds ${Math.round(worstWait / 60)} min of waiting`;
      }
    }
    if (drive && drive.delayMinutes >= 5)
      return `The drive is running ${drive.delayMinutes} min slower than usual`;
    return null;
  }, [best, drive, verdict, longWait, waitForTrain, incidentDecides]);

  const destinationLabel = setup.destinationName || setup.destinationAddress || "your destination";
  // A stop serves one direction, so the arriving stop and the boarding stop differ.
  const plannedInboundAccess = inbound && best?.legs[0]?.kind === "access" ? best.legs[0] : null;
  // The return banner must describe the chosen itinerary, not the stop saved during setup.
  const activeDestStopName = inbound
    ? plannedInboundAccess?.mode === "bus"
      ? plannedInboundAccess.from
      : null
    : setup.destStopName;
  const plannedInboundWalkM = plannedInboundAccess?.mode === "bus" && plannedInboundAccess.depart_seconds !== null && best
    ? Math.max(0, plannedInboundAccess.depart_seconds - best.leave_by_seconds) / 60 * 80.47
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
        title: followsTransit && previousLeg
          ? `Get off at ${transitStopName(previousLeg, "to")}`
          : vehicleName(leg),
        detail:
          leg.mode === "walk" || leg.mode === "drive"
            ? followsTransit
              ? `${vehicleName(leg)} · ${leg.minutes} min to ${
                  titleCase(leg.to) || (inbound ? "home" : "your destination")
                }${leg.mode === "walk" && leg.minutes !== null ? ` · ${formatDistance(leg.minutes * 80.47)}` : ""}${
                  leg.kind === "egress" && leg.mode === "drive" ? " · your car is parked here" : ""
                }`
              : leg.kind === "access" && leg.mode === "walk"
                ? `Walk to ${stationLabel(leg.to) || titleCase(leg.to) || "the station"} Station · ${leg.minutes} min${
                    leg.minutes !== null ? ` · ${formatDistance(leg.minutes * 80.47)}` : ""
                  } · arrive platform ${clockFromSeconds(leg.arrive_seconds)}`
                : `${leg.minutes} min from ${titleCase(leg.from) || "your location"} to ${
                    titleCase(leg.to) || (inbound ? "home" : "your destination")
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
      title: inbound ? "Arrive home" : "Arrive destination",
      detail: titleCase(last?.to) || setup.destinationName || setup.destinationAddress,
      boardAt: null,
      getOffAt: null,
      arriveSeconds: null,
      mode: "walk" as Leg["mode"],
    });
    return rows;
  }, [best, inbound, setup.destinationName, setup.destinationAddress]);

  // ---- Outdoor conditions --------------------------------------------------
  // Every moment of this trip spent outside: where it happens, when, how long.
  const homePoint = setup.homeLat !== null && setup.homeLon !== null
    ? { lat: setup.homeLat, lon: setup.homeLon }
    : null;
  const destPoint = setup.destLat !== null && setup.destLon !== null
    ? { lat: setup.destLat, lon: setup.destLon }
    : null;

  const commuteMapPoints = useMemo(() => {
    if (!best || !homePoint || !destPoint) return [];
    const origin = inbound ? destPoint : homePoint;
    const destination = inbound ? homePoint : destPoint;
    const originName = inbound ? destinationLabel : "Home";
    const destinationName = inbound ? "Home" : destinationLabel;
    const points: Array<{ id: string; name: string; lat: number; lon: number; kind: "start" | "rail" | "bus" | "end" }> = [
      { id: "start", name: originName, ...origin, kind: "start" },
    ];

    const stopPoint = (name: string | null) => {
      if (!name) return null;
      const normalized = name.trim().toLowerCase();
      const station = stationPoint(name);
      if (station) return station;
      const stop = itineraryStopCoords.find((row) => (row.stop_name ?? "").trim().toLowerCase() === normalized);
      if (!stop || stop.stop_lat === null || stop.stop_lon === null) return null;
      return { lat: Number(stop.stop_lat), lon: Number(stop.stop_lon) };
    };

    best.legs.forEach((leg, index) => {
      if (leg.mode !== "rail" && leg.mode !== "bus") return;
      const transitKind: "rail" | "bus" = leg.mode;
      [leg.from, leg.to].forEach((name, endpointIndex) => {
        const point = stopPoint(name);
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
  }, [best, homePoint, destPoint, inbound, destinationLabel, itineraryStopCoords, stationCoords]);

  // Drive view: straight door-to-door, no rail station or transit stops.
  const driveMapPoints = useMemo(() => {
    if (!homePoint || !destPoint) return [];
    const origin = inbound ? destPoint : homePoint;
    const destination = inbound ? homePoint : destPoint;
    return [
      { id: "start", name: inbound ? destinationLabel : "Home", ...origin, kind: "start" as const },
      { id: "end", name: inbound ? "Home" : destinationLabel, ...destination, kind: "end" as const },
    ];
  }, [homePoint, destPoint, inbound, destinationLabel]);

  const mapPoints = selectedMode === "drive" ? driveMapPoints : commuteMapPoints;
  // Drive mode traces the real road geometry TomTom used for the ETA.
  const driveMapPath = selectedMode === "drive" ? drive?.path : undefined;
  const driveTrafficSections = selectedMode === "drive" ? drive?.trafficSections : undefined;

  const moments = useMemo<OutdoorMoment[]>(() => {
    if (!best) return [];
    const originPoint = inbound ? destPoint : homePoint;
    const arrivalPoint = inbound ? homePoint : destPoint;
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
  }, [best, inbound, homePoint, destPoint, nowSeconds, stationPoint, setup.homeStopName]);

  const fetchWeather = useServerFn(outdoorConditions);
  // Runs alongside the plan, never in front of it: the trip renders regardless.
  const { data: weather } = useQuery({
    queryKey: ["weather", moments.map((moment) => `${moment.id}:${moment.lat.toFixed(2)},${moment.lon.toFixed(2)}:${moment.offsetMinutes}`)],
    enabled: moments.length > 0,
    staleTime: 20 * 60_000,
    refetchInterval: 20 * 60_000,
    retry: false,
    queryFn: () => {
      const longest = moments.filter((moment) => moment.outdoorMinutes > 5).sort((a, b) => b.outdoorMinutes - a.outdoorMinutes)[0];
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
          points: [{ id: "browse", lat: browseStation!.lat, lon: browseStation!.lon, offsetMinutes: 0 }],
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
    if (hot && humid) return { text: `Hot and humid · feels like ${feels}°F`, tone: "heat", source: "NWS" };
    if (hot) return { text: `Hot out · feels like ${feels}°F`, tone: "heat", source: "NWS" };
    return airLine(browseWeather?.air?.category ?? 0);
  }, [browseWeather]);

  const browseWeatherSummary = useMemo(() => {
    const reading = browseWeather?.moments[0];
    const parts: string[] = [];
    if (reading?.heatIndexF !== null && reading?.heatIndexF !== undefined) parts.push(`${reading.heatIndexF}°`);
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
    if (browseActive) {
      await Promise.allSettled([
        refetchBrowseDepartures(),
        refetchEastboundTraffic(),
        refetchWestboundTraffic(),
      ]);
    }
    window.setTimeout(() => setRefreshing(false), 250);
  }

  function closeSetup() {
    if (!configured) window.localStorage.setItem(SETUP_DISMISSED_KEY, "1");
    setOnboardingOpen(false);
    setSettingsOpen(false);
  }

  function saveSetup(next: Setup) {
    if (!configured) chooseDirection(false);
    persist(next);
    window.localStorage.removeItem(SETUP_DISMISSED_KEY);
    setOnboardingOpen(false);
    setSettingsOpen(false);
  }

  async function quickStartRoutine() {
    const home = findByKind(savedPlaces, "home");
    const destination = findByKind(savedPlaces, "work") ?? savedPlaces.find((place) => place.kind !== "home") ?? null;
    if (!home || !destination) {
      setOnboardingOpen(true);
      return;
    }
    const [station, arriving, boarding] = await Promise.all([
      supabase.rpc("nearest_stop", { p_lat: home.lat, p_lon: home.lon, p_rail_only: true }),
      supabase.rpc("directional_dest_stop", { p_lat: destination.lat, p_lon: destination.lon, p_toward_rail: false }),
      supabase.rpc("directional_dest_stop", { p_lat: destination.lat, p_lon: destination.lon, p_toward_rail: true }),
    ]);
    const rail = station.data?.[0];
    const out = arriving.data?.[0];
    const back = boarding.data?.[0];
    if (!rail || !out || !back) {
      setOnboardingOpen(true);
      return;
    }
    saveSetup({
      ...emptySetup,
      homeStopId: rail.stop_id,
      homeStopName: rail.stop_name ?? "",
      homeLat: home.lat,
      homeLon: home.lon,
      destinationName: destination.name,
      destinationAddress: destination.address,
      destLat: destination.lat,
      destLon: destination.lon,
      destStopId: out.stop_id,
      destStopName: out.stop_name ?? "",
      destStopWalkM: Number(out.distance_m),
      destReturnStopId: back.stop_id,
      destReturnStopName: back.stop_name ?? "",
      destReturnWalkM: Number(back.distance_m),
    });
    chooseDirection(honoluluParts(now).hour >= 12);
  }

  async function quickStartSavedPlace(kind: "home" | "work") {
    const destination = findByKind(savedPlaces, kind);
    if (!destination) {
      toast(`Save your ${kind === "home" ? "Home" : "Work"} location first.`, {
        description: "You can add it in Saved locations.",
      });
      setOnboardingOpen(true);
      return;
    }
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
          const [station, arriving, boarding] = await Promise.all([
            supabase.rpc("nearest_stop", { p_lat: origin.lat, p_lon: origin.lon, p_rail_only: true }),
            supabase.rpc("directional_dest_stop", { p_lat: destination.lat, p_lon: destination.lon, p_toward_rail: false }),
            supabase.rpc("directional_dest_stop", { p_lat: destination.lat, p_lon: destination.lon, p_toward_rail: true }),
          ]);
          const rail = station.data?.[0];
          const out = arriving.data?.[0];
          const back = boarding.data?.[0];
          if (!rail || !out || !back) throw new Error("No reachable transit stops");
          saveSetup({
            ...emptySetup,
            // Door-to-door driving must always be weighed for a one-tap trip.
            allowDrive: true,
            homeStopId: rail.stop_id,
            homeStopName: rail.stop_name ?? "",
            homeLat: origin.lat,
            homeLon: origin.lon,
            destinationName: destination.name,
            destinationAddress: destination.address,
            destLat: destination.lat,
            destLon: destination.lon,
            destStopId: out.stop_id,
            destStopName: out.stop_name ?? "",
            destStopWalkM: Number(out.distance_m),
            destReturnStopId: back.stop_id,
            destReturnStopName: back.stop_name ?? "",
            destReturnWalkM: Number(back.distance_m),
          });
          chooseDirection(kind === "home");
          const accuracy = position.coords.accuracy;
          const precision = Number.isFinite(accuracy) ? `Accurate to about ${formatDistance(accuracy)}` : "";
          const address = await lookupOriginAddress({ data: { lat: origin.lat, lon: origin.lon } }).catch(() => null);
          toast.success(`Trip to ${destination.label} is ready.`, {
            id: toastId,
            description: [address?.label ? `Starting at ${address.label}` : null, precision || null]
              .filter(Boolean)
              .join(" · ") || undefined,
          });
        } catch {
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
    <SetupDialog
      open={onboardingOpen || settingsOpen}
      firstRun={onboardingOpen}
      setup={setup}
      onClose={closeSetup}
      onSave={saveSetup}
      alertPrefs={alertPrefs}
      onAlertPrefsChange={saveAlertPrefs}
      savedPlaces={savedPlaces}
      onPlacesChange={persistPlaces}
    />
  );

  if (browseActive) {
    const trafficLoading = eastboundTrafficLoading || westboundTrafficLoading;
    const trafficUnavailable =
      eastboundTrafficFailed || westboundTrafficFailed || (!trafficLoading && (!eastboundTraffic || !westboundTraffic));
    const h1HasMeaningfulDelay =
      !trafficUnavailable &&
      !trafficLoading &&
      Math.max(eastboundTraffic?.delayMinutes ?? 0, westboundTraffic?.delayMinutes ?? 0) > 10;

    const profileName = profileFirstName(user);
    // Routine window: work mornings (5:00 AM–11:59 AM), home from noon on —
    // overnight hours count as heading home.
    const routineHour = honoluluParts(now).hour;
    const routineInbound = routineHour >= 12 || routineHour < 5;
    const routineDestination = findByKind(savedPlaces, "work") ?? savedPlaces.find((place) => place.kind !== "home") ?? null;
    return (
      <main className="browse-radiance min-h-dvh px-5 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))] text-foreground">
        <div className="mx-auto flex w-full max-w-[440px] flex-col">
          <header className="flex min-h-11 items-start justify-between gap-4">
            <div>
              <p className="mb-1 text-[11px] font-semibold text-recommended">{alohaGreeting(now, profileName)}</p>
              <div className="flex items-center gap-1.5">
                <WaveMark className="h-6 w-auto text-recommended" />
                <p className="text-lg font-medium tracking-wide text-foreground">Nalu</p>
              </div>
              <div className="mt-1.5 h-px bg-border/70" />
              <p className="mt-1 text-xs font-semibold uppercase text-muted-foreground">Oahu commute conditions</p>
            </div>
            <div className="flex items-center gap-1">
              <p className="text-right text-sm font-medium text-foreground">{timeText}</p>
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
              <Button variant="ghost" size="icon" aria-label={user ? "Open profile and settings" : "Sign in or open settings"} onClick={() => setSettingsOpen(true)} className="shrink-0 rounded-full text-muted-foreground hover:text-foreground">
                <UserRound className="size-5" />
              </Button>
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

          <SignInBanner />


          {findByKind(savedPlaces, "home") && routineDestination && (
            <button type="button" onClick={() => void quickStartRoutine()} className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-primary/40 bg-primary/10 px-3.5 py-3 text-left shadow-sm backdrop-blur-md transition-colors hover:bg-primary/15">
              <span className="truncate text-sm font-semibold text-foreground">{routineInbound ? "Head Home" : `Head to ${routineDestination.label}`}</span>
              <span className="shrink-0 rounded-full bg-primary px-3 py-1 text-[11px] font-bold text-primary-foreground">Start</span>
            </button>
          )}

          <DataExpiryNotice />

          <Button
            onClick={() => setOnboardingOpen(true)}
            className="browse-where-to mx-auto mt-5 min-h-16 w-full justify-center gap-3 rounded-lg border border-primary bg-primary px-5 text-center text-lg font-bold text-primary-foreground hover:bg-primary/90"
            aria-label="Where to? Set up a trip"
          >
            <Search className="size-6 text-primary-foreground" />
            <span>WHERE TO?</span>
            <ChevronRight className="size-5 text-primary-foreground/70" />
          </Button>

          <div className="mt-2 grid grid-cols-2 gap-2" aria-label="Saved place quick actions">
            {(["home", "work"] as const).map((kind) => {
              const place = findByKind(savedPlaces, kind);
              const Icon = kind === "home" ? House : BriefcaseBusiness;
              const label = kind === "home" ? "Home" : "Work";
              return (
                <Button
                  key={kind}
                  variant="outline"
                  onClick={() => void quickStartSavedPlace(kind)}
                  className="glass-panel h-14 justify-start gap-3 border-primary/30 bg-primary/5 px-3 text-foreground hover:bg-primary/10"
                  aria-label={place ? `Start a trip to ${label}` : `Set your ${label} location`}
                >
                  <span className="grid size-8 place-items-center rounded-md bg-primary/15 text-primary">
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0 text-left">
                    <span className="block text-sm font-bold">{label}</span>
                    <span className="block truncate text-[11px] font-medium text-muted-foreground">
                      {place ? place.name : "Set location"}
                    </span>
                  </span>
                </Button>
              );
            })}
          </div>

          {browseUserPoint && (
            <section className="map-shell relative mt-4 h-[44dvh] min-h-[320px] max-h-[470px] overflow-hidden rounded-xl" aria-label="Nearby transit map">
              <ClientOnly fallback={<div className="h-full animate-pulse bg-muted" aria-label="Loading nearby transit map" />}>
                <Suspense fallback={<div className="h-full animate-pulse bg-muted" aria-label="Loading nearby transit map" />}>
                  <NearbyTransitMap
                    userPoint={browseUserPoint}
                    stops={nearbyStops.map((stop) => ({
                      stopId: stop.stopId,
                      stopName: stop.stopName,
                      lat: stop.lat,
                      lon: stop.lon,
                      kind: stop.routeType === 1 ? "rail" : "bus",
                    }))}
                    selectedStopId={selectedNearbyStop?.stopId ?? null}
                    onSelectStop={setSelectedNearbyStopId}
                  />
                </Suspense>
              </ClientOnly>

              <div className="absolute left-3 top-3 z-[500] flex items-center gap-2 rounded-md border border-border bg-background/90 px-3 py-2 backdrop-blur-md">
                <span className="size-3 rounded-full border-2 border-foreground bg-location shadow-[0_0_10px_var(--color-location)]" aria-label="Your location" />
                <span className="text-xs font-semibold text-foreground">You</span>
              </div>
            </section>
          )}

          <section className="glass-panel mt-4 rounded-lg p-4" aria-labelledby="browse-station-title">
            <div className="flex items-center gap-3">
              <TrainFront className="size-6 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase text-muted-foreground">Closest Skyline station</p>
                <h2 id="browse-station-title" className="truncate text-xl font-semibold text-foreground">
                  {browseStation ? `${stationLabel(browseStation.stopName)} Station` : "Finding your station…"}
                </h2>
                {browseStation && <LandmarkHint name={browseStation.stopName} />}
              </div>
            </div>
            {browseStation && browseUserPoint && (
              <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-foreground">
                <span className="browse-eta-chip">Walk {walkingEstimate(browseUserPoint, browseStation).minutes} min · {formatDistance(walkingEstimate(browseUserPoint, browseStation).meters)}</span>
                <span className="browse-eta-chip">Drive about {Math.max(1, Math.ceil(distanceM(browseUserPoint, browseStation) / 670))} min</span>
              </div>
            )}
            {browseLocationDenied && browseStation && (
              <p className="mt-2 text-xs text-muted-foreground">Location unavailable · showing a data-derived West Oahu station</p>
            )}
            {browseLocationDenied && locationDenied && (
              <Button variant="link" onClick={() => setSettingsOpen(true)} className="mt-1 h-auto px-0 text-xs text-muted-foreground">
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
                  ...(browseStation?.userLat !== undefined ? { userLat: browseStation.userLat } : {}),
                  ...(browseStation?.userLon !== undefined ? { userLon: browseStation.userLon } : {}),
                });
              }}
            >
              <SelectTrigger className="mt-4 h-12 w-full bg-background" aria-label="Choose Skyline station">
                <SelectValue placeholder="Choose a station" />
              </SelectTrigger>
              <SelectContent>
                {browseStations.map((station) => (
                  <SelectItem key={station.stop_id} value={station.stop_id}>{stationLabel(station.stop_name)}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {browseStation && (
              <div
                className={`mt-4 grid grid-cols-2 gap-3 ${refreshing ? "animate-in fade-in duration-300" : ""}`}
                aria-label={`Departures from ${stationLabel(browseStation.stopName)}`}
              >
              {browseDeparturesLoading && <p className="text-sm text-muted-foreground">Loading departures…</p>}
              {!browseDeparturesLoading && browseDirections.length === 0 && (
                <p className="col-span-2 text-sm text-muted-foreground">No rail departures are scheduled from this station right now.</p>
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
                  terminusLabel(first?.direction_terminus) || stationLabel(first?.trip_headsign) || "the end of the line";
                const secondsAway = (first?.departure_seconds ?? 0) - nowSeconds;
                const minutesAway = Math.max(1, Math.ceil(secondsAway / 60));
                const nowDeparture = secondsAway >= -30 && secondsAway < 60;
                const soon = secondsAway >= 60 && secondsAway < 20 * 60;
                const walk = browseUserPoint ? walkingEstimate(browseUserPoint, browseStation) : null;
                const walkState = walk
                  ? walk.minutes + 2 <= minutesAway
                    ? "ok"
                    : walk.minutes <= minutesAway
                      ? "tight"
                      : "miss"
                  : null;
                return (
                  <article key={`${first?.route_id}-${first?.direction_id ?? "x"}`} className="browse-departure-card min-w-0 rounded-md p-3">
                    <h3 className="text-sm font-semibold text-foreground">{towardDowntown ? "Eastbound" : "Westbound"}</h3>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">to {directionName} · {endpoint}</p>
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
                        {walk && walkState && (
                          <p className={`mt-2 text-xs font-medium ${walkState === "ok" ? "text-primary" : "text-warning"}`}>
                            {walk.minutes} min walk
                            {walkState === "tight" ? " · Tight" : walkState === "miss" ? " · You'll miss this one." : ""}
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
              TheBus / DTS{h1HasMeaningfulDelay ? " · H-1 is delayed, so Skyline may be especially useful" : ""}
            </p>
          </section>

          {browseUserPoint && (
            <details className="glass-panel mt-3 rounded-lg">
              <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
                <Bus className="size-5 text-primary" />
                <span className="font-semibold text-foreground">Nearby stops & arrivals</span>
                <span className="ml-auto text-xs text-muted-foreground">{nearbyStops.length} stops</span>
                <ChevronDown className="size-4 text-muted-foreground" />
              </summary>
              <div className="border-t border-border p-4">
                <div className="flex gap-2 overflow-x-auto pb-3" aria-label="Choose a nearby stop">
                  {nearbyStops.map((stop) => {
                    const Icon = stop.routeType === 1 ? TrainFront : Bus;
                    return (
                      <Button key={stop.stopId} variant={selectedNearbyStop?.stopId === stop.stopId ? "default" : "secondary"} size="sm" onClick={() => setSelectedNearbyStopId(stop.stopId)} className="h-auto max-w-52 shrink-0 justify-start gap-2 px-3 py-2" aria-label={`Show ${nearbyServiceLabel(stop)} at ${titleCase(stop.stopName)}`}>
                        <Icon className="size-4 shrink-0" />
                        <span className="truncate font-semibold">{nearbyServiceLabel(stop)}</span>
                      </Button>
                    );
                  })}
                </div>
                {nearbyStopsLoading && <p className="text-sm text-muted-foreground">Finding nearby transit…</p>}
                {selectedNearbyStop && (
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-foreground">{selectedNearbyStop.routeType === 1 ? `${stationLabel(selectedNearbyStop.stopName)} Station` : titleCase(selectedNearbyStop.stopName)}</p>
                        <LandmarkHint name={selectedNearbyStop.stopName} />
                        <p className="mt-1 text-xs text-muted-foreground">Walk {walkingEstimate(browseUserPoint, selectedNearbyStop).minutes} min · {formatDistance(selectedNearbyStop.distanceM)}</p>
                      </div>
                      {selectedNearbyStop.arrivals[0] && <p className="text-lg font-bold tabular-nums text-primary">{Math.max(0, Math.ceil((selectedNearbyStop.arrivals[0].departure_seconds - nowSeconds) / 60))} min</p>}
                    </div>
                    <div className="mt-3 divide-y divide-border">
                      {selectedNearbyStop.arrivals.length ? selectedNearbyStop.arrivals.slice(0, 3).map((arrival, index) => (
                        <div key={`${arrival.departure_seconds}-${index}`} className="flex items-center gap-2 py-2 text-sm text-foreground">
                          <span className="shrink-0 rounded-md bg-primary/15 px-2 py-1 font-bold text-primary">
                            {selectedNearbyStop.routeType === 1 ? "Skyline" : arrival.route_short_name || arrival.route_long_name || "Bus"}
                          </span>
                          <span className="min-w-0 flex-1 truncate font-medium">
                            {arrival.headsign ? (selectedNearbyStop.routeType === 1 ? stationLabel(arrival.headsign) : titleCase(arrival.headsign)) : "Destination unavailable"}
                          </span>
                          <span className="shrink-0 font-bold tabular-nums">{clockFromSeconds(arrival.departure_seconds)}</span>
                        </div>
                      )) : <p className="text-sm text-muted-foreground">No upcoming scheduled arrivals right now.</p>}
                    </div>
                    <details className="walking-map-details mt-3 border-t border-border pt-3">
                      <summary>Show walk to this stop</summary>
                      <div className="map-shell mt-2 overflow-hidden rounded-lg">
                        <ClientOnly fallback={<div className="h-40 animate-pulse bg-muted" aria-label="Loading walking map" />}>
                          <Suspense fallback={<div className="h-40 animate-pulse bg-muted" aria-label="Loading walking map" />}>
                            <WalkingMicroMap
                              from={{ ...browseUserPoint, label: "Your location" }}
                              to={{ lat: selectedNearbyStop.lat, lon: selectedNearbyStop.lon, label: titleCase(selectedNearbyStop.stopName) }}
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
            <H1ConditionsCard eastbound={eastboundTraffic} westbound={westboundTraffic} loading={trafficLoading} unavailable={trafficUnavailable} compact />
            <details className="glass-panel mt-4 rounded-lg">
              <summary className="flex min-h-14 cursor-pointer list-none items-center gap-2 px-4 py-3 [&::-webkit-details-marker]:hidden">
                <span className="min-w-0 truncate text-sm font-semibold text-foreground">{browseWeatherSummary}</span>
                <ChevronDown className="ml-auto size-4 shrink-0 text-muted-foreground" />
              </summary>
              <div className="border-t border-border px-4 py-3">
                {browseWeatherLine ? <p className={`text-sm ${TONE_CLASS[browseWeatherLine.tone]}`}>{browseWeatherLine.text}</p> : <p className="text-sm text-muted-foreground">No weather or air-quality concerns right now.</p>}
                <p className="mt-2 text-[10px] text-muted-foreground">Weather: NWS · Air quality: AirNow / EPA</p>
              </div>
            </details>
          </div>
        </div>
        {setupDialog}
      </main>
    );
  }

  return (
    <main className={`min-h-dvh bg-page-gradient px-5 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))] text-foreground ${verdict === "rail" ? "commute-radiance-rail" : verdict === "drive" ? "commute-radiance-drive" : ""}`}>
      <div className="mx-auto flex w-full max-w-[440px] flex-col">
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

        <div role="tablist" aria-label="Trip direction" className="grid grid-cols-2 gap-1 rounded-full bg-surface-raised p-1">
          {[
            { label: "To destination", value: false },
            { label: "To home", value: true },
          ].map((tab) => (
            <button
              key={tab.label}
              role="tab"
              aria-selected={inbound === tab.value}
              onClick={() => chooseDirection(tab.value)}
              className={`min-h-11 rounded-full text-sm font-semibold transition-colors ${
                inbound === tab.value ? "bg-recommended text-recommended-foreground" : "text-muted-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <header className="mt-5 flex min-h-11 items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5">
              <WaveMark className="h-6 w-auto text-recommended" />
              <p className="text-lg font-medium tracking-wide text-foreground">Nalu</p>
            </div>
            <div className="mt-1.5 h-px bg-border/70" />
            <p className="mt-1 text-xs font-semibold uppercase text-muted-foreground">
              {inbound ? "Heading home" : "Heading out"}
            </p>
            <p className="mt-1 text-[15px] font-medium text-foreground">{timeText}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Open settings"
            onClick={() => setSettingsOpen(true)}
            className="rounded-full text-muted-foreground hover:text-foreground"
          >
            <Settings className="size-5" />
          </Button>
        </header>

        <DataExpiryNotice />

        <section className="mt-4 rounded-lg border border-border bg-surface-raised p-4" aria-labelledby="plan-mode-title">
          <h2 id="plan-mode-title" className="sr-only">When do you need to travel?</h2>
          <div role="tablist" aria-label="Planning mode" className="grid grid-cols-2 gap-1 rounded-full bg-background/60 p-1">
            {[
              { label: "Leave now", value: "leave-now" as PlanMode },
              { label: "Arrive by", value: "arrive-by" as PlanMode },
            ].map((tab) => (
              <button
                key={tab.value}
                role="tab"
                aria-selected={planMode === tab.value}
                onClick={() => choosePlanMode(tab.value)}
                className={`min-h-11 rounded-full text-sm font-semibold transition-colors ${
                  planMode === tab.value ? "bg-recommended text-recommended-foreground" : "text-muted-foreground"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {planMode === "arrive-by" && (
            <div className="mt-4">
              <Label htmlFor="arrive-by-time" className="text-xs font-semibold uppercase text-muted-foreground">
                Be at {inbound ? "home" : destinationLabel} by
              </Label>
              <Input
                id="arrive-by-time"
                type="time"
                value={arriveByInput}
                onChange={(event) => chooseArriveBy(event.target.value)}
                className="mt-2 h-12 w-full bg-background/60 text-2xl font-bold tabular-nums"
              />
              {arriveByPassed && (
                <div role="alert" className="mt-3 rounded-lg border border-warning/50 bg-warning/10 px-3 py-2.5">
                  <p className="text-sm font-bold text-warning">That arrival time has already passed today.</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Here are the earliest times still possible if you leave now.</p>
                </div>
              )}
              {activeSavedPlace?.typicalArrivalSeconds !== null && activeSavedPlace?.typicalArrivalSeconds !== undefined && !inbound && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Typical arrival saved for {activeSavedPlace.label}: {clockFromSeconds(activeSavedPlace.typicalArrivalSeconds)}
                </p>
              )}

              {arriveByTarget === null ? (
                <p className="mt-4 text-sm text-muted-foreground">Pick the time you need to be there and Nalu works backwards.</p>
              ) : (
                <div className="mt-4 grid gap-3">
                  <div className="rounded-lg border border-border bg-background/50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="flex items-center gap-2 text-sm font-bold text-foreground"><TrainFront className="size-4 text-primary" /> Rail</p>
                      {railPick?.option && <p className="text-xs font-semibold text-muted-foreground">{railPick.option.total_minutes} min door to door</p>}
                    </div>
                    {railPick?.option && !arriveByPassed ? (
                      <p className="mt-2 text-lg font-bold tabular-nums text-foreground">
                        Leave by {clockFromSeconds(railPick.option.leave_by_seconds)}
                        <span className="ml-2 text-sm font-medium text-muted-foreground">· arrive {clockFromSeconds(railPick.option.arrive_seconds)}</span>
                      </p>
                    ) : optionsLoading ? (
                      <p className="mt-2 text-sm text-muted-foreground">Checking the timetable…</p>
                    ) : railPick?.earliestOption ? (
                      <p className="mt-2 text-sm text-warning">
                        {arriveByPassed ? "Earliest feasible trip: " : `No train and bus combination gets you there by ${clockFromSeconds(arriveByTarget)}. Earliest feasible trip: `}
                        leave at {clockFromSeconds(railPick.earliestOption.leave_by_seconds)} · arrive {clockFromSeconds(railPick.earliestOption.arrive_seconds)}.
                      </p>
                    ) : (
                      <p className="mt-2 text-sm text-muted-foreground">
                        {todayHours
                          ? `No rail service for this trip at that time. Service runs ${clockFromSeconds(todayHours.first_seconds)} to ${clockFromSeconds(todayHours.last_seconds)} today.`
                          : "No rail service for this trip today."}
                      </p>
                    )}
                  </div>

                  <div className="rounded-lg border border-border bg-background/50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="flex items-center gap-2 text-sm font-bold text-foreground"><Car className="size-4 text-primary" /> Drive</p>
                      {drive && driveAvailable && <p className="text-xs font-semibold text-muted-foreground">{drive.trafficMinutes} min driving</p>}
                    </div>
                    {drivePlan?.feasible && !arriveByPassed ? (
                      <p className="mt-2 text-lg font-bold tabular-nums text-foreground">
                        Leave by {clockFromSeconds(drivePlan.leaveBySeconds)}
                        <span className="ml-2 text-sm font-medium text-muted-foreground">· arrive around {clockFromSeconds(drivePlan.arriveSeconds)}</span>
                      </p>
                    ) : drivePlan ? (
                      <p className="mt-2 text-sm text-warning">
                        {arriveByPassed ? "Earliest feasible drive" : `Too late to arrive by ${clockFromSeconds(arriveByTarget)}`} · leave {clockFromSeconds(drivePlan.leaveBySeconds)} · arrive around {clockFromSeconds(drivePlan.earliestArriveSeconds)}.
                      </p>
                    ) : !driveAvailable ? (
                      <p className="mt-2 text-sm text-muted-foreground">{carAwayReason ?? "Driving is not available for this trip."}</p>
                    ) : (
                      <p className="mt-2 text-sm text-muted-foreground">{driveLoading ? "Checking live traffic…" : "Live traffic is unavailable right now."}</p>
                    )}
                    {drivePlan && (
                      <p className="mt-2 text-[10px] text-muted-foreground">
                        Includes {drivePlan.bufferMinutes} min to park and walk in · Drive time: TomTom
                      </p>
                    )}
                  </div>

                  {arriveByComparison.winner === "drive" && arriveByComparison.laterMinutes > 0 && (
                    <p className="text-base font-semibold text-foreground">
                      Driving lets you leave {arriveByComparison.laterMinutes} min later than rail and still arrive by {clockFromSeconds(drivePlan?.arriveSeconds ?? arriveByTarget)}.
                    </p>
                  )}
                  {arriveByComparison.winner === "rail" && arriveByComparison.laterMinutes > 0 && (
                    <p className="text-base font-semibold text-foreground">
                      Rail lets you leave {arriveByComparison.laterMinutes} min later than driving
                      {arriveByComparison.earlierMinutes > 0 ? ` and arrive ${arriveByComparison.earlierMinutes} min earlier than driving` : ""}.
                    </p>
                  )}
                  {arriveByComparison.winner === "same" && (
                    <p className="text-base font-semibold text-muted-foreground">Rail and driving need you out the door at about the same time.</p>
                  )}
                  <p className="text-[10px] text-muted-foreground">All times are Hawaii Standard Time (UTC−10).</p>
                </div>
              )}
            </div>
          )}
        </section>

        <section
          className="verdict-lift glass-panel -mx-2 mt-5 rounded-lg px-5 py-7 animate-in fade-in duration-300"
          aria-labelledby="verdict-title"
        >
          <div className="mb-5 flex items-center gap-2 text-recommended">
            <span className="flex size-6 items-center justify-center rounded-full bg-recommended text-recommended-foreground">
              <Check className="size-4 stroke-[3]" />
            </span>
            <span className="text-xs font-bold uppercase">Best option</span>
          </div>
          <h1
            id="verdict-title"
            className="max-w-[390px] text-4xl font-bold leading-none text-foreground"
          >
            {!configured
              ? "WHERE TO?"
              : verdict === "none"
                ? "RAIL UNAVAILABLE"
                : verdict === "same"
                  ? "ABOUT THE SAME"
                  : verdict === "rail"
                    ? `TAKE RAIL${gap !== null ? ` · ${Math.abs(gap)} MIN FASTER THAN DRIVING` : ""}`
                    : `DRIVE TODAY${gap !== null ? ` · ${Math.abs(gap)} MIN FASTER THAN RAIL & BUS` : ""}`}
          </h1>
          {verdict === "rail" && best && railRange && (
            <div className="mt-6 grid grid-cols-3 gap-2 border-t border-border/70 pt-5">
              <div className="metric-glass"><p className="text-xs text-muted-foreground">Leave by</p><p className="mt-1 text-xl font-bold tabular-nums text-recommended">{clockFromSeconds(best.leave_by_seconds)}</p></div>
              <div className="metric-glass"><p className="text-xs text-muted-foreground">Arrive</p><p className="mt-1 text-xl font-bold tabular-nums text-foreground">{clockFromSeconds(best.arrive_seconds)}</p></div>
              <div className="metric-glass"><p className="text-xs text-muted-foreground">Total</p><p className="mt-1 text-3xl font-bold leading-none tabular-nums text-foreground">{railRange.high}<span className="ml-1 text-xs font-semibold text-muted-foreground">min</span></p></div>
            </div>
          )}
          {verdict === "drive" && drive && driveRange && (
            <div className="mt-6 grid grid-cols-3 gap-2 border-t border-border/70 pt-5">
              <div className="metric-glass"><p className="text-xs text-muted-foreground">Leave</p><p className="mt-1 text-xl font-bold text-recommended">Now</p></div>
              <div className="metric-glass"><p className="text-xs text-muted-foreground">Arrive</p><p className="mt-1 text-xl font-bold tabular-nums text-foreground">{clockFromSeconds(nowSeconds + drive.trafficMinutes * 60)}</p></div>
              <div className="metric-glass"><p className="text-xs text-muted-foreground">Total</p><p className="mt-1 text-3xl font-bold leading-none tabular-nums text-foreground">{driveRange.high}<span className="ml-1 text-xs font-semibold text-muted-foreground">min</span></p></div>
            </div>
          )}
          {verdict === "drive" && drive && (
            <RouteCorridor label={drive.corridorLabel} />
          )}
          {(verdict === "same" || verdict === "none") && (
            <p className="mt-4 text-lg font-medium text-muted-foreground">
              {verdict === "same" ? `Rail and driving are within ${TOSS_UP_MIN} min of each other.` : optionsLoading ? "Checking today's connections…" : todayHours ? `No reachable rail connection right now. Service runs ${clockFromSeconds(todayHours.first_seconds)} to ${clockFromSeconds(todayHours.last_seconds)} today.` : "No rail service for this trip today."}
            </p>
          )}
          {reasoning && <p className="mt-3 text-base font-medium text-foreground">{reasoning}</p>}
          {verdict === "drive" && drive?.incidents[0] && (
            <p className="mt-4 border-l-2 border-warning pl-3 text-base font-bold text-foreground">
              {trafficDelayText(drive.incidents[0], drive.delayMinutes)}
            </p>
          )}
        </section>

        <H1ConditionsCard
          eastbound={eastboundTraffic}
          westbound={westboundTraffic}
          loading={eastboundTrafficLoading || westboundTrafficLoading}
          unavailable={eastboundTrafficFailed || westboundTrafficFailed || (!(eastboundTrafficLoading || westboundTrafficLoading) && (!eastboundTraffic || !westboundTraffic))}
          compact
        />

        {mapPoints.length >= 2 && (selectedMode === "drive" || Boolean(best)) && (
          <section className="map-shell mt-4 overflow-hidden rounded-xl" aria-labelledby="trip-map-title">
            <div className="flex items-center justify-between px-4 py-3">
              <div><h2 id="trip-map-title" className="text-sm font-bold text-foreground">Your route</h2><p className="mt-0.5 text-xs text-muted-foreground">{inbound ? `${destinationLabel} to home` : `Home to ${destinationLabel}`}</p></div>
              <span className="text-xs font-semibold text-muted-foreground">{selectedMode === "drive" ? "Direct drive" : `${mapPoints.length - 2} transit points`}</span>
            </div>
            <div className="h-72 border-t border-border sm:h-80">
              <ClientOnly fallback={<div className="h-full w-full animate-pulse bg-muted" aria-label="Loading trip map" />}>
                <Suspense fallback={<div className="h-full w-full animate-pulse bg-muted" aria-label="Loading trip map" />}><CommuteRouteMap points={mapPoints} livePoint={riderPoint} {...(driveMapPath && driveMapPath.length > 1 ? { path: driveMapPath } : {})} {...(driveTrafficSections && driveTrafficSections.length > 0 ? { trafficSections: driveTrafficSections } : {})} /></Suspense>
              </ClientOnly>
            </div>
          </section>
        )}


        <section className="py-6" aria-labelledby="mode-details-title">
          <h2 id="mode-details-title" className="sr-only">Trip details</h2>
          <div role="tablist" aria-label="Travel mode" className="glass-panel grid grid-cols-2 gap-1 rounded-lg p-1">
            <Button type="button" role="tab" aria-selected={selectedMode === "rail"} variant="ghost" onClick={() => setSelectedMode("rail")} className={`relative h-14 ${selectedMode === "rail" ? "bg-recommended text-recommended-foreground hover:bg-recommended" : "text-muted-foreground"}`}>
              <TrainFront /> Rail {railRange ? `· ${railRange.high} min` : ""}
              {verdict === "rail" && <span className="mode-winner-badge">Faster than driving</span>}
            </Button>
            <Button type="button" role="tab" aria-selected={selectedMode === "drive"} variant="ghost" onClick={() => setSelectedMode("drive")} className={`relative h-14 ${selectedMode === "drive" ? "bg-recommended text-recommended-foreground hover:bg-recommended" : "text-muted-foreground"}`}>
              <Car /> Drive {driveAvailable && driveRange ? `· ${driveRange.high} min` : ""}
              {verdict === "drive" && <span className="mode-winner-badge">Faster than transit</span>}
            </Button>
          </div>

          {selectedMode === "rail" && (
            <div className="mt-6">
              <div className="flex items-baseline justify-between gap-3"><h3 className="text-xl font-bold text-foreground">Rail itinerary</h3>{railRange && <p className="text-sm font-semibold text-muted-foreground">{railRange.low}–{railRange.high} min</p>}</div>
              {best ? <RailTripBreakdown option={best} inbound={inbound} liveBus={liveBus} liveBusRefreshing={liveBusRefreshing} weatherLines={weatherLines} points={commuteMapPoints} /> : <p className="mt-5 text-sm text-muted-foreground">{optionsLoading ? "Building your trip…" : "No rail trip available."}</p>}
            </div>
          )}

          {selectedMode === "drive" && (
            <div className="mt-6 rounded-lg border border-border p-5">
              <div className="flex items-end justify-between gap-4"><div><h3 className="text-xl font-bold text-foreground">Drive details</h3><p className="mt-1 text-sm text-muted-foreground">{inbound ? `${destinationLabel} to home` : `Home to ${destinationLabel}`}</p></div><p className="text-4xl font-bold tabular-nums text-foreground">{driveAvailable ? (driveRange ? driveRange.high : driveLoading ? "…" : "—") : "—"}<span className="ml-1 text-base">min</span></p></div>
              {drive?.corridorLabel
                ? <RouteCorridor label={drive.corridorLabel} size="compact" />
                : <p className="mt-4 text-sm font-medium text-foreground">Drive straight {inbound ? `from ${destinationLabel} to your home address` : `from home to ${destinationLabel}`} — no stop at a rail station.</p>}
              {driveAvailable && driveRange && drive && <p className="mt-3 text-[10px] text-muted-foreground">Drive time: TomTom</p>}
              {!driveAvailable && carAwayReason && <p className="mt-4 text-sm text-muted-foreground">{carAwayReason}</p>}
              {driveAvailable && driveFailed && <p className="mt-4 text-sm text-muted-foreground">Live traffic is unavailable right now.</p>}
              {driveAvailable && drive?.incidents[0] && verdict !== "drive" && !incidentDecides && <p className="mt-4 border-l-2 border-warning pl-3 text-base font-bold text-foreground">{trafficDelayText(drive.incidents[0], drive.delayMinutes)}</p>}
              {driveWeatherLines.map((line) => <p key={line.text} className={`mt-3 text-sm ${TONE_CLASS[line.tone]}`}>{line.text}<span className="ml-1 text-[10px] text-muted-foreground">{line.source}</span></p>)}
              {!inbound && driveAvailable && <Button variant="outline" size="sm" onClick={() => setCarPlace("destination")} className="mt-5">I'm driving all the way</Button>}
              {inbound && carPlace === "destination" && <Button variant="outline" size="sm" onClick={() => setCarPlace("home")} className="mt-5">My car isn't here</Button>}
            </div>
          )}

        </section>

        {selectedMode === "rail" && options.length > 1 && <section className="mb-8 rounded-lg border border-border bg-surface-raised p-5" aria-labelledby="later-title">
          <h2 id="later-title" className="text-lg font-semibold">Alternative Departures</h2>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Other departures compared with your current plan. Tap one to make it your plan.
          </p>
          <ol className="mt-4 grid gap-3">
            {options.filter((option) => option.leave_by_seconds !== best?.leave_by_seconds).slice(0, 3).map((option, index) => {
              const selected = option.leave_by_seconds === best?.leave_by_seconds;
              const arrivalDifference = best
                ? Math.round((option.arrive_seconds - best.arrive_seconds) / 60)
                : 0;
              const departureDifference = best
                ? Math.round((option.leave_by_seconds - best.leave_by_seconds) / 60)
                : 0;
              return (
              <li key={`${option.leave_by_seconds}-${index}`}>
                <Button
                  type="button"
                  variant="ghost"
                  aria-pressed={selected}
                  onClick={() => setSelectedDeparture(selected ? null : option.leave_by_seconds)}
                  className={`h-auto w-full justify-start whitespace-normal rounded-lg border p-4 text-left transition-colors ${selected ? "border-recommended bg-recommended/10" : "border-border bg-background/40 hover:border-muted-foreground"}`}
                >
                  <span className="block w-full">
                  <span className="flex items-start justify-between gap-3">
                    <span className="text-base font-bold leading-snug text-foreground">
                      If you leave at <span className="tabular-nums">{clockFromSeconds(option.leave_by_seconds)}</span>,
                      you arrive at <span className="tabular-nums">{clockFromSeconds(option.arrive_seconds)}</span>
                    </span>
                    <span className="shrink-0 rounded-full bg-muted px-2 py-1 text-xs font-bold tabular-nums text-muted-foreground">
                      {arrivalDifference > 0 ? `Arrives ${arrivalDifference} min later than current` : arrivalDifference < 0 ? `Arrives ${Math.abs(arrivalDifference)} min earlier than current` : "Same arrival as current"}
                    </span>
                  </span>
                  <span className="mt-3 grid grid-cols-2 gap-3 border-t border-border pt-3 text-sm">
                    <span><span className="block text-xs text-muted-foreground">Compared with current departure</span><span className="mt-0.5 block font-semibold tabular-nums text-foreground">{departureDifference > 0 ? `Leaves ${departureDifference} min later` : departureDifference < 0 ? `Leaves ${Math.abs(departureDifference)} min earlier` : "Same departure time"}</span></span>
                    <span><span className="block text-xs text-muted-foreground">Total duration</span><span className="mt-0.5 block font-semibold tabular-nums text-foreground">{option.total_minutes} min</span></span>
                  </span>
                  {option.legs[0] && <span className="mt-3 block truncate text-xs text-muted-foreground">{vehicleName(option.legs[0])}</span>}
                  </span>
                </Button>
              </li>
              );
            })}
          </ol>
        </section>}

        <Button
          variant="outline"
          onClick={endTrip}
          className="mt-2 h-12 w-full shadow-none"
        >
          End trip
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
    leg.minutes ?? (leg.depart_seconds !== null && leg.arrive_seconds !== null
      ? Math.max(0, Math.round((leg.arrive_seconds - leg.depart_seconds) / 60))
      : null);
  const access = option.legs.find((leg) => leg.kind === "access") ?? null;
  const rail = option.legs.find((leg) => leg.kind === "rail") ?? null;
  const connection = option.legs.find((leg) => leg.kind === "connect") ?? null;
  const egress = option.legs.find((leg) => leg.kind === "egress") ?? null;
  const rows = [access, rail, connection, egress].filter((leg): leg is Leg => Boolean(leg));

  return (
    <>
      <ol className="mt-7" aria-label="Rail trip breakdown">
      {rows.map((leg, index) => {
        const Icon = modeIcon(leg.mode);
        const previous = rows[index - 1];
        const waitMinutes = previous?.arrive_seconds !== null && previous?.arrive_seconds !== undefined && leg.depart_seconds !== null
          ? Math.max(0, Math.round((leg.depart_seconds - previous.arrive_seconds) / 60))
          : 0;
        const legMinutes = duration(leg);
        const stationName = stationLabel(leg.to);
        const label = leg.kind === "access"
          ? leg.mode === "walk"
            ? `Walk to ${stationName || "the station"} Station`
            : stationName ? `To ${stationName} Station` : "To the station"
          : leg.kind === "rail"
            ? "Skyline"
            : leg.kind === "connect"
              ? "Connecting bus"
              : leg.mode === "bus"
                ? inbound ? "Bus home" : "Connecting bus"
                : leg.mode === "drive"
                  ? inbound ? "Drive home" : "Drive"
                  : inbound ? "Walk home" : "Final walk";
        const arrivalLabel = leg.kind === "egress"
          ? inbound ? "home" : "destination"
          : leg.kind === "access"
            ? `${stationName || titleCase(leg.to) || "station"} Station platform`
            : titleCase(leg.to);
        const liveArrival = leg.mode === "bus"
          ? matchLiveArrival(liveBus, leg.route_short, leg.headsign, leg.depart_seconds)
          : null;
        const followsTransit = previous?.mode === "bus" || previous?.mode === "rail";
        const pointByName = (name: string | null) => {
          const wanted = stationLabel(name).toLowerCase();
          if (!wanted) return null;
          return points.find((point) => stationLabel(point.name).toLowerCase() === wanted) ?? null;
        };
        const walkFrom = leg.mode === "walk" ? pointByName(leg.from) : null;
        const walkTo = leg.mode === "walk" ? pointByName(leg.to) : null;
        const originPoint = points.find((point) => point.id === "start") ?? null;
        const finalPoint = points.find((point) => point.id === "end") ?? null;
        const isTransit = leg.mode === "bus" || leg.mode === "rail";
        // Boarding a bus/train still starts on foot: origin -> boarding stop.
        const accessWalk = isTransit && index === 0 && originPoint
          ? walkBetween(originPoint, pointByName(leg.from), transitStopName(leg, "from"))
          : null;
        // Last leg is transit: the rider still walks from the drop-off to the door.
        const egressWalk = isTransit && index === rows.length - 1 && finalPoint
          ? walkBetween(pointByName(leg.to), finalPoint, finalPoint.name, transitStopName(leg, "to"))
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
                  {followsTransit && previous ? `Get off at ${transitStopName(previous, "to")}` : label}
                </p>
                {legMinutes !== null && <p className="shrink-0 text-xs font-semibold tabular-nums text-foreground">{legMinutes} min</p>}
              </div>
              <p className={`mt-1 text-sm font-bold leading-snug text-foreground ${followsTransit ? "rounded-md border border-recommended/50 bg-recommended/10 px-2.5 py-2" : ""}`}>
                {followsTransit ? `${vehicleName(leg)} from ${transitStopName(previous, "to")}` : vehicleName(leg)}
              </p>
              {accessWalk && <WalkSegment walk={accessWalk} />}
              {leg.mode === "bus" ? (
                <div className="mt-2">
                  {waitMinutes > 0 && <p className="text-xs font-semibold text-foreground">Transfer walk/wait · {waitMinutes} min</p>}
                  <p className="text-sm font-semibold text-foreground">Board at: {transitStopName(leg, "from")}</p>
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
                    <span className="shrink-0 tabular-nums">{clockFromSeconds(leg.arrive_seconds)}</span>
                  </p>
                  <LandmarkHint name={transitStopName(leg, "to")} />
                  <p className="mt-1 text-xs font-semibold text-foreground">Ride {legMinutes ?? "—"} min</p>
                </div>
              ) : leg.mode === "rail" ? (
                <div className="mt-2 space-y-1.5">
                  <p className="text-sm font-semibold text-foreground">
                    Board at: {transitStopName(leg, "from")} · {clockFromSeconds(leg.depart_seconds)}
                  </p>
                  <LandmarkHint name={transitStopName(leg, "from")} />
                  <p className="flex flex-wrap items-baseline justify-between gap-2 rounded-md border border-recommended/50 bg-recommended/10 px-2.5 py-2 text-sm font-bold text-foreground">
                    <span>Get off at: {transitStopName(leg, "to")}</span>
                    <span className="shrink-0 tabular-nums">{clockFromSeconds(leg.arrive_seconds)}</span>
                  </p>
                  <LandmarkHint name={transitStopName(leg, "to")} />
                </div>
              ) : (
                <div className="mt-1 text-xs font-semibold leading-relaxed text-foreground">
                  {leg.mode === "walk" && legMinutes !== null && (
                    <p className="text-sm font-bold">{formatDistance(legMinutes * 80.47)} · {legMinutes} min walk</p>
                  )}
                  <p>{`Arrive ${arrivalLabel} ${clockFromSeconds(leg.arrive_seconds)}`}</p>
                  {walkFrom && walkTo && (
                    <details className="walking-map-details mt-2">
                      <summary>Show walking map</summary>
                      <div className="map-shell mt-2 overflow-hidden rounded-lg">
                        <ClientOnly fallback={<div className="h-40 animate-pulse bg-muted" />}>
                          <Suspense fallback={<div className="h-40 animate-pulse bg-muted" />}><WalkingMicroMap from={{ ...walkFrom, label: titleCase(leg.from) }} to={{ ...walkTo, label: titleCase(leg.to) }} /></Suspense>
                        </ClientOnly>
                      </div>
                    </details>
                  )}
                </div>
              )}
              {egressWalk && <WalkSegment walk={egressWalk} />}
              {(weatherLines.get(option.legs.indexOf(leg)) ?? []).map((line) => (
                <p key={line.text} className={`mt-2 text-xs ${TONE_CLASS[line.tone]}`}>
                  {line.text}<span className="ml-1 text-[10px] text-muted-foreground">{line.source}</span>
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
      <p className="text-sm font-bold">{formatDistance(walk.meters)} · {walk.minutes} min walk</p>
      <p className="text-muted-foreground">{walk.from.label} → {walk.to.label}</p>
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
  const normalizedRoute = (route ?? "").trim().toLowerCase();
  const normalizedHeadsign = (headsign ?? "").trim().toLowerCase();
  const matches = result.arrivals.filter((arrival) => {
    if (arrival.routeShortName.trim().toLowerCase() !== normalizedRoute) return false;
    const candidate = arrival.headsign.trim().toLowerCase();
    return !candidate || !normalizedHeadsign || candidate.includes(normalizedHeadsign) || normalizedHeadsign.includes(candidate);
  });
  if (scheduledSeconds === null) return matches[0] ?? null;
  return matches.sort(
    (a, b) => Math.abs(a.scheduledSeconds - scheduledSeconds) - Math.abs(b.scheduledSeconds - scheduledSeconds),
  )[0] ?? null;
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
        <p className={`${compact ? "text-base" : "text-3xl"} font-bold tabular-nums text-foreground`}>
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
          <span className="text-sm tabular-nums text-muted-foreground line-through">{arrival.scheduledArrivalTime}</span>
        )}
        <span className={`${compact ? "text-base" : "text-3xl"} font-bold tabular-nums ${delayed ? "text-warning" : "text-foreground"}`}>
          {arrival.estimatedArrivalTime}
        </span>
        {arrival.delayMinutes > 5 && (
          <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-xs font-bold text-destructive">Delayed</span>
        )}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        {stale || refreshing ? "Refreshing" : `Live · ${updatedTime ?? `${arrival.minutesAway} min away`}`}
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
      return row ? { expiresOn: row.expires_on as string, daysRemaining: row.days_remaining as number } : null;
    },
  });
  return data ?? null;
}

function expiryLabel(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year!, (month ?? 1) - 1, day ?? 1).toLocaleDateString("en-US", { month: "short", day: "numeric" });
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
  const minutesText = minutesToAlight !== null && minutesToAlight > 0 ? ` · ${minutesToAlight} min` : "";

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
        <button aria-label="Dismiss stop alert" onClick={onDismiss} className="shrink-0 text-muted-foreground">
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
      <p>{expired ? "Transit data expired · times may be wrong" : "Transit schedules expiring soon · data may become inaccurate"}</p>
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
      : detectLocationPlatform(navigator.userAgent, typeof document !== "undefined" && "ontouchend" in document),
  )[0] as ReturnType<typeof detectLocationPlatform>;

  const steps =
    platform === "ios"
      ? {
          label: "iPhone or iPad · Safari",
          body: (
            <>
              Tap the <strong className="font-semibold">aA</strong> or page-settings icon in your address bar, open{" "}
              <strong className="font-semibold">Website Settings</strong>, change{" "}
              <strong className="font-semibold">Location</strong> to <strong className="font-semibold">Allow</strong>,
              then refresh.
            </>
          ),
        }
      : platform === "android"
        ? {
            label: "Chrome · Android",
            body: (
              <>
                Tap the <strong className="font-semibold">tune / lock</strong> icon next to the URL, open{" "}
                <strong className="font-semibold">Permissions</strong>, set{" "}
                <strong className="font-semibold">Location</strong> to <strong className="font-semibold">Allow</strong>,
                then refresh.
              </>
            ),
          }
        : {
            label: "Chrome or Edge · desktop",
            body: (
              <>
                Click the <strong className="font-semibold">lock</strong> icon in the address bar, open{" "}
                <strong className="font-semibold">Site settings</strong>, set{" "}
                <strong className="font-semibold">Location</strong> to <strong className="font-semibold">Allow</strong>,
                then reload.
              </>
            ),
          };

  return (
    <div className="relative rounded-lg border border-chart-4/40 bg-surface-raised p-4 pr-9" role="status">
      <p className="text-sm font-semibold text-foreground">Location is blocked</p>
      <p className="mt-0.5 text-[11px] uppercase tracking-wide text-muted-foreground">{steps.label}</p>
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
function AlertPrefsSection({ prefs, onChange }: { prefs: AlertPrefs; onChange: (next: AlertPrefs) => void }) {
  const rows: { id: keyof AlertPrefs; label: string; hint: string }[] = [
    { id: "sound", label: "Sound alert", hint: "A soft chime when your stop is next." },
    { id: "haptics", label: "Haptic vibration", hint: "Buzz your phone when your stop is next." },
    {
      id: "keepOnTransfer",
      label: "Keep alert on transfer",
      hint: "Stay visible when the trip moves to the next leg.",
    },
  ];
  return (
    <section className="space-y-2 border-t border-border pt-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Stop alerts</p>
      {rows.map((row) => (
        <div key={row.id} className="flex items-center justify-between gap-4 rounded-lg bg-surface-raised px-4 py-3">
          <Label htmlFor={`alert-${row.id}`} className="leading-snug">
            {row.label}
            <span className="mt-0.5 block text-xs font-normal text-muted-foreground">{row.hint}</span>
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
    <p className="mb-4 rounded-lg border border-chart-4/40 px-4 py-3 text-xs text-chart-4" role="status">
      Transit data expires {expiryLabel(expiry.expiresOn)} · refresh needed
    </p>
  );
}

function SetupDialog({ open, firstRun, setup, onClose, onSave, alertPrefs, onAlertPrefsChange, savedPlaces, onPlacesChange }: SetupDialogProps) {

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

  useEffect(() => {
    if (open) {
      setDraft(setup);
      setStatus(null);
      setPlaceQuery("");
      setDebouncedQuery("");
    }
    if (!open) return;
    let cancelled = false;
    if (window.localStorage.getItem(LOCATION_DENIED_KEY) === "1") setPermissionBlocked(true);
    queryLocationPermission().then((state) => {
      if (cancelled) return;
      if (state === "denied") {
        setPermissionBlocked(true);
        window.localStorage.setItem(LOCATION_DENIED_KEY, "1");
      } else if (state === "granted" || state === "prompt") {
        setPermissionBlocked(false);
        window.localStorage.removeItem(LOCATION_DENIED_KEY);
      }
    }).catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [open, setup]);

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


  async function useMyLocation() {
    if (!navigator.geolocation) {
      setStatus("This device cannot share its location. Pick your station below.");
      return;
    }
    // Check without prompting first: if it is already blocked, skip the request
    // and show the recovery steps right away.
    const permission = await queryLocationPermission();
    if (permission === "denied") {
      setPermissionBlocked(true);
      window.localStorage.setItem(LOCATION_DENIED_KEY, "1");
      setStatus("Location is blocked in your browser. Follow the steps below to allow it, or pick your station from the list.");
      return;
    }
    setBusy(true);
    setStatus("Finding your nearest rail station…");
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;
        const { data, error } = await supabase.rpc("nearest_stop", { p_lat: lat, p_lon: lon, p_rail_only: true });
        setBusy(false);
        const nearest = data?.[0];
        if (error || !nearest) {
          setStatus("Could not match a station. Pick one below.");
          return;
        }
        setDraft((current) => ({
          ...current,
          homeLat: lat,
          homeLon: lon,
          homeStopId: nearest.stop_id,
          homeStopName: nearest.stop_name ?? "",
        }));
        const accuracy = position.coords.accuracy;
        const precision = Number.isFinite(accuracy) ? ` Accurate to about ${formatDistance(accuracy)}.` : "";
        setStatus(
          `Home station near you: ${stationLabel(nearest.stop_name)}, a ${formatDistance(nearest.distance_m)} trip from your location.${precision}`,
        );
        // Confirm the exact spot in plain words, so a wrong pin is obvious.
        const address = await lookupAddress({ data: { lat, lon } }).catch(() => null);
        if (address?.label) {
          setStatus(
            `Detected: ${address.label}.${precision} Nearest station: ${stationLabel(nearest.stop_name)}, a ${formatDistance(nearest.distance_m)} trip away.`,
          );
        }
      },
      (error) => {
        setBusy(false);
        if (isPermissionDeniedError(error)) {
          setPermissionBlocked(true);
          window.localStorage.setItem(LOCATION_DENIED_KEY, "1");
          setStatus("Location is blocked in your browser. Follow the steps below to allow it, or pick your station from the list.");
          return;
        }
        setStatus("Location was not shared. Pick your station below.");
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
    );
  }

  /** Use a point as the starting side: remember the door and derive its station. */
  async function applyOrigin(place: PointLike) {
    setBusy(true);
    setStatus("Finding the station nearest that address…");
    try {
      const { data } = await supabase.rpc("nearest_stop", { p_lat: place.lat, p_lon: place.lon, p_rail_only: true });
      const nearest = data?.[0];
      setDraft((current) => ({
        ...current,
        homeLat: place.lat,
        homeLon: place.lon,
        homeStopId: nearest?.stop_id ?? current.homeStopId,
        homeStopName: nearest?.stop_name ?? current.homeStopName,
      }));
      setStatus(
        nearest
          ? `Starting from ${place.name}. Nearest station: ${stationLabel(nearest.stop_name)}.`
          : `Starting from ${place.name}. Pick a station below.`,
      );
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
        supabase.rpc("directional_dest_stop", { p_lat: place.lat, p_lon: place.lon, p_toward_rail: false }),
        supabase.rpc("directional_dest_stop", { p_lat: place.lat, p_lon: place.lon, p_toward_rail: true }),
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
        destStopId: out.stop_id,
        destStopName: out.stop_name ?? "",
        destStopWalkM: Number(out.distance_m),
        destReturnStopId: back.stop_id,
        destReturnStopName: back.stop_name ?? "",
        destReturnWalkM: Number(back.distance_m),
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
      homeLat: draft.homeLat ?? home?.lat ?? null,
      homeLon: draft.homeLon ?? home?.lon ?? null,
    });
  }

  const canSave = hasValidCoordinates({ lat: draft.homeLat, lon: draft.homeLon })
    && hasValidCoordinates({ lat: draft.destLat, lon: draft.destLon });
  const presets = commutePresets(savedPlaces);
  const originPoint: PointLike | null =
    draft.homeLat !== null && draft.homeLon !== null
      ? {
          name: draft.homeStopName ? `Near ${stationLabel(draft.homeStopName)}` : "My starting point",
          address: draft.homeStopName ? `${stationLabel(draft.homeStopName)} area` : "",
          lat: draft.homeLat,
          lon: draft.homeLon,
        }
      : null;
  const destinationPoint: PointLike | null =
    draft.destLat !== null && draft.destLon !== null
      ? { name: draft.destinationName, address: draft.destinationAddress, lat: draft.destLat, lon: draft.destLon }
      : null;
  const selectedStation = stations.find((station) => station.stop_id === draft.homeStopId);
  const setupWalk =
    draft.homeLat !== null &&
    draft.homeLon !== null &&
    selectedStation?.stop_lat !== null &&
    selectedStation?.stop_lat !== undefined &&
    selectedStation.stop_lon !== null &&
    selectedStation.stop_lon !== undefined
      ? walkingEstimate(
          { lat: draft.homeLat, lon: draft.homeLon },
          { lat: Number(selectedStation.stop_lat), lon: Number(selectedStation.stop_lon) },
        )
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
            Nalu needs your starting point and destination once. Guests stay on-device; signing in enables private sync.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5">
          <section className="grid gap-3 rounded-lg border border-border p-4">
            <div className="flex items-center justify-between gap-3">
              <Label className="text-sm">Saved locations</Label>
              {findByKind(savedPlaces, "home") && findByKind(savedPlaces, "work") && (
                <Button variant="ghost" size="sm" onClick={() => onPlacesChange(swapHomeWork(savedPlaces))}>
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
                            onPlacesChange(upsertPlace(savedPlaces, { ...place, label: event.target.value }))
                          }
                          className="h-9 bg-background/60 font-semibold"
                        />
                        <p className="mt-1 truncate text-xs text-muted-foreground">{place.name}</p>
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
                      <Label htmlFor={`arrive-${place.id}`} className="text-xs text-muted-foreground">
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
                      <Button variant="outline" size="sm" disabled={busy} onClick={() => applyOrigin(place)}>
                        Start here
                      </Button>
                      <Button variant="outline" size="sm" disabled={busy} onClick={() => selectPlace(place)}>
                        Go here
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
              <Select value={saveKind} onValueChange={(value) => setSaveKind(value as PlaceKind)}>
                <SelectTrigger className="h-10 w-32 bg-surface-raised"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PLACE_KINDS.map((kind) => (
                    <SelectItem key={kind} value={kind}>{kind === "custom" ? "Custom" : kindLabel(kind)}</SelectItem>
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
                onClick={() => originPoint && savePlace(saveKind, originPoint, parseClockInput(saveTime))}
              >
                Save start
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!destinationPoint}
                onClick={() => destinationPoint && savePlace(saveKind, destinationPoint, parseClockInput(saveTime))}
              >
                Save destination
              </Button>
            </div>
          </section>
          <div className="grid gap-2">
            <Label>Home station</Label>
            <p className="text-sm text-muted-foreground">The station nearest where you live.</p>
            <Button variant="outline" onClick={useMyLocation} disabled={busy} className="h-12 justify-start">
              <LocateFixed className="size-4" /> Use my location
            </Button>
            {permissionBlocked && <LocationBlockedCard onDismiss={() => setPermissionBlocked(false)} />}
            <Select
              value={draft.homeStopId}
              onValueChange={(stopId) =>
                setDraft((current) => ({
                  ...current,
                  homeStopId: stopId,
                  homeStopName: stations.find((station) => station.stop_id === stopId)?.stop_name ?? "",
                }))
              }
            >
              <SelectTrigger className="h-12 bg-surface-raised">
                <SelectValue placeholder="Choose a station" />
              </SelectTrigger>
              <SelectContent>
                {stations.map((station) => (
                  <SelectItem key={station.stop_id} value={station.stop_id}>
                    {stationLabel(station.stop_name)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {setupWalk && (
              <p className="text-sm font-semibold text-foreground">
                Walk to {stationLabel(draft.homeStopName)} Station · {setupWalk.minutes} min · {formatDistance(setupWalk.meters)}
              </p>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="destination">Destination</Label>
            {draft.destinationName ? (
              <div className="flex items-center justify-between gap-3 rounded-lg bg-surface-raised px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{draft.destinationName}</p>
                  {draft.destinationAddress !== draft.destinationName && (
                    <p className="truncate text-xs text-muted-foreground">{draft.destinationAddress}</p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  className="shrink-0"
                  onClick={() => setDraft((current) => ({ ...current, destinationName: "" }))}
                >
                  Change
                </Button>
              </div>
            ) : (
              <>
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
                            <span className="block truncate text-xs text-muted-foreground">{place.address}</span>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {!searching && debouncedQuery.length >= 2 && suggestions.length === 0 && (
                  <p className="text-sm text-muted-foreground">No places matched. Try a different name.</p>
                )}
              </>
            )}
          </div>

          <div className="flex items-center justify-between gap-4 rounded-lg bg-surface-raised px-4 py-3">
            <Label htmlFor="drive" className="leading-snug">
              I can drive to the station
              <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                Lets Nalu use driving for the first leg.
              </span>
            </Label>
            <Switch
              id="drive"
              checked={draft.allowDrive}
              onCheckedChange={(checked) => setDraft((current) => ({ ...current, allowDrive: checked }))}
            />
          </div>

          <Button onClick={save} disabled={!canSave || busy} className="h-12 w-full shadow-none">
            GO
          </Button>

          {!firstRun && permissionBlocked && (
            <section className="space-y-2 border-t border-border pt-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Location</p>
              <LocationBlockedCard onDismiss={() => setPermissionBlocked(false)} />
            </section>
          )}

          {!firstRun && <AlertPrefsSection prefs={alertPrefs} onChange={onAlertPrefsChange} />}

          {!firstRun && <AccountSection />}

          {!firstRun && <AboutSection />}


          {status && <p className="text-sm text-muted-foreground">{status}</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}

const DATA_SOURCES = [
  { label: "Transit schedules: TheBus / Oahu Transit Services (thebus.org)", href: "https://www.thebus.org" },
  { label: "Live bus arrivals: TheBus HEA API", href: "https://hea.thebus.org" },
  { label: "Traffic and drive times: TomTom (tomtom.com)", href: "https://www.tomtom.com" },
  { label: "Weather: National Weather Service / NOAA (weather.gov)", href: "https://www.weather.gov" },
  { label: "Air quality: AirNow / US EPA (airnow.gov)", href: "https://www.airnow.gov" },
];

function AboutSection() {
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  return (
    <div className="border-t border-border pt-8">
      <div className="flex flex-col items-center pb-7 text-center">
        <WaveMark className="h-12 w-auto text-recommended" />
        <p className="mt-3 text-2xl font-bold tracking-wide text-foreground">Nalu</p>
        <p className="mt-1 text-xs text-muted-foreground">version 1.0</p>
        <p className="mt-2 text-sm italic text-muted-foreground">Hawaiian for wave, and to think deeply.</p>
      </div>
      <div className="h-px bg-border/60" />

      <p className="mt-6 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">What is Nalu</p>
      <div className="mt-2 grid gap-2 text-sm leading-relaxed text-muted-foreground">
        <p>
          Nalu helps Oahu commuters decide whether to take Skyline rail or drive, using real-time traffic and live bus
          schedules.
        </p>
        <p>Built for Oahu. Transit data covers TheBus and Skyline rail.</p>
      </div>
      <div className="mt-6 h-px bg-border/60" />

      <p className="mt-6 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Data sources</p>
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

      <p className="mt-6 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Privacy</p>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        Guest trips stay on this device. If you choose to sign in, your profile, saved places, and preferences are stored
        privately so they can sync across your devices. Feedback you submit is sent directly to the Nalu team and not shared.
      </p>
      <div className="mt-6 h-px bg-border/60" />

      <p className="mt-6 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Contact</p>
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

function FeedbackForm({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
                {["Browse mode", "Trip setup", "Verdict", "Departures", "Weather", "Other"].map((part) => (
                  <SelectItem key={part} value={part}>
                    {part}
                  </SelectItem>
                ))}
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
            <Button size="sm" onClick={submit} disabled={!message.trim() || sending} className="shadow-none">
              {sending ? "Sending…" : "Submit"}
            </Button>
          </div>
          {sent && <p className="text-xs text-muted-foreground">Thanks, we read everything.</p>}
          {failed && <p className="text-xs text-muted-foreground">Couldn't send · try HelloNalu14@gmail.com</p>}
        </div>
      )}
    </div>
  );
}

