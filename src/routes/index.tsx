import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bus, Car, Check, Footprints, LocateFixed, RefreshCw, Settings, TrainFront } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { searchPlaces, type PlaceSuggestion } from "@/lib/geocode.functions";
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
  destStopId: string;
  destStopName: string;
  allowDrive: boolean;
  busRouteId: string | null;
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
const DRIVE_MINUTES = 54;

type DirectionOverride = { inbound: boolean; at: number };
/** Set when the morning trip drove to the station: the car waits there for the return leg. */
type ParkedCar = { date: string; station: string };
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
  allowDrive: false,
  busRouteId: null,
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

function Index() {
  const [now, setNow] = useState(() => new Date());
  const [hydrated, setHydrated] = useState(false);
  const [setup, setSetup] = useState<Setup>(emptySetup);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [override, setOverride] = useState<DirectionOverride | null>(null);
  const [parked, setParked] = useState<ParkedCar | null>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const saved = { ...emptySetup, ...(JSON.parse(stored) as Partial<Setup>) };
        // Older saves only kept the address; use it as the display name.
        setSetup({ ...saved, destinationName: saved.destinationName || saved.destinationAddress });
      } catch {
        window.localStorage.removeItem(STORAGE_KEY);
        setOnboardingOpen(true);
      }
    } else {
      setOnboardingOpen(true);
    }
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
  const nowSeconds = honoluluSeconds(now);
  const afterSeconds = Math.floor(nowSeconds / 60) * 60;
  // The car only helps on the way home if this morning's trip drove to this station.
  const carAtStation = Boolean(
    setup.allowDrive && parked && parked.station === setup.homeStopId && parked.date === honoluluDateKey(now),
  );

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
    const entry: ParkedCar = { date: honoluluDateKey(new Date()), station: setup.homeStopId };
    setParked((current) =>
      current && current.date === entry.date && current.station === entry.station ? current : entry,
    );
    window.localStorage.setItem(PARKED_KEY, JSON.stringify(entry));
  }, [outboundAccessMode, setup.homeStopId]);


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
  const railMinutes = best?.total_minutes ?? null;
  const railWins = railMinutes !== null && railMinutes < DRIVE_MINUTES;
  const leaveIn = best ? Math.round((best.leave_by_seconds - nowSeconds) / 60) : null;

  const timeline = useMemo(() => {
    if (!best) return [];
    const rows = best.legs.map((leg) => ({
      seconds: leg.depart_seconds,
      title: vehicleName(leg),
      detail:
        leg.mode === "walk" || leg.mode === "drive"
          ? leg.kind === "egress" && leg.mode === "drive"
            ? `${leg.minutes} min · your car is parked here`
            : `${leg.minutes} min`
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
              : railMinutes === null
                ? "RAIL UNAVAILABLE"
                : railWins
                  ? "TAKE THE RAIL"
                  : "DRIVE TODAY"}
          </h1>
          {best && (
            <p className="mt-6 text-3xl font-bold text-recommended">
              Leave by {clockFromSeconds(best.leave_by_seconds)}
            </p>
          )}
          <p className="mt-3 text-lg font-medium text-muted-foreground">
            {best
              ? `${Math.abs(DRIVE_MINUTES - (railMinutes ?? 0))} min ${railWins ? "faster" : "slower"} than driving · ${
                  leaveIn !== null && leaveIn > 0 ? `in ${leaveIn} min` : "now"
                }`
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
        </section>

        <section aria-label="Comparison" className="grid grid-cols-2 border-y border-border">
          <article className="border-r border-border py-7 pr-5">
            <p className="text-xs font-bold uppercase text-recommended">Rail trip</p>
            <p className="mt-3 text-5xl font-semibold leading-none text-recommended">
              {railMinutes ?? "—"}
              <span className="ml-1 text-base font-medium">min</span>
            </p>
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
            </dl>
          </article>
          <article className="py-7 pl-5 opacity-55">
            <p className="text-xs font-bold uppercase text-muted-foreground">Drive</p>
            <p className="mt-3 text-5xl font-semibold leading-none text-foreground">
              {DRIVE_MINUTES}
              <span className="ml-1 text-base font-medium">min</span>
            </p>
            <dl className="mt-7 space-y-4 text-sm">
              <div>
                <dt className="text-muted-foreground">H-1 traffic</dt>
                <dd className="mt-1 font-semibold text-foreground">Heavy</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{inbound ? "From" : "To"}</dt>
                <dd className="mt-1 truncate font-semibold text-foreground">
                  {setup.destinationName || setup.destinationAddress || "Your destination"}
                </dd>
              </div>
            </dl>
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

      <SetupDialog
        open={onboardingOpen || settingsOpen}
        firstRun={onboardingOpen}
        setup={setup}
        onClose={() => {
          setOnboardingOpen(false);
          setSettingsOpen(false);
        }}
        onSave={(next) => {
          persist(next);
          setOnboardingOpen(false);
          setSettingsOpen(false);
        }}
      />
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
        setStatus(`Nearest station: ${titleCase(nearest.stop_name)} (${formatDistance(nearest.distance_m)} away).`);
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
    setStatus("Finding the stop nearest that place…");
    try {
      const { data, error } = await supabase.rpc("nearest_stop", {
        p_lat: place.lat,
        p_lon: place.lon,
        p_rail_only: false,
      });
      const nearest = data?.[0];
      if (error || !nearest) {
        setStatus("No stop found near that place.");
        return;
      }
      setDraft((current) => ({
        ...current,
        destinationName: place.name,
        destinationAddress: place.address || place.name,
        destLat: place.lat,
        destLon: place.lon,
        destStopId: nearest.stop_id,
        destStopName: nearest.stop_name ?? "",
        busRouteId: null,
      }));
      setPlaceQuery("");
      setDebouncedQuery("");
      setStatus(`Nearest stop: ${titleCase(nearest.stop_name)} (${formatDistance(nearest.distance_m)} away).`);
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
        if (!next && !firstRun) onClose();
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
              <p className="text-sm text-muted-foreground">Destination stop: {titleCase(draft.destStopName)}</p>
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
