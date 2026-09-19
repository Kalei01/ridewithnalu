import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Clock3, Footprints, LocateFixed, RefreshCw, Settings } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { geocodeAddress } from "@/lib/geocode.functions";
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

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Kine — Rail or drive today?" },
      { name: "description", content: "Your quick morning commute decision from West Oahu to Honolulu." },
      { property: "og:title", content: "Kine — Rail or drive today?" },
      { property: "og:description", content: "Your quick morning commute decision from West Oahu to Honolulu." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

type Setup = {
  homeStopId: string;
  homeStopName: string;
  workAddress: string;
  workLat: number | null;
  workLon: number | null;
  destStopId: string;
  destStopName: string;
  walkMinutes: number;
  busRouteId: string | null;
};

const STORAGE_KEY = "kine-setup-v2";
const DRIVE_MINUTES = 54;

const emptySetup: Setup = {
  homeStopId: "",
  homeStopName: "",
  workAddress: "",
  workLat: null,
  workLon: null,
  destStopId: "",
  destStopName: "",
  walkMinutes: 7,
  busRouteId: null,
};

function honoluluSeconds(date: Date) {
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
  return (parts[0] ?? 0) * 3600 + (parts[1] ?? 0) * 60 + (parts[2] ?? 0);
}

function clockLabel(time: string | null) {
  if (!time) return "—";
  const [hours = "0", minutes = "00"] = time.split(":");
  const hour24 = Number(hours) % 24;
  const suffix = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${hour12}:${minutes} ${suffix}`;
}

function titleCase(value: string | null) {
  if (!value) return "";
  return value
    .toLowerCase()
    .replace(/\b([a-z])/g, (match) => match.toUpperCase())
    .replace(/\b(U\.h\.|Uh)\b/g, "UH");
}

function railName(longName: string | null, shortName: string | null, headsign: string | null) {
  const line = titleCase(longName) || (shortName ? `Route ${shortName}` : "Rail");
  return headsign ? `${line} to ${titleCase(headsign)}` : line;
}

function busName(shortName: string | null, headsign: string | null) {
  const label = shortName ? `Route ${shortName}` : "Bus";
  return headsign ? `${label} to ${titleCase(headsign)}` : label;
}

function Index() {
  const [now, setNow] = useState(() => new Date());
  const [hydrated, setHydrated] = useState(false);
  const [setup, setSetup] = useState<Setup>(emptySetup);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setSetup({ ...emptySetup, ...(JSON.parse(stored) as Partial<Setup>) });
      } catch {
        window.localStorage.removeItem(STORAGE_KEY);
        setOnboardingOpen(true);
      }
    } else {
      setOnboardingOpen(true);
    }
    setHydrated(true);
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

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

  const configured = Boolean(setup.homeStopId && setup.destStopId);
  const afterSeconds = honoluluSeconds(now) + setup.walkMinutes * 60;

  const { data: chains = [], isLoading: chainsLoading } = useQuery({
    queryKey: ["chains", setup.homeStopId, setup.destStopId, setup.busRouteId, Math.floor(afterSeconds / 60)],
    enabled: hydrated && configured,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("plan_rail_chains", {
        p_home_stop: setup.homeStopId,
        p_dest_stop: setup.destStopId,
        p_after_seconds: afterSeconds,
        p_limit: 4,
        p_bus_route_id: setup.busRouteId,
      });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: railFallback = [] } = useQuery({
    queryKey: ["rail-departures", setup.homeStopId, Math.floor(afterSeconds / 60)],
    enabled: hydrated && configured && !chainsLoading && chains.length === 0,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("rail_departures", {
        p_home_stop: setup.homeStopId,
        p_after_seconds: afterSeconds,
        p_limit: 4,
      });
      if (error) throw error;
      return data ?? [];
    },
  });

  const best = chains[0];
  const railMinutes = best ? best.total_minutes + setup.walkMinutes : null;
  const railWins = railMinutes !== null && railMinutes < DRIVE_MINUTES;
  const leavesIn = best ? Math.max(0, Math.round((best.depart_seconds - honoluluSeconds(now)) / 60)) : null;

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
        <header className="flex min-h-11 items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase text-muted-foreground">Good morning</p>
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

        <section className="py-12" aria-labelledby="verdict-title">
          <div className="mb-5 flex items-center gap-2 text-recommended">
            <span className="flex size-6 items-center justify-center rounded-full bg-recommended text-recommended-foreground">
              <Check className="size-4 stroke-[3]" />
            </span>
            <span className="text-xs font-bold uppercase">Best option</span>
          </div>
          <h1
            id="verdict-title"
            className="max-w-[360px] text-[clamp(3.4rem,15vw,4.5rem)] font-bold leading-[0.9] text-foreground"
          >
            {railWins ? "TAKE THE RAIL" : railMinutes !== null ? "DRIVE TODAY" : "SET UP KINE"}
          </h1>
          <p className="mt-5 text-lg font-medium text-muted-foreground">
            {railMinutes !== null
              ? `${Math.abs(DRIVE_MINUTES - railMinutes)} min ${railWins ? "faster" : "slower"}${
                  leavesIn !== null ? ` · leaves in ${leavesIn} min` : ""
                }`
              : configured
                ? chainsLoading
                  ? "Checking today's connections…"
                  : "No rail and bus connection found for now."
                : "Add your home station and work address to start."}
          </p>
        </section>

        <section aria-label="Commute comparison" className="grid grid-cols-2 border-y border-border">
          <article className="border-r border-border py-7 pr-5">
            <p className="text-xs font-bold uppercase text-recommended">Rail</p>
            <p className="mt-3 text-5xl font-semibold leading-none text-recommended">
              {railMinutes ?? "—"}
              <span className="ml-1 text-base font-medium">min</span>
            </p>
            <dl className="mt-7 space-y-4 text-sm">
              <div>
                <dt className="text-muted-foreground">Next train</dt>
                <dd className="mt-1 font-semibold text-foreground">
                  {best ? clockLabel(best.depart_time) : chainsLoading ? "…" : "—"}
                </dd>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock3 className="size-4 text-recommended" />
                <span>{leavesIn !== null ? `${leavesIn} min away` : "No connection"}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Footprints className="size-4 text-recommended" />
                <span>{setup.walkMinutes} min to station</span>
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
                <dt className="text-muted-foreground">To</dt>
                <dd className="mt-1 truncate font-semibold text-foreground">{setup.workAddress || "Your work"}</dd>
              </div>
            </dl>
          </article>
        </section>

        {best && (
          <section className="py-8" aria-labelledby="chain-title">
            <h2 id="chain-title" className="text-lg font-semibold">
              Your next trip
            </h2>
            <ol className="mt-5 space-y-0">
              {[
                {
                  time: best.depart_time,
                  title: `Depart ${titleCase(best.home_stop_name)}`,
                  detail: railName(best.rail_route_long_name, best.rail_route_short_name, best.rail_headsign),
                },
                {
                  time: best.rail_arrive_time,
                  title: `Arrive ${titleCase(best.transfer_stop_name)}`,
                  detail: `Transfer at ${titleCase(best.bus_stop_name)}`,
                },
                {
                  time: best.bus_depart_time,
                  title: busName(best.bus_route_short_name, best.bus_headsign),
                  detail: titleCase(best.bus_route_long_name),
                },
                {
                  time: best.arrive_time,
                  title: "Arrive work",
                  detail: titleCase(best.dest_stop_name),
                },
              ].map((leg, index, list) => (
                <li key={`${leg.time}-${index}`} className="flex gap-4">
                  <span className="w-[74px] shrink-0 pt-0.5 text-sm font-semibold tabular-nums text-foreground">
                    {clockLabel(leg.time)}
                  </span>
                  <span className="flex flex-col items-center pt-1.5">
                    <span
                      className={`size-2.5 rounded-full ${index === 0 || index === list.length - 1 ? "bg-recommended" : "bg-border"}`}
                    />
                    {index < list.length - 1 && <span className="w-px flex-1 bg-border" />}
                  </span>
                  <span className="flex-1 pb-6">
                    <span className="block text-[15px] font-medium text-foreground">{leg.title}</span>
                    <span className="mt-0.5 block text-sm text-muted-foreground">{leg.detail}</span>
                  </span>
                </li>
              ))}
            </ol>
          </section>
        )}

        <section className="pb-8" aria-labelledby="departures-title">
          <div className="mb-4">
            <h2 id="departures-title" className="text-lg font-semibold">
              Later departures
            </h2>
            <p className="mt-1 truncate text-sm text-muted-foreground">{titleCase(setup.homeStopName) || "No station set"}</p>
          </div>
          <ol className="divide-y divide-border">
            {chains.slice(1).map((chain, index) => (
              <li key={`${chain.depart_time}-${index}`} className="flex min-h-14 items-center justify-between gap-3 py-2">
                <span className="font-medium tabular-nums text-foreground">{clockLabel(chain.depart_time)}</span>
                <span className="truncate text-sm text-muted-foreground">
                  {busName(chain.bus_route_short_name, chain.bus_headsign)}
                </span>
                <span className="shrink-0 text-sm text-muted-foreground">
                  {chain.total_minutes + setup.walkMinutes} min
                </span>
              </li>
            ))}
            {chains.length <= 1 && (
              <li className="py-3 text-sm text-muted-foreground">
                {!configured
                  ? "Finish setup to see departures."
                  : chainsLoading
                    ? "Loading schedule…"
                    : railFallback.length > 0
                      ? "Trains are running, but no connecting bus lines up. Pick your connecting route in settings."
                      : "No more connections today."}
              </li>
            )}
            {chains.length === 0 &&
              railFallback.map((train, index) => (
                <li key={`${train.departure_time}-${index}`} className="flex min-h-14 items-center justify-between gap-3 py-2">
                  <span className="font-medium tabular-nums text-foreground">{clockLabel(train.departure_time)}</span>
                  <span className="truncate text-sm text-muted-foreground">
                    {railName(train.route_long_name, train.route_short_name, train.trip_headsign)}
                  </span>
                </li>
              ))}
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
  const geocode = useServerFn(geocodeAddress);
  const [draft, setDraft] = useState<Setup>(setup);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setDraft(setup);
      setStatus(null);
    }
  }, [open, setup]);

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
        const { data, error } = await supabase.rpc("nearest_stop", {
          p_lat: position.coords.latitude,
          p_lon: position.coords.longitude,
          p_rail_only: true,
        });
        setBusy(false);
        const nearest = data?.[0];
        if (error || !nearest) {
          setStatus("Could not match a station. Pick one below.");
          return;
        }
        setDraft((current) => ({ ...current, homeStopId: nearest.stop_id, homeStopName: nearest.stop_name ?? "" }));
        setStatus(`Nearest station: ${titleCase(nearest.stop_name)} (${Math.round(nearest.distance_m)} m away).`);
      },
      () => {
        setBusy(false);
        setStatus("Location was not shared. Pick your station below.");
      },
      { timeout: 10_000 },
    );
  }

  async function findWorkStop() {
    if (draft.workAddress.trim().length < 3) {
      setStatus("Enter your work address first.");
      return;
    }
    setBusy(true);
    setStatus("Looking up your work address…");
    try {
      const result = await geocode({ data: { address: draft.workAddress.trim() } });
      if (!result.found) {
        setStatus("That address was not found. Try adding the city.");
        return;
      }
      const { data, error } = await supabase.rpc("nearest_stop", {
        p_lat: result.lat,
        p_lon: result.lon,
        p_rail_only: false,
      });
      const nearest = data?.[0];
      if (error || !nearest) {
        setStatus("No stop found near that address.");
        return;
      }
      setDraft((current) => ({
        ...current,
        workAddress: result.label,
        workLat: result.lat,
        workLon: result.lon,
        destStopId: nearest.stop_id,
        destStopName: nearest.stop_name ?? "",
        busRouteId: null,
      }));
      setStatus(`Work stop: ${titleCase(nearest.stop_name)} (${Math.round(nearest.distance_m)} m from your address).`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Address lookup failed.");
    } finally {
      setBusy(false);
    }
  }

  const canSave = Boolean(draft.homeStopId && draft.destStopId);

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next && !firstRun) onClose(); }}>
      <DialogContent
        className="bottom-0 left-0 top-auto max-h-[90dvh] w-full max-w-none translate-x-0 translate-y-0 gap-6 overflow-y-auto rounded-t-lg border-x-0 border-b-0 bg-background p-6 sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-lg"
        showCloseButton={!firstRun}
      >
        <DialogHeader className="text-left">
          <DialogTitle className="text-2xl">{firstRun ? "Set up your commute" : "Your commute"}</DialogTitle>
          <DialogDescription>
            Kine needs your home station and work address once. Everything stays on this device.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5">
          <div className="grid gap-2">
            <Label>Home rail station</Label>
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
            <Label htmlFor="work">Work address</Label>
            <Input
              id="work"
              className="h-12 bg-surface-raised"
              placeholder="1000 Bishop St, Honolulu"
              value={draft.workAddress}
              onChange={(event) => setDraft((current) => ({ ...current, workAddress: event.target.value }))}
            />
            <Button variant="outline" onClick={findWorkStop} disabled={busy} className="h-12">
              Find my work stop
            </Button>
            {draft.destStopName && (
              <p className="text-sm text-muted-foreground">Work stop: {titleCase(draft.destStopName)}</p>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="walk">Minutes to reach your station</Label>
            <Input
              id="walk"
              type="number"
              min="0"
              max="90"
              className="h-12 bg-surface-raised"
              value={draft.walkMinutes}
              onChange={(event) => setDraft((current) => ({ ...current, walkMinutes: Number(event.target.value) }))}
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
                      {busName(route.route_short_name, route.sample_headsign)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {status && <p className="text-sm text-muted-foreground">{status}</p>}
        </div>

        <DialogFooter>
          <Button onClick={() => onSave(draft)} disabled={!canSave || busy} className="h-12 w-full shadow-none">
            Save commute
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
