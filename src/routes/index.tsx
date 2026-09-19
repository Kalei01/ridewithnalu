import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bus, Car, Check, Footprints, LocateFixed, RefreshCw, Settings, TrainFront } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { searchPlaces, type PlaceSuggestion } from "@/lib/geocode.functions";
import { driveTime, type DriveIncident } from "@/lib/drive.functions";
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

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Kine — Rail or drive today?" },
      { name: "description", content: "Your quick commute decision between West Oahu and Honolulu." },
      { property: "og:title", content: "Kine — Rail or drive today?" },
      { property: "og:description", content: "Your quick commute decision between West Oahu and Honolulu." },
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
  busRouteId: string | null;
  /** Shown beside each option; never folded into the verdict. */
  parkingCost: number | null;
  railFare: number | null;
  /** Minutes to park and walk in when arriving at the destination. */
  parkingBufferMinutes: number;
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

type Option = {
  leave_by_seconds: number;
  depart_seconds: number;
  arrive_seconds: number;
  total_minutes: number;
  legs: Leg[];
};

const STORAGE_KEY = "kine-setup-v3";
const SETUP_DISMISSED_KEY = "kine-setup-dismissed-v1";
const BROWSE_STATION_KEY = "kine-browse-station-v1";
const BROWSE_LOCATION_DENIED_KEY = "kine-browse-location-denied-v1";
const DIRECTION_KEY = "kine-direction-v1";
const PARKED_KEY = "kine-parked-v1";
const OVERRIDE_MS = 2 * 60 * 60 * 1000;
/** Minutes of padding on the rail chain, and how much a transfer can slip. */
const RAIL_BUFFER_MIN = 3;
const RAIL_SLIP_MIN = 4;
/** Under this gap, neither option really wins. */
const TOSS_UP_MIN = 5;
/** A long wait for the first train tips the choice toward the car. */
const LONG_WAIT_MIN = 25;
const ACTIVE_TRIP_KEY = "kine-active-trip-v1";
/** A trip clears itself after this long, even if the phone never saw the arrival. */
const TRIP_MAX_MS = 3 * 60 * 60 * 1000;
/** How long the arrival card stays up before the trip collapses on its own. */
const ARRIVED_CLEAR_MS = 10 * 60 * 1000;
/** Treated as "you are here" for stations and the destination. */
const AT_PLACE_M = 250;

type DirectionOverride = { inbound: boolean; at: number };
/** Where the car is today: at home, left at the station, or driven all the way. */
type CarPlace = "home" | "station" | "destination";
type ParkedCar = { date: string; station: string; place?: CarPlace };
type BrowseStation = { stopId: string; stopName: string; lat: number; lon: number };
type BrowseDeparture = {
  departure_seconds: number;
  departure_time: string;
  route_id: string;
  route_long_name: string;
  route_short_name: string;
  stop_name: string;
  trip_headsign: string;
  trip_id: string;
};

/** A trip the rider is actually on: the plan they boarded plus when it started. */
type ActiveTrip = {
  startedAt: number;
  inbound: boolean;
  legs: Leg[];
  departSeconds: number;
  arriveSeconds: number;
  homeStopId: string;
  destStopId: string;
};

type TripPhase = "boarding" | "rail" | "transfer" | "arrived";

type Coords = { lat: number; lon: number };

type ConnectingDeparture = {
  stop_id: string;
  stop_name: string;
  distance_m: number;
  walk_minutes: number;
  route_id: string;
  route_short_name: string | null;
  route_long_name: string | null;
  headsign: string | null;
  depart_seconds: number;
  arrive_seconds: number;
  ride_minutes: number;
  dest_stop_name: string | null;
};

/** Straight-line metres between two points; good enough to tell "am I there yet". */
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
  busRouteId: null,
  parkingCost: null,
  railFare: null,
  parkingBufferMinutes: 8,
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

function titleCase(value: string | null | undefined) {
  if (!value) return "";
  return value.toLowerCase().replace(/\b([a-z])/g, (match) => match.toUpperCase());
}

/** US customary distance: feet under 0.1 miles, otherwise miles to one decimal. */
function formatDistance(meters: number) {
  const miles = meters / 1609.344;
  if (miles < 0.1) return `${Math.round(meters * 3.28084 / 10) * 10} ft`;
  return `${miles.toFixed(1)} miles`;
}

function vehicleName(leg: Leg) {
  if (leg.mode === "rail") {
    const line = titleCase(leg.route_long) || "Skyline";
    return leg.headsign ? `${line} to ${titleCase(leg.headsign)}` : line;
  }
  if (leg.mode === "bus") {
    const label = leg.route_short ? `Route ${leg.route_short}` : "Bus";
    return leg.headsign ? `${label} to ${titleCase(leg.headsign)}` : label;
  }
  const verb = leg.mode === "drive" ? "Drive" : "Walk";
  if (leg.kind === "egress") return `${verb} home`;
  return `${verb} to ${titleCase(leg.to)}`;
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

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    const setupDismissed = window.localStorage.getItem(SETUP_DISMISSED_KEY) === "1";
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
    setBrowseStation(readJson<BrowseStation>(BROWSE_STATION_KEY));
    setBrowseLocationDenied(window.localStorage.getItem(BROWSE_LOCATION_DENIED_KEY) === "1");
    setOverride(readJson<DirectionOverride>(DIRECTION_KEY));
    setParked(readJson<ParkedCar>(PARKED_KEY));
    setHydrated(true);
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

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
  // Where today's car is. Yesterday's note is stale, so the car starts at home.
  const parkedToday = parked && parked.date === honoluluDateKey(now) ? parked : null;
  const carPlace: CarPlace = parkedToday?.place ?? (parkedToday ? "station" : "home");
  const carAtStation = Boolean(
    setup.allowDrive && carPlace === "station" && parkedToday?.station === setup.homeStopId,
  );
  // Driving this direction is only possible if the car is where the trip starts.
  const driveAvailable = Boolean(setup.allowDrive) && (inbound ? carPlace === "destination" : carPlace === "home");
  const carAwayReason = !setup.allowDrive
    ? "Driving is switched off in your settings."
    : inbound && carPlace === "station"
      ? `Your car is at ${titleCase(parkedToday?.station === setup.homeStopId ? setup.homeStopName : "your station")}.`
      : inbound && carPlace === "home"
        ? "Your car is at home."
        : !inbound && carPlace === "station"
          ? `Your car is at ${titleCase(setup.homeStopName)}.`
          : !inbound && carPlace === "destination"
            ? `Your car is at ${setup.destinationName || "your destination"}.`
            : null;

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
        });
      },
      () => {
        setBrowseLocationDenied(true);
        window.localStorage.setItem(BROWSE_LOCATION_DENIED_KEY, "1");
      },
      { timeout: 10_000 },
    );
  }, [browseActive, onboardingOpen, browseStation, browseLocationDenied]);

  const { data: browseStations = [] } = useQuery({
    queryKey: ["browse-rail-stations"],
    enabled: browseActive,
    staleTime: 6 * 60 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("rail_stations");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: browseDepartures = [], isLoading: browseDeparturesLoading } = useQuery({
    queryKey: ["browse-departures", browseStation?.stopId, Math.floor(afterSeconds / 60)],
    enabled: browseActive && Boolean(browseStation?.stopId),
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("rail_departures", {
        p_home_stop: browseStation?.stopId as string,
        p_after_seconds: afterSeconds,
        p_limit: 4,
      });
      if (error) throw error;
      return (data ?? []) as BrowseDeparture[];
    },
  });

  const browseDirections = useMemo(() => {
    const groups = new Map<string, BrowseDeparture[]>();
    for (const departure of browseDepartures) {
      const key = departure.trip_headsign || departure.route_long_name || departure.route_id;
      const group = groups.get(key) ?? [];
      if (group.length < 4) group.push(departure);
      groups.set(key, group);
    }
    return Array.from(groups.values()).slice(0, 2);
  }, [browseDepartures]);

  const { data: options = [], isLoading: optionsLoading } = useQuery({
    queryKey: [
      "trip",
      inbound ? "inbound" : "outbound",
      setup.homeStopId,
      setup.destStopId,
      setup.busRouteId,
      setup.allowDrive,
      carAtStation,
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
        p_allow_drive: setup.allowDrive,
        p_after_seconds: afterSeconds,
        p_limit: 4,
        ...(setup.busRouteId ? { p_bus_route_id: setup.busRouteId } : {}),
      });
      if (error) throw error;
      return (data ?? []).map((row) => ({ ...row, legs: row.legs as unknown as Leg[] })) as Option[];
    },
  });

  // Remember when the outbound plan drives to the station, so the return leg drives home.
  const outboundAccessMode = !inbound ? options[0]?.legs?.[0]?.mode : undefined;
  useEffect(() => {
    if (outboundAccessMode !== "drive" || !setup.homeStopId) return;
    const entry: ParkedCar = { date: honoluluDateKey(new Date()), station: setup.homeStopId, place: "station" };
    setParked((current) =>
      current && current.date === entry.date && current.station === entry.station && current.place === "station"
        ? current
        : entry,
    );
    window.localStorage.setItem(PARKED_KEY, JSON.stringify(entry));
  }, [outboundAccessMode, setup.homeStopId]);

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
  const best = options[0];
  // Rail total carries a safety buffer, and a range for transfers that slip.
  const railMinutes = best ? best.total_minutes + RAIL_BUFFER_MIN : null;
  const railRange = railMinutes === null ? null : { low: railMinutes - 1, high: railMinutes + RAIL_SLIP_MIN };
  // Parking only costs time where you have to park: nothing when you get home.
  const parkingBuffer = inbound ? 0 : Math.max(0, setup.parkingBufferMinutes ?? 8);
  const driveMinutes = drive ? drive.trafficMinutes + parkingBuffer : null;
  const driveRange = drive ? { low: drive.freeflowMinutes + parkingBuffer, high: drive.trafficMinutes + parkingBuffer } : null;
  const leaveIn = best ? Math.round((best.leave_by_seconds - nowSeconds) / 60) : null;
  const waitForTrain = best ? Math.round((best.leave_by_seconds - nowSeconds) / 60) : null;
  const longWait = waitForTrain !== null && waitForTrain > LONG_WAIT_MIN;

  const usableDrive = driveAvailable && driveMinutes !== null;
  const gap = railMinutes !== null && driveMinutes !== null ? driveMinutes - railMinutes : null;
  const verdict: "rail" | "drive" | "same" | "none" =
    railMinutes === null && !usableDrive
      ? "none"
      : railMinutes === null
        ? "drive"
        : !usableDrive
          ? "rail"
          : longWait
            ? "drive"
            : Math.abs(gap ?? 0) < TOSS_UP_MIN
              ? "same"
              : (gap ?? 0) > 0
                ? "rail"
                : "drive";
  const railWins = verdict === "rail";

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
    if (drive && drive.delayMinutes >= 5) return `Traffic is adding ${drive.delayMinutes} min to the drive`;
    if (incident) return incidentText(incident);
    return null;
  }, [best, drive, verdict, longWait, waitForTrain]);

  const destinationLabel = setup.destinationName || setup.destinationAddress || "your destination";
  // A stop serves one direction, so the arriving stop and the boarding stop differ.
  const activeDestStopName = inbound ? setup.destReturnStopName || setup.destStopName : setup.destStopName;
  const rawWalkM = inbound ? (setup.destReturnWalkM ?? setup.destStopWalkM) : setup.destStopWalkM;
  const activeDestWalkM = typeof rawWalkM === "number" ? rawWalkM : null;

  function money(value: number | null) {
    if (value === null || Number.isNaN(value)) return null;
    return `$${value.toFixed(2)}`;
  }

  const timeline = useMemo(() => {
    if (!best) return [];
    const rows = best.legs.map((leg) => ({
      seconds: leg.depart_seconds,
      title: vehicleName(leg),
      detail:
        leg.mode === "walk" || leg.mode === "drive"
          ? `${leg.minutes} min from ${titleCase(leg.from) || "your location"} to ${
              titleCase(leg.to) || (inbound ? "home" : "your destination")
            }${leg.kind === "egress" && leg.mode === "drive" ? " · your car is parked here" : ""}`
          : `${titleCase(leg.from)} → ${titleCase(leg.to)}`,
      mode: leg.mode,
    }));
    const last = best.legs[best.legs.length - 1];
    rows.push({
      seconds: last?.arrive_seconds ?? null,
      title: inbound ? "Arrive home" : "Arrive destination",
      detail: titleCase(last?.to) || setup.destinationName || setup.destinationAddress,
      mode: "walk" as Leg["mode"],
    });
    return rows;
  }, [best, inbound, setup.destinationName, setup.destinationAddress]);

  function refresh() {
    setRefreshing(true);
    window.setTimeout(() => {
      setNow(new Date());
      setRefreshing(false);
    }, 450);
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
    <SetupDialog open={onboardingOpen || settingsOpen} firstRun={onboardingOpen} setup={setup} onClose={closeSetup} onSave={saveSetup} />
  );

  if (browseActive) {
    return (
      <main className="min-h-dvh bg-background px-5 pb-28 pt-[max(1.5rem,env(safe-area-inset-top))] text-foreground">
        <div className="mx-auto flex w-full max-w-[440px] flex-col">
          <header className="flex min-h-11 items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase text-muted-foreground">Rail departures</p>
              <p className="mt-1 text-[15px] font-medium text-foreground">{timeText}</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Refresh departures"
              onClick={refresh}
              disabled={refreshing}
              className="rounded-full text-muted-foreground hover:text-foreground"
            >
              <RefreshCw className={refreshing ? "animate-spin" : ""} />
            </Button>
          </header>

          <section className="py-10">
            <h1 className="text-[clamp(2.6rem,11vw,3.8rem)] font-bold leading-[0.95] text-foreground">
              {browseStation ? titleCase(browseStation.stopName) : "CHOOSE STATION"}
            </h1>
            <p className="mt-4 text-base font-medium text-muted-foreground">
              Add a destination to unlock the rail-versus-drive comparison.
            </p>
          </section>

          {browseLocationDenied && (
            <section className="pb-6" aria-labelledby="browse-station-title">
              <h2 id="browse-station-title" className="text-sm font-semibold text-foreground">
                Choose your nearest station
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">Location is unavailable, so pick a station instead.</p>
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
                <SelectTrigger className="mt-3 h-12 bg-surface-raised">
                  <SelectValue placeholder="Choose a station" />
                </SelectTrigger>
                <SelectContent>
                  {browseStations.map((station) => (
                    <SelectItem key={station.stop_id} value={station.stop_id}>
                      {titleCase(station.stop_name)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </section>
          )}

          {!browseStation && !browseLocationDenied && (
            <p className="pb-6 text-sm text-muted-foreground">Finding your nearest station…</p>
          )}

          {browseStation && (
            <section className="space-y-8" aria-label={`Departures from ${browseStation.stopName}`}>
              {browseDeparturesLoading && <p className="text-sm text-muted-foreground">Loading departures…</p>}
              {!browseDeparturesLoading && browseDirections.length === 0 && (
                <p className="text-sm text-muted-foreground">No rail departures are scheduled from this station right now.</p>
              )}
              {browseDirections.map((direction) => {
                const first = direction[0];
                const directionName = first?.trip_headsign
                  ? `${titleCase(first.route_long_name)} to ${titleCase(first.trip_headsign)}`
                  : titleCase(first?.route_long_name) || "Rail departures";
                return (
                  <article key={first?.trip_headsign || first?.route_id} className="border-t border-border pt-5">
                    <h2 className="text-lg font-semibold">{directionName}</h2>
                    <ol className="mt-3 divide-y divide-border">
                      {direction.map((departure) => (
                        <li key={departure.trip_id} className="flex min-h-14 items-center justify-between gap-4 py-2">
                          <span className="text-xl font-semibold tabular-nums text-foreground">
                            {clockFromSeconds(departure.departure_seconds)}
                          </span>
                          <span className="text-sm text-muted-foreground">Scheduled</span>
                        </li>
                      ))}
                    </ol>
                  </article>
                );
              })}
            </section>
          )}
        </div>

        <div className="fixed inset-x-5 bottom-[max(1.25rem,env(safe-area-inset-bottom))] mx-auto max-w-[440px]">
          <Button onClick={() => setOnboardingOpen(true)} className="h-13 w-full rounded-full text-base shadow-none">
            Set up my commute
          </Button>
        </div>
        {setupDialog}
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-background px-5 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))] text-foreground">
      <div className="mx-auto flex w-full max-w-[440px] flex-col">
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
            <p className="text-xs font-semibold uppercase text-muted-foreground">
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

        <section className="py-10" aria-labelledby="verdict-title">
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
              ? "SET UP KINE"
              : verdict === "none"
                ? "RAIL UNAVAILABLE"
                : verdict === "same"
                  ? "ABOUT THE SAME"
                  : verdict === "rail"
                    ? "TAKE THE RAIL"
                    : "DRIVE TODAY"}
          </h1>
          {best && (
            <p className={`mt-6 text-3xl font-bold ${verdict === "drive" ? "text-muted-foreground" : "text-recommended"}`}>
              Leave by {clockFromSeconds(best.leave_by_seconds)}
              {verdict === "drive" ? " for the train" : ""}
            </p>
          )}
          <p className="mt-3 text-lg font-medium text-muted-foreground">
            {best
              ? verdict === "same"
                ? `Rail and driving land within ${TOSS_UP_MIN} min of each other${
                    leaveIn !== null && leaveIn > 0 ? ` · train in ${leaveIn} min` : ""
                  }`
                : `${
                    gap !== null ? `${Math.abs(gap)} min ${railWins ? "faster" : "slower"} than driving · ` : ""
                  }${leaveIn !== null && leaveIn > 0 ? `train in ${leaveIn} min` : "leave now"}`
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
            <dl className="mt-7 space-y-4 text-sm">
              <div>
                <dt className="text-muted-foreground">Train departs</dt>
                <dd className="mt-1 font-semibold text-foreground">
                  {best ? clockFromSeconds(best.depart_seconds) : optionsLoading ? "…" : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">First leg</dt>
                <dd className="mt-1 font-semibold text-foreground">
                  {best?.legs[0] ? vehicleName(best.legs[0]) : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Fare</dt>
                <dd className="mt-1 font-semibold text-foreground">{money(setup.railFare) ?? "Not set"}</dd>
              </div>
            </dl>
          </article>
          <article className={`py-7 pl-5 ${verdict === "drive" ? "" : "opacity-55"}`}>
            <p className={`text-xs font-bold uppercase ${verdict === "drive" ? "text-recommended" : "text-muted-foreground"}`}>
              Drive
            </p>
            <p className="mt-3 text-5xl font-semibold leading-none text-foreground">
              {driveAvailable ? (driveRange ? driveRange.high : driveLoading ? "…" : "—") : "—"}
              {driveAvailable && driveRange && <span className="ml-1 text-base font-medium">min</span>}
            </p>
            {driveAvailable && driveRange && (
              <p className="mt-1 text-sm text-muted-foreground">
                {driveRange.low}–{driveRange.high} min
                {parkingBuffer > 0 ? ` incl. ${parkingBuffer} min parking` : ""}
              </p>
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
            <dl className="mt-7 space-y-4 text-sm">
              <div>
                <dt className="text-muted-foreground">Traffic delay</dt>
                <dd className="mt-1 font-semibold text-foreground">
                  {drive ? (drive.delayMinutes > 0 ? `+${drive.delayMinutes} min` : "Clear") : "—"}
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
              <div>
                <dt className="text-muted-foreground">Parking</dt>
                <dd className="mt-1 font-semibold text-foreground">
                  {inbound ? "None at home" : (money(setup.parkingCost) ?? "Not set")}
                </dd>
              </div>
            </dl>
            {!inbound && setup.allowDrive && carPlace !== "destination" && (
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
                      <span className="block text-[15px] font-medium text-foreground">{row.title}</span>
                      <span className="mt-0.5 block text-sm text-muted-foreground">{row.detail}</span>
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
                ? `Via ${titleCase(setup.homeStopName)}`
                : titleCase(setup.homeStopName) || "No station set"}
            </p>
          </div>
          <ol className="divide-y divide-border">
            {options.slice(1).map((option, index) => (
              <li key={`${option.leave_by_seconds}-${index}`} className="flex min-h-14 items-center justify-between gap-3 py-2">
                <span className="font-medium tabular-nums text-foreground">
                  Leave {clockFromSeconds(option.leave_by_seconds)}
                </span>
                <span className="truncate text-sm text-muted-foreground">
                  {option.legs[0] ? vehicleName(option.legs[0]) : ""}
                </span>
                <span className="shrink-0 text-sm text-muted-foreground">{option.total_minutes} min</span>
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

type SetupDialogProps = {
  open: boolean;
  firstRun: boolean;
  setup: Setup;
  onClose: () => void;
  onSave: (next: Setup) => void;
};

function SetupDialog({ open, firstRun, setup, onClose, onSave }: SetupDialogProps) {
  const findPlaces = useServerFn(searchPlaces);
  const [draft, setDraft] = useState<Setup>(setup);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [placeQuery, setPlaceQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  useEffect(() => {
    if (open) {
      setDraft(setup);
      setStatus(null);
      setPlaceQuery("");
      setDebouncedQuery("");
    }
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

  const { data: destRoutes = [] } = useQuery({
    queryKey: ["dest-routes", draft.destStopId],
    enabled: open && Boolean(draft.destStopId),
    staleTime: 60 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("routes_serving_stop", { p_stop_id: draft.destStopId });
      if (error) throw error;
      return (data ?? []).filter((route) => route.route_type !== 1);
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
          `Home station near you: ${titleCase(nearest.stop_name)}, a ${formatDistance(nearest.distance_m)} trip from your location.`,
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
        busRouteId: null,
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
        <DialogHeader className="text-left">
          <DialogTitle className="text-2xl">{firstRun ? "Set up your trip" : "Your trip"}</DialogTitle>
          <DialogDescription>
            Kine needs your starting point and destination once. Everything stays on this device.
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
                    {titleCase(station.stop_name)}
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
                  placeholder="Ala Moana Center, 1000 Bishop St…"
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
                Lets Kine use driving for the first leg.
              </span>
            </Label>
            <Switch
              id="drive"
              checked={draft.allowDrive}
              onCheckedChange={(checked) => setDraft((current) => ({ ...current, allowDrive: checked }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="fare">Rail fare</Label>
              <Input
                id="fare"
                type="number"
                inputMode="decimal"
                step="0.25"
                min="0"
                className="h-12 bg-surface-raised"
                value={draft.railFare ?? ""}
                placeholder="3.00"
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    railFare: event.target.value === "" ? null : Number(event.target.value),
                  }))
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="parking-cost">Parking cost</Label>
              <Input
                id="parking-cost"
                type="number"
                inputMode="decimal"
                step="0.25"
                min="0"
                className="h-12 bg-surface-raised"
                value={draft.parkingCost ?? ""}
                placeholder="15.00"
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    parkingCost: event.target.value === "" ? null : Number(event.target.value),
                  }))
                }
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="parking-buffer">Minutes to park at your destination</Label>
            <Input
              id="parking-buffer"
              type="number"
              inputMode="numeric"
              min="0"
              max="60"
              className="h-12 bg-surface-raised"
              value={draft.parkingBufferMinutes}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  parkingBufferMinutes: event.target.value === "" ? 0 : Number(event.target.value),
                }))
              }
            />
            <p className="text-xs text-muted-foreground">Added to the drive time. Arriving home adds nothing.</p>
          </div>



          {draft.destStopId && (
            <div className="grid gap-2">
              <Label>Connecting route</Label>
              <Select
                value={draft.busRouteId ?? "auto"}
                onValueChange={(value) =>
                  setDraft((current) => ({ ...current, busRouteId: value === "auto" ? null : value }))
                }
              >
                <SelectTrigger className="h-12 bg-surface-raised">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Automatic (fastest connection)</SelectItem>
                  {destRoutes.map((route) => (
                    <SelectItem key={route.route_id} value={route.route_id}>
                      {route.route_short_name ? `Route ${route.route_short_name}` : route.route_id}
                      {route.sample_headsign ? ` to ${titleCase(route.sample_headsign)}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

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
