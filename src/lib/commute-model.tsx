import { Bus, Car, Footprints, TrainFront } from "lucide-react";
import { type MomentConditions } from "@/lib/weather.functions";
import { type EstimateSource } from "@/lib/decision/trip-estimate";
import { filterTransferSanityOptions } from "@/lib/rail/inbound-fallback";
import { preferFewerTransfers, preferLessWalking } from "@/lib/rail/walk-preference";
import { type WeatherLine } from "@/components/commute/H1ConditionsCard";
import { stationLabel, titleCase } from "@/lib/commute-formatting";

export type Setup = {
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

export type Leg = {
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

export type RailLineStation = {
  stop_id: string;
  stop_name: string | null;
  stop_lat: number | null;
  stop_lon: number | null;
  line_sequence: number;
};

export type TransitLegSequence = {
  legIndex: number;
  mode: "bus" | "rail";
  points: Array<{ stopId: string; stopName: string; lat: number; lon: number }>;
};

/** Anything with a name and a point: a suggestion, a saved place, or a draft. */
export type PointLike = { name: string; address: string; lat: number; lon: number };

export type BusStopTarget = {
  stopId: string;
  scheduled: Array<{
    routeShortName: string | null;
    headsign: string | null;
    scheduledSeconds: number;
  }>;
};

export type Option = {
  leave_by_seconds: number;
  depart_seconds: number;
  arrive_seconds: number;
  total_minutes: number;
  legs: Leg[];
};

/** Departure time alone is not unique: distinct routes can leave together. */
export function optionIdentity(option: Option) {
  return `${option.leave_by_seconds}:${option.depart_seconds}:${option.arrive_seconds}:${option.total_minutes}:${option.legs.map((leg) => `${leg.mode}:${leg.route_short ?? ""}:${leg.from_stop_id ?? leg.from ?? ""}:${leg.to_stop_id ?? leg.to ?? ""}`).join("|")}`;
}

export function mergeTransitOptions(...groups: Option[][]): Option[] {
  const unique = new Map<string, Option>();
  const saneOptions = preferFewerTransfers(preferLessWalking(filterTransferSanityOptions(groups.flat())));
  for (const option of saneOptions) unique.set(optionIdentity(option), option);
  return Array.from(unique.values())
    .sort((a, b) => a.arrive_seconds - b.arrive_seconds || a.leave_by_seconds - b.leave_by_seconds)
    .slice(0, 8);
}

export const STORAGE_KEY = "nalu-setup-v3";
export const SETUP_DISMISSED_KEY = "nalu-setup-dismissed-v1";
export const BROWSE_STATION_KEY = "nalu-browse-station-v1";
export const BROWSE_LOCATION_DENIED_KEY = "nalu-browse-location-denied-v1";
export const LOCATION_DENIED_KEY = "nalu-location-denied-v1";
export const KAPOLEI_POINT = { lat: 21.3358, lon: -158.0798 };
export const DOWNTOWN_POINT = { lat: 21.3099, lon: -157.8644 };
export const DIRECTION_KEY = "nalu-direction-v1";
export const PARKED_KEY = "nalu-parked-v1";
export const OVERRIDE_MS = 2 * 60 * 60 * 1000;

export type RailStation = {
  stop_id: string;
  stop_name: string | null;
  stop_lat: number | null;
  stop_lon: number | null;
};

/** Minutes of padding on the rail chain, and how much a transfer can slip. */
export const RAIL_BUFFER_MIN = 3;
export const RAIL_SLIP_MIN = 4;
/** Under this gap, neither option really wins. */
export const TOSS_UP_MIN = 5;
/** A long wait for the first train tips the choice toward the car. */
export const LONG_WAIT_MIN = 25;
export const ACTIVE_TRIP_KEY = "nalu-active-trip-v1";
export const PLAN_MODE_KEY = "nalu-plan-mode-v1";
export const ARRIVE_BY_KEY = "nalu-arrive-by-v1";
export const COMMIT_KEY = "nalu-committed-mode-v1";
export const LOCKED_OPTION_KEY = "nalu-locked-itinerary-v1";
export const LIVE_ROUTE_CACHE_KEY = "nalu-live-route-v1";

/** The mode a commuter has committed to for the trip underway. */
export type Commitment = { mode: "transit" | "drive"; at: number };

export type UiDecisionState = "drive" | "transit" | "same" | "none" | "uncertain";
export type DecisionSnapshot = {
  key: string;
  state: "drive" | "transit" | "same";
  driveMinutes: number | null;
  transitMinutes: number | null;
  driveDelayMinutes: number | null;
  railWaitMinutes: number | null;
  busWaitMinutes: number | null;
  majorIncident: boolean;
};

export function changedMinutes(now: number | null, previous: number | null) {
  if (now === null || previous === null) return null;
  const delta = Math.round(now - previous);
  return Math.abs(delta) >= 2 ? delta : null;
}

export function parseCommitment(raw: string | null): Commitment | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as { mode?: "rail" | "transit" | "drive"; at?: number };
    const mode = value.mode === "rail" ? "transit" : value.mode;
    if (mode !== "transit" && mode !== "drive") return null;
    return { mode, at: typeof value.at === "number" ? value.at : Date.now() };
  } catch {
    return null;
  }
}

export const LEGACY_STORAGE_PREFIX = ["ki", "ne"].join("");

export type DirectionOverride = { inbound: boolean; at: number };
/** Where the car is today for park-and-ride trips: at home or left at a station. */
export type CarPlace = "home" | "station";
export type ParkedCar = { date: string; station: string; place?: CarPlace };
export type BrowseStation = {
  stopId: string;
  stopName: string;
  lat: number;
  lon: number;
  userLat?: number;
  userLon?: number;
};
export type BrowseDeparture = {
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

export type NearbyArrival = {
  departure_seconds: number;
  departure_time: string;
  route_short_name: string | null;
  route_long_name: string | null;
  headsign: string | null;
};

export type NearbyStop = {
  stopId: string;
  stopName: string;
  lat: number;
  lon: number;
  routeType: number;
  distanceM: number;
  arrivals: NearbyArrival[];
};

export type Coords = { lat: number; lon: number };

/** A stretch of the trip spent outside, with where and when it happens. */
export type OutdoorMoment = {
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

/** Rain is worth a word above 40%, or above 50% when the rider is driving. */
export function rainLine(moment: OutdoorMoment, reading: MomentConditions): string | null {
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
        ? `Showers possible while waiting for ${/^[A-Z]?\d{1,3}[A-Z]?$/i.test(moment.label) ? `Route ${moment.label}` : titleCase(moment.label)}`
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
export function heatLine(moment: OutdoorMoment, reading: MomentConditions): WeatherLine | null {
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

export function readJson<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export const emptySetup: Setup = {
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

/** First name from the signed-in profile: full name, then given name, then username. */
export function profileFirstName(
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

export function nearbyServiceLabel(stop: NearbyStop) {
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

/** Short chip title: the station name for rail, the routes that stop here for buses. */
export function nearbyChipTitle(stop: NearbyStop) {
  if (stop.routeType === 1) return stationLabel(stop.stopName) || "Skyline";
  const routes = [
    ...new Set(
      stop.arrivals
        .map((arrival) => arrival.route_short_name?.trim() || arrival.route_long_name?.trim())
        .filter((route): route is string => Boolean(route)),
    ),
  ].slice(0, 3);
  return routes.length ? `Bus ${routes.join(", ")}` : titleCase(stop.stopName);
}

export function vehicleName(leg: Leg) {
  if (leg.mode === "rail") {
    const line = stationLabel(leg.route_long) || "Skyline";
    return leg.headsign ? `${line} (toward ${stationLabel(leg.headsign)})` : line;
  }
  if (leg.mode === "bus") {
    // "Route 42" for TheBus numbers; named lines ("W LINE") read as names.
    const short = leg.route_short?.trim() ?? "";
    const label = !short
      ? "Bus"
      : /^[A-Z]?\d{1,3}[A-Z]?$/i.test(short)
        ? `Route ${short}`
        : titleCase(short);
    return leg.headsign ? `${label} (toward ${titleCase(leg.headsign)})` : label;
  }
  const verb = leg.mode === "drive" ? "Drive" : "Walk";
  // Name both ends: the last leg is only "home" when the trip ends at home.
  const to = titleCase(leg.to);
  if (!to) return leg.kind === "egress" ? `${verb} home` : verb;
  return `${verb} to ${to}`;
}

export function modeIcon(mode: Leg["mode"]) {
  if (mode === "rail") return TrainFront;
  if (mode === "bus") return Bus;
  if (mode === "drive") return Car;
  return Footprints;
}

export function sourceFreshnessLabel(source: EstimateSource, nowMs: number) {
  if (source.quality === "unavailable") {
    return source.basis === "live"
      ? "Live traffic · Not available"
      : "Bus & Skyline times · Not available";
  }
  if (source.fetchedAt === null) {
    return source.basis === "live"
      ? "Live traffic · Update time unknown"
      : "Bus & Skyline times · Update time unknown";
  }

  const ageSeconds = Math.max(0, Math.round((nowMs - source.fetchedAt) / 1000));
  const age =
    ageSeconds < 10
      ? "just now"
      : ageSeconds < 60
        ? `${ageSeconds} sec ago`
        : `${Math.round(ageSeconds / 60)} min ago`;

  let label =
    source.basis === "live"
      ? "Live traffic"
      : source.name.includes("TheBus")
        ? "Bus schedule"
        : "Bus & Skyline times";

  if (source.basis === "future-estimate") label = "Future traffic estimate";

  return `${label} · Updated ${age}${source.quality === "stale" ? " · Stale" : ""}`;
}
