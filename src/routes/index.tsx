import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bus, Car, Check, ChevronRight, Footprints, LocateFixed, RefreshCw, Settings, TrainFront, X } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { searchPlaces, type PlaceSuggestion } from "@/lib/geocode.functions";
import { driveTime, type DriveIncident, type DriveTime } from "@/lib/drive.functions";
import { busArrivals, type BusArrival, type BusArrivalsResult } from "@/lib/bus-arrivals.functions";
import { outdoorConditions, type MomentConditions } from "@/lib/weather.functions";
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
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

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
  from: string | null;
  to: string | null;
  depart_seconds: number | null;
  arrive_seconds: number | null;
  minutes: number | null;
};

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
/** Minutes of padding on the rail chain, and how much a transfer can slip. */
const RAIL_BUFFER_MIN = 3;
const RAIL_SLIP_MIN = 4;
/** Under this gap, neither option really wins. */
const TOSS_UP_MIN = 5;
/** A long wait for the first train tips the choice toward the car. */
const LONG_WAIT_MIN = 25;
const ACTIVE_TRIP_KEY = "nalu-active-trip-v1";
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

type StationAccess = { mode: "walk" | "drive"; minutes: number; state: "ok" | "tight" | "miss" };

/**
 * Can the rider reach the station before a train leaves? Walk at 3 mph within
 * 0.75 miles, otherwise estimate driving at 25 mph. A two-minute buffer at the
 * platform separates "you'll make it" from "tight".
 */
function stationAccess(user: Coords, station: Coords, minutesAway: number): StationAccess {
  const miles = distanceM(user, station) / 1609.344;
  const mode: StationAccess["mode"] = miles <= 0.75 ? "walk" : "drive";
  const minutes = Math.max(1, Math.ceil((miles / (mode === "walk" ? 3 : 25)) * 60));
  const state: StationAccess["state"] =
    minutes + 2 <= minutesAway ? "ok" : minutes <= minutesAway ? "tight" : "miss";
  return { mode, minutes, state };
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

/** Names the road when TomTom gives one, so the banner always says where. */
function incidentText(incident: DriveIncident) {
  return incident.road ? `${incident.description} on ${incident.road}` : `${incident.description} on your route`;
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
}: {
  eastbound: DriveTime | undefined;
  westbound: DriveTime | undefined;
  loading: boolean;
  unavailable: boolean;
  weatherLine?: WeatherLine | null;
}) {
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
  const [now, setNow] = useState(() => new Date());
  const [hydrated, setHydrated] = useState(false);
  const [setup, setSetup] = useState<Setup>(emptySetup);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [override, setOverride] = useState<DirectionOverride | null>(null);
  const [parked, setParked] = useState<ParkedCar | null>(null);
  const [browseStation, setBrowseStation] = useState<BrowseStation | null>(null);
  const [browseLocationDenied, setBrowseLocationDenied] = useState(false);
  const [locationDenied, setLocationDenied] = useState(false);

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
    const setupDismissed = migrateStorage(SETUP_DISMISSED_KEY, "setup-dismissed-v1") === "1";
    if (stored) {
      try {
        const saved = { ...emptySetup, ...(JSON.parse(stored) as Partial<Setup>) };
        // Older saves only kept the address; use it as the display name.
        setSetup({ ...saved, destinationName: saved.destinationName || saved.destinationAddress });
      } catch {
        window.localStorage.removeItem(STORAGE_KEY);
        if (!setupDismissed) setOnboardingOpen(true);
      }
    } else if (!setupDismissed) {
      setOnboardingOpen(true);
    }
    migrateStorage(BROWSE_STATION_KEY, "browse-station-v1");
    migrateStorage(BROWSE_LOCATION_DENIED_KEY, "browse-location-denied-v1");
    migrateStorage(LOCATION_DENIED_KEY, "location-denied-v1");
    migrateStorage(DIRECTION_KEY, "direction-v1");
    migrateStorage(PARKED_KEY, "parked-v1");
    // Trip tracking was removed; clear any trip state left on the phone.
    window.localStorage.removeItem(ACTIVE_TRIP_KEY);
    setHydrated(true);
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

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

  // A manual choice sticks for 2 hours, then the time-of-day default takes over again.
  const overrideActive = Boolean(override && now.getTime() - override.at < OVERRIDE_MS);
  const inbound = overrideActive ? Boolean(override?.inbound) : honoluluParts(now).hour >= 12;

  function chooseDirection(next: boolean) {
    const entry: DirectionOverride = { inbound: next, at: Date.now() };
    setOverride(entry);
    window.localStorage.setItem(DIRECTION_KEY, JSON.stringify(entry));
  }

  function persist(next: Setup) {
    setSetup(next);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
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

  const configured = Boolean(setup.homeStopId && setup.destStopId && setup.destLat && setup.homeLat);
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
  // Driving this direction is only possible if the car is where the trip starts.
  const driveAvailable = Boolean(setup.allowDrive) && (inbound ? carPlace === "destination" : carPlace === "home");
  const carAwayReason = !setup.allowDrive
    ? "Driving is switched off in your settings."
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
          lat,
          lon,
          userLat: lat,
          userLon: lon,
        });
      },
      (error) => {
        setBrowseLocationDenied(true);
        window.localStorage.setItem(BROWSE_LOCATION_DENIED_KEY, "1");
        if (isPermissionDeniedError(error)) recordLocationDenied();
      },
      { timeout: 10_000 },
    );
  }, [browseActive, onboardingOpen, browseStation, browseLocationDenied]);

  const { data: browseStations = [] } = useQuery({
    queryKey: ["browse-rail-stations"],
    enabled: hydrated,
    staleTime: 6 * 60 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("rail_stations");
      if (error) throw error;
      return data ?? [];
    },
  });

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
    ],
    enabled: hydrated && configured,
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
          p_limit: 4,
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
        p_limit: 4,
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
  const alternative = useMemo(() => {
    if (!earliest) return null;
    let pick: Option | null = null;
    for (const option of options.slice(1)) {
      const laterLeave = option.leave_by_seconds - earliest.leave_by_seconds;
      const laterArrive = option.arrive_seconds - earliest.arrive_seconds;
      if (laterLeave < 5 * 60 || laterArrive > 10 * 60) continue;
      if (!pick || option.leave_by_seconds > pick.leave_by_seconds) pick = option;
    }
    return pick;
  }, [options, earliest]);
  const [preferLater, setPreferLater] = useState(false);
  useEffect(() => {
    setPreferLater(false);
  }, [inbound, earliest?.leave_by_seconds, earliest?.arrive_seconds]);
  const best = preferLater && alternative ? alternative : earliest;

  const { data: stationCoords = [] } = useQuery({
    queryKey: ["rail-station-coords"],
    staleTime: 6 * 60 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("rail_stations");
      if (error) throw error;
      return data ?? [];
    },
  });

  function stationPoint(name: string | null | undefined): Coords | null {
    if (!name) return null;
    const wanted = name.trim().toLowerCase();
    const hit = stationCoords.find((station) => (station.stop_name ?? "").trim().toLowerCase() === wanted);
    if (!hit || hit.stop_lat === null || hit.stop_lon === null) return null;
    return { lat: Number(hit.stop_lat), lon: Number(hit.stop_lon) };
  }

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
      () => setRiderPoint(null),
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

  const [alertPrefs, setAlertPrefs] = useState<AlertPrefs>(defaultAlertPrefs);
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
  const {
    data: drive,
    isLoading: driveLoading,
    isError: driveFailed,
  } = useQuery({
    queryKey: ["drive", driveFrom.lat, driveFrom.lon, driveTo.lat, driveTo.lon],
    enabled: hydrated && configured && driveFrom.lat !== null && driveTo.lat !== null,
    staleTime: 3 * 60_000,
    refetchInterval: 3 * 60_000,
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
  const verdict: "rail" | "drive" | "same" | "none" =
    railMinutes === null && !usableDrive
      ? "none"
      : railMinutes === null
        ? "drive"
        : !usableDrive
          ? "rail"
          : Math.abs(gap ?? 0) < TOSS_UP_MIN
              ? "same"
              : (gap ?? 0) > 0
                ? "rail"
                : "drive";
  // One line naming the single thing that decides it.
  const reasoning = useMemo(() => {
    const incident = drive?.incidents[0];
    if (verdict === "drive" && incident) {
      return incidentText(incident);
    }
    if (verdict === "drive" && longWait && waitForTrain !== null) {
      return `Next reachable train is ${waitForTrain} min out`;
    }
    if (best) {
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
    if (incident) return incidentText(incident);
    return null;
  }, [best, drive, verdict, longWait, waitForTrain]);

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
                }${leg.kind === "egress" && leg.mode === "drive" ? " · your car is parked here" : ""}`
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
    persist(next);
    window.localStorage.removeItem(SETUP_DISMISSED_KEY);
    setOnboardingOpen(false);
    setSettingsOpen(false);
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

    return (
      <main className="min-h-dvh bg-page-gradient px-5 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))] text-foreground">
        <div className="mx-auto flex w-full max-w-[440px] flex-col">
          <header className="flex min-h-11 items-start justify-between gap-4">
            <div>
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

          <DataExpiryNotice />


          <H1ConditionsCard
            eastbound={eastboundTraffic}
            westbound={westboundTraffic}
            loading={trafficLoading}
            unavailable={trafficUnavailable}
            weatherLine={browseWeatherLine}
          />

          <Button onClick={() => setOnboardingOpen(true)} className="mt-5 min-h-13 w-full rounded-lg px-5 text-sm font-semibold shadow-none">
            Set up my commute for a door-to-door comparison
          </Button>

          <section className="pb-5 pt-9">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-xl font-semibold text-foreground">
                {browseStation ? `Next trains from ${stationLabel(browseStation.stopName)}` : "Finding your station…"}
              </h2>
              <span className="shrink-0 text-[10px] text-muted-foreground">TheBus / DTS</span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {h1HasMeaningfulDelay
                ? "Skyline runs every 10 min and bypasses the H-1 delay right now."
                : "Skyline rail runs every 10 minutes."}
            </p>
            {browseLocationDenied && browseStation && (
              <p className="mt-1 text-xs text-muted-foreground">Estimated from West Oahu · choose another station below</p>
            )}
            {browseLocationDenied && locationDenied && (
              <button
                type="button"
                onClick={() => setSettingsOpen(true)}
                className="mt-1 block text-xs text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline"
              >
                Location is blocked in your browser · how to allow it
              </button>
            )}
          </section>

          {browseLocationDenied && (
            <section className="pb-7" aria-labelledby="browse-station-title">
              <h3 id="browse-station-title" className="sr-only">Choose another rail station</h3>
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
                  });
                }}
              >
                <SelectTrigger className="h-11 bg-surface-raised">
                  <SelectValue placeholder="Choose another station" />
                </SelectTrigger>
                <SelectContent>
                  {browseStations.map((station) => (
                    <SelectItem key={station.stop_id} value={station.stop_id}>
                      {stationLabel(station.stop_name)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </section>
          )}

          {browseStation && (
            <section
              className={`departures-fade space-y-8 ${refreshing ? "animate-in fade-in duration-300" : ""}`}
              aria-label={`Departures from ${stationLabel(browseStation.stopName)}`}
            >
              {browseDeparturesLoading && <p className="text-sm text-muted-foreground">Loading departures…</p>}
              {!browseDeparturesLoading && browseDirections.length === 0 && (
                <p className="text-sm text-muted-foreground">No rail departures are scheduled from this station right now.</p>
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
                const userLoc =
                  browseStation.userLat != null && browseStation.userLon != null
                    ? { lat: browseStation.userLat, lon: browseStation.userLon }
                    : null;
                const stationRow = browseStations.find((s) => s.stop_id === browseStation.stopId);
                const stationCoords =
                  stationRow?.stop_lat != null && stationRow?.stop_lon != null
                    ? { lat: Number(stationRow.stop_lat), lon: Number(stationRow.stop_lon) }
                    : null;
                const access =
                  userLoc && stationCoords ? stationAccess(userLoc, stationCoords, minutesAway) : null;
                return (
                  <article key={`${first?.route_id}-${first?.direction_id ?? "x"}`} className="border-t border-border pt-5">
                    <h3 className="text-lg font-semibold">toward {directionName}</h3>
                    <p className="mt-0.5 text-sm text-muted-foreground">ends at {endpoint}</p>
                    {first && (
                      <div className="mt-4">
                        <p className="text-3xl font-semibold tabular-nums text-foreground">
                          {nowDeparture ? (
                            <>
                              Now{" "}
                              <span className="text-lg font-normal text-muted-foreground">
                                · {clockFromSeconds(first.departure_seconds)}
                              </span>
                            </>
                          ) : soon ? (
                            <>
                              in {minutesAway} min{" "}
                              <span className="text-lg font-normal text-muted-foreground">
                                · {clockFromSeconds(first.departure_seconds)}
                              </span>
                            </>
                          ) : (
                            clockFromSeconds(first.departure_seconds)
                          )}
                        </p>
                        <p className="mt-1.5 text-xs text-muted-foreground">
                          Skyline rail · toward {directionName} · {first.ride_minutes} min to {towardDowntown ? "downtown" : "Kapolei"}
                        </p>
                        {access && (
                          <p className={`mt-2.5 text-sm font-medium ${access.state === "ok" ? "text-primary" : "text-warning"}`}>
                            You have {minutesAway} min · {stationLabel(browseStation.stopName)} is {access.minutes} min away by{" "}
                            {access.mode}
                            {access.state === "tight" ? " · Tight" : access.state === "miss" ? " · You'll miss this one." : ""}
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
            </section>
          )}
        </div>
        {setupDialog}
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-page-gradient px-5 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))] text-foreground">
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

        <H1ConditionsCard
          eastbound={eastboundTraffic}
          westbound={westboundTraffic}
          loading={eastboundTrafficLoading || westboundTrafficLoading}
          unavailable={
            eastboundTrafficFailed ||
            westboundTrafficFailed ||
            (!(eastboundTrafficLoading || westboundTrafficLoading) && (!eastboundTraffic || !westboundTraffic))
          }
        />

        <section
          className="verdict-lift -mx-3 mt-4 rounded-3xl px-3 py-9 animate-in fade-in duration-300"
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
            className="max-w-[360px] text-[clamp(3.1rem,13vw,4.2rem)] font-bold leading-[0.9] text-foreground"
          >
            {!configured
              ? "SET UP NALU"
              : verdict === "none"
                ? "RAIL UNAVAILABLE"
                : verdict === "same"
                  ? "ABOUT THE SAME"
                  : verdict === "rail"
                    ? "TAKE THE RAIL"
                    : "DRIVE TODAY"}
          </h1>
          {verdict === "rail" && best && (
            <p className="mt-6 text-3xl font-bold text-recommended">
              Leave by {clockFromSeconds(best.leave_by_seconds)} for the train
            </p>
          )}
          {verdict === "drive" && drive && (
            <p className="mt-6 text-3xl font-bold text-recommended">
              Leave now for a ~{drive.trafficMinutes} min drive
            </p>
          )}
          <p className="mt-3 text-lg font-medium text-muted-foreground">
            {best
              ? verdict === "same"
                ? `Rail and driving are within ${TOSS_UP_MIN} min of each other.`
                : verdict === "rail"
                  ? `${gap !== null ? `Rail is ${Math.abs(gap)} min faster than driving · ` : ""}${
                      leaveIn !== null && leaveIn > 0 ? `train in ${leaveIn} min` : "leave now"
                    }`
                  : `${gap !== null ? `Driving is ${Math.abs(gap)} min faster than rail.` : "Driving is the faster available option."}`
              : !configured
                ? "Add your home station and destination to start."
                : optionsLoading
                  ? "Checking today's connections…"
                  : todayHours
                    ? `Rail runs ${clockFromSeconds(todayHours.first_seconds)} to ${clockFromSeconds(
                        todayHours.last_seconds,
                      )} today — no reachable trip with a connection right now.`
                    : "No rail service for this trip today."}
          </p>
          {reasoning && <p className="mt-3 text-base font-medium text-foreground">{reasoning}</p>}
          {activeDestStopName && (
            <p className="mt-3 text-sm text-muted-foreground">
              {inbound
                ? `Bus stop you board near ${destinationLabel}: ${titleCase(activeDestStopName)}`
                : `Bus stop near ${destinationLabel} when you arrive: ${titleCase(activeDestStopName)}`}
              {activeDestWalkM !== null ? `, a ${formatDistance(activeDestWalkM)} walk` : ""}
            </p>
          )}
        </section>

        <section aria-label="Comparison" className="grid grid-cols-2 border-y border-border">
          <article className={`border-r border-border py-7 pr-5 ${verdict === "drive" ? "opacity-55" : ""}`}>
            <p className={`text-xs font-bold uppercase ${verdict === "drive" ? "text-muted-foreground" : "text-recommended"}`}>
              Rail trip
            </p>
            <p
              className={`mt-3 text-5xl font-semibold leading-none ${
                verdict === "drive" ? "text-foreground" : "text-recommended"
              }`}
            >
              {railRange ? railRange.high : "—"}
              <span className="ml-1 text-base font-medium">min</span>
            </p>
            {railRange && (
              <p className="mt-1 text-sm text-muted-foreground">{railRange.low}–{railRange.high} min, worst case first</p>
            )}
            {best ? (
               <RailTripBreakdown option={best} inbound={inbound} liveBus={liveBus} liveBusRefreshing={liveBusRefreshing} />
            ) : (
              <p className="mt-7 text-sm text-muted-foreground">{optionsLoading ? "Building your trip…" : "No rail trip available."}</p>
            )}
          </article>
          <article className={`py-7 pl-5 ${verdict === "drive" ? "" : "opacity-55"}`}>
            <p className={`text-xs font-bold uppercase ${verdict === "drive" ? "text-recommended" : "text-muted-foreground"}`}>
              Drive
            </p>
            <p className="mt-3 text-5xl font-semibold leading-none text-foreground">
              {driveAvailable ? (driveRange ? driveRange.high : driveLoading ? "…" : "—") : "—"}
              {driveAvailable && driveRange && <span className="ml-1 text-base font-medium">min</span>}
            </p>
            {driveAvailable && driveRange && drive && (
              <>
                <p className="mt-1 text-sm text-muted-foreground">
                  {driveRange.low}–{driveRange.high} min
                </p>
                {driveWeatherLines.map((line) => (
                  <p key={line.text} className={`mt-1 text-xs ${TONE_CLASS[line.tone]}`}>
                    {line.text}
                    <span className="ml-1 text-[10px] text-muted-foreground">{line.source}</span>
                  </p>
                ))}
                <p className="mt-1 text-sm text-muted-foreground">
                  {drive.delayMinutes >= 1
                    ? `${drive.trafficMinutes} min now, ${drive.delayMinutes} min slower than usual`
                    : drive.delayMinutes <= -1
                      ? `${drive.trafficMinutes} min now, ${Math.abs(drive.delayMinutes)} min faster than usual`
                      : `${drive.trafficMinutes} min now, about usual for this time`}
                </p>
                <p className="mt-1 text-[10px] text-muted-foreground">Drive time: TomTom</p>
              </>
            )}
            {!driveAvailable && carAwayReason && (
              <p className="mt-2 text-sm text-muted-foreground">{carAwayReason}</p>
            )}
            {driveAvailable && driveFailed && (
              <p className="mt-2 text-sm text-muted-foreground">Live traffic is unavailable right now.</p>
            )}
            {driveAvailable && drive?.incidents[0] ? (
              <p className="mt-3 rounded-lg bg-surface-raised px-3 py-2 text-sm text-foreground">
                {incidentText(drive.incidents[0])}
                {drive.incidents[0].delayMinutes ? ` · +${drive.incidents[0].delayMinutes} min` : ""}
              </p>
            ) : null}
            {driveAvailable && (
            <dl className="mt-7 space-y-4 text-sm">
              <div>
                <dt className="text-muted-foreground">Usually</dt>
                <dd className="mt-1 font-semibold text-foreground">
                  {drive ? `${drive.typicalMinutes} min` : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{inbound ? "From" : "To"}</dt>
                <dd className="mt-1 truncate font-semibold text-foreground">
                  {inbound
                    ? setup.destinationName || setup.destinationAddress || "Your destination"
                    : setup.destinationName || setup.destinationAddress || "Your destination"}
                </dd>
              </div>
            </dl>
            )}
            {!inbound && driveAvailable && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCarPlace("destination")}
                className="mt-4 px-0 text-muted-foreground hover:text-foreground"
              >
                I'm driving all the way
              </Button>
            )}
            {inbound && carPlace === "destination" && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCarPlace("home")}
                className="mt-4 px-0 text-muted-foreground hover:text-foreground"
              >
                My car isn't here
              </Button>
            )}
          </article>
        </section>

        {best && (
          <section className="py-8" aria-labelledby="chain-title">
            <h2 id="chain-title" className="text-lg font-semibold">
              Your next trip
            </h2>
            {earliest && alternative && (
              <div className="mt-4 flex gap-2" role="group" aria-label="Choose a trip">
                <button
                  type="button"
                  aria-pressed={!preferLater}
                  onClick={() => setPreferLater(false)}
                  className={`min-h-11 flex-1 rounded-2xl border px-3 py-2 text-left text-sm ${
                    preferLater ? "border-border text-muted-foreground" : "border-recommended text-foreground"
                  }`}
                >
                  <span className="block font-semibold">Arrive {clockFromSeconds(earliest.arrive_seconds)}</span>
                  <span className="block text-xs text-muted-foreground">
                    Leave {clockFromSeconds(earliest.leave_by_seconds)} · earliest arrival
                  </span>
                </button>
                <button
                  type="button"
                  aria-pressed={preferLater}
                  onClick={() => setPreferLater(true)}
                  className={`min-h-11 flex-1 rounded-2xl border px-3 py-2 text-left text-sm ${
                    preferLater ? "border-recommended text-foreground" : "border-border text-muted-foreground"
                  }`}
                >
                  <span className="block font-semibold">Arrive {clockFromSeconds(alternative.arrive_seconds)}</span>
                  <span className="block text-xs text-muted-foreground">
                    Leave {Math.round((alternative.leave_by_seconds - earliest.leave_by_seconds) / 60)} min later,
                    arrive {Math.round((alternative.arrive_seconds - earliest.arrive_seconds) / 60)} min later
                  </span>
                </button>
              </div>
            )}
            <ol className="mt-5">

              {timeline.map((row, index) => {
                const Icon = modeIcon(row.mode);
                return (
                  <li key={`${row.seconds}-${index}`} className="flex gap-3">
                    <span className="w-[74px] shrink-0 pt-0.5 text-sm font-semibold tabular-nums text-foreground">
                      {clockFromSeconds(row.seconds)}
                    </span>
                    <span className="flex flex-col items-center pt-1">
                      <span
                        className={`flex size-5 items-center justify-center rounded-full ${
                          index === 0 || index === timeline.length - 1
                            ? "bg-recommended text-recommended-foreground"
                            : "bg-surface-raised text-muted-foreground"
                        }`}
                      >
                        <Icon className="size-3" />
                      </span>
                      {index < timeline.length - 1 && <span className="w-px flex-1 bg-border" />}
                    </span>
                    <span className="flex-1 pb-6">
                      <span className="block text-[15px] font-semibold text-foreground">{row.title}</span>
                      {row.boardAt ? (
                        <span className="mt-2 block space-y-1.5">
                          <span className="block text-sm font-semibold text-foreground">
                            Board at: {row.boardAt}
                          </span>
                          <span className="flex flex-wrap items-baseline justify-between gap-2 rounded-md border border-recommended/50 bg-recommended/10 px-2.5 py-2 text-sm font-bold text-foreground">
                            <span>Get off at: {row.getOffAt}</span>
                            <span className="shrink-0 tabular-nums">{clockFromSeconds(row.arriveSeconds)}</span>
                          </span>
                        </span>
                      ) : (
                        <span className="mt-0.5 block text-sm font-semibold text-foreground">{row.detail}</span>
                      )}
                      {(weatherLines.get(row.legIndex) ?? []).map((line) => (
                        <span key={line.text} className={`mt-1 block text-xs ${TONE_CLASS[line.tone]}`}>
                          {line.text}
                          <span className="ml-1 text-[10px] text-muted-foreground">{line.source}</span>
                        </span>
                      ))}
                    </span>
                  </li>
                );
              })}
            </ol>
          </section>
        )}

        <section className="pb-8" aria-labelledby="later-title">
          <div className="mb-4">
            <h2 id="later-title" className="text-lg font-semibold">
              Later options
            </h2>
            <p className="mt-1 truncate text-sm text-muted-foreground">
              {inbound
                ? `Via ${stationLabel(setup.homeStopName)}`
                : stationLabel(setup.homeStopName) || "No station set"}
            </p>
          </div>
          <ol className="divide-y divide-border">
            {options.filter((option) => option !== best).map((option, index) => (
              <li key={`${option.leave_by_seconds}-${index}`} className="flex min-h-14 items-center justify-between gap-3 py-2">
                <span className="font-medium tabular-nums text-foreground">
                  Leave {clockFromSeconds(option.leave_by_seconds)}
                </span>
                <span className="truncate text-sm text-muted-foreground">
                  {option.legs[0] ? vehicleName(option.legs[0]) : ""}
                </span>
                <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
                  Arrive {clockFromSeconds(option.arrive_seconds)} · {option.total_minutes} min
                </span>
              </li>
            ))}
            {options.length <= 1 && (
              <li className="py-3 text-sm text-muted-foreground">
                {!configured
                  ? "Finish setup to see options."
                  : optionsLoading
                    ? "Loading schedule…"
                    : "No other reachable trip with a connection today."}
              </li>
            )}
          </ol>
        </section>

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
}: {
  option: Option;
  inbound: boolean;
  liveBus: BusArrivalsResult | undefined;
  liveBusRefreshing: boolean;
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
          ? stationName ? `To ${stationName} Station` : "To the station"
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
              {leg.mode === "bus" ? (
                <div className="mt-2">
                  {waitMinutes > 0 && <p className="text-xs font-semibold text-foreground">Transfer walk/wait · {waitMinutes} min</p>}
                  <p className="text-sm font-semibold text-foreground">Board at: {transitStopName(leg, "from")}</p>
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
                  <p className="mt-1 text-xs font-semibold text-foreground">Ride {legMinutes ?? "—"} min</p>
                </div>
              ) : leg.mode === "rail" ? (
                <div className="mt-2 space-y-1.5">
                  <p className="text-sm font-semibold text-foreground">
                    Board at: {transitStopName(leg, "from")} · {clockFromSeconds(leg.depart_seconds)}
                  </p>
                  <p className="flex flex-wrap items-baseline justify-between gap-2 rounded-md border border-recommended/50 bg-recommended/10 px-2.5 py-2 text-sm font-bold text-foreground">
                    <span>Get off at: {transitStopName(leg, "to")}</span>
                    <span className="shrink-0 tabular-nums">{clockFromSeconds(leg.arrive_seconds)}</span>
                  </p>
                </div>
              ) : (
                <p className="mt-1 text-xs font-semibold leading-relaxed text-foreground">
                  {`Arrive ${arrivalLabel} ${clockFromSeconds(leg.arrive_seconds)}`}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
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

function SetupDialog({ open, firstRun, setup, onClose, onSave, alertPrefs, onAlertPrefsChange }: SetupDialogProps) {

  const findPlaces = useServerFn(searchPlaces);
  const [draft, setDraft] = useState<Setup>(setup);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [placeQuery, setPlaceQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  // Whether the browser currently blocks location, so recovery steps can be shown.
  const [permissionBlocked, setPermissionBlocked] = useState(false);

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

  const { data: stations = [] } = useQuery({
    queryKey: ["rail-stations"],
    enabled: open,
    staleTime: 6 * 60 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("rail_stations");
      if (error) throw error;
      return data ?? [];
    },
  });

  async function useMyLocation() {
    if (!navigator.geolocation) {
      setStatus("This device cannot share its location. Pick your station below.");
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
        setStatus(
          `Home station near you: ${stationLabel(nearest.stop_name)}, a ${formatDistance(nearest.distance_m)} trip from your location.`,
        );
      },
      () => {
        setBusy(false);
        setStatus("Location was not shared. Pick your station below.");
      },
      { timeout: 10_000 },
    );
  }

  async function selectPlace(place: PlaceSuggestion) {
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
      setStatus(
        `Bus stop near ${place.name}: ${titleCase(out.stop_name)}, a ${formatDistance(Number(out.distance_m))} walk.`,
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Place search failed.");
    } finally {
      setBusy(false);
    }
  }

  function save() {
    const station = stations.find((item) => item.stop_id === draft.homeStopId);
    onSave({
      ...draft,
      // Without a shared location, treat the chosen station as the starting point.
      homeLat: draft.homeLat ?? (station?.stop_lat ? Number(station.stop_lat) : null),
      homeLon: draft.homeLon ?? (station?.stop_lon ? Number(station.stop_lon) : null),
    });
  }

  const canSave = Boolean(draft.homeStopId && draft.destStopId && draft.destLat);

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
          <DialogTitle className="text-2xl">{firstRun ? "Set up your trip" : "Your trip"}</DialogTitle>
          <DialogDescription>
            Nalu needs your starting point and destination once. Everything stays on this device.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5">
          <div className="grid gap-2">
            <Label>Home station</Label>
            <p className="text-sm text-muted-foreground">The station nearest where you live.</p>
            <Button variant="outline" onClick={useMyLocation} disabled={busy} className="h-12 justify-start">
              <LocateFixed className="size-4" /> Use my location
            </Button>
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
            {draft.destStopName && (
              <p className="text-sm text-muted-foreground">
                Bus stop near {draft.destinationName || "your destination"} when you arrive:{" "}
                {titleCase(draft.destStopName)}
                {typeof draft.destStopWalkM === "number" ? `, a ${formatDistance(draft.destStopWalkM)} walk` : ""}
              </p>
            )}
            {draft.destReturnStopName && (
              <p className="text-sm text-muted-foreground">
                Stop you board for the trip home: {titleCase(draft.destReturnStopName)}
                {typeof draft.destReturnWalkM === "number"
                  ? `, a ${formatDistance(draft.destReturnWalkM)} walk from ${draft.destinationName || "your destination"}`
                  : ""}
              </p>
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

          {!firstRun && <AlertPrefsSection prefs={alertPrefs} onChange={onAlertPrefsChange} />}

          {!firstRun && <AboutSection />}


          {status && <p className="text-sm text-muted-foreground">{status}</p>}
        </div>

        <DialogFooter>
          <Button onClick={save} disabled={!canSave || busy} className="h-12 w-full shadow-none">
            Save trip
          </Button>
        </DialogFooter>
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
        Nalu does not collect or store your personal data. Your home station, destination, and preferences stay on this
        device only. Feedback you submit is sent directly to the Nalu team and not shared.
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
  const [message, setMessage] = useState("");
  const [component, setComponent] = useState("");
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (open) {
      setSent(false);
      setFailed(false);
    }
  }, [open]);

  async function submit() {
    if (!message.trim() || sending) return;
    setSending(true);
    setFailed(false);
    try {
      const response = await fetch(FEEDBACK_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ message: message.trim(), component, email: email.trim() || undefined }),
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

