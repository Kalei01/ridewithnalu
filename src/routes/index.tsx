import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronRight, Clock3, Footprints, RefreshCw, Settings } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
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

type Preferences = {
  station: string;
  destination: string;
  departureTime: string;
  walkMinutes: number;
};

const stations = [
  { label: "Kualakaʻi · East Kapolei", query: "East Kapolei" },
  { label: "Keoneʻae · UH West Oahu", query: "UH West Oahu" },
  { label: "Honouliuli · Hoʻopili", query: "Hoopili" },
  { label: "Hōʻaeʻae · West Loch", query: "West Loch" },
  { label: "Pouhala · Waipahu Transit Center", query: "Waipahu Transit Center" },
  { label: "Hālaulani · Leeward Community College", query: "Leeward Community College" },
  { label: "Waiawa · Pearl Highlands", query: "Pearl Highlands" },
];

function stationQuery(label: string) {
  return stations.find((station) => station.label === label)?.query ?? label;
}

/** Minutes from now (Honolulu) until a GTFS "HH:MM:SS" departure time. */
function minutesAway(departure: string, from: Date) {
  const [hours = "0", minutes = "0"] = departure.split(":");
  const nowParts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Pacific/Honolulu",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(from).split(":");
  const nowMinutes = Number(nowParts[0]) * 60 + Number(nowParts[1]);
  return Math.max(0, Number(hours) * 60 + Number(minutes) - nowMinutes);
}

function formatDepartureTime(departure: string) {
  const [hours = "0", minutes = "00"] = departure.split(":");
  const hour24 = Number(hours) % 24;
  const suffix = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${hour12}:${minutes} ${suffix}`;
}

/** Realtime data older than this is ignored and the timetable is shown instead. */
const REALTIME_MAX_AGE_MS = 5 * 60_000;
/** Only surface a live time once the trip runs more than 2 minutes late. */
const DELAY_THRESHOLD_SECONDS = 120;

/** Shifts a GTFS "HH:MM:SS" time by a delay in seconds. */
function shiftTime(departure: string, seconds: number) {
  const [hours = "0", minutes = "0", secs = "0"] = departure.split(":");
  const total = Number(hours) * 3600 + Number(minutes) * 60 + Number(secs) + seconds;
  const safe = Math.max(0, total);
  const hh = Math.floor(safe / 3600);
  const mm = Math.floor((safe % 3600) / 60);
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00`;
}



const defaults: Preferences = {
  station: "Honouliuli · Hoʻopili",
  destination: "Downtown Honolulu",
  departureTime: "07:00",
  walkMinutes: 7,
};

const STORAGE_KEY = "kine-preferences";

function Index() {
  const [now, setNow] = useState(() => new Date());
  const [updatedAt, setUpdatedAt] = useState(() => new Date(Date.now() - 2 * 60_000));
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [preferences, setPreferences] = useState<Preferences>(defaults);
  const [draft, setDraft] = useState<Preferences>(defaults);
  const [refreshing, setRefreshing] = useState(false);
  const touchStart = useRef<number | null>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const saved = JSON.parse(stored) as Partial<Preferences>;
        const next = { ...defaults, ...saved };
        setPreferences(next);
        setDraft(next);
      } catch {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    }
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const timeText = useMemo(
    () => new Intl.DateTimeFormat("en-US", {
      timeZone: "Pacific/Honolulu",
      weekday: "long",
      hour: "numeric",
      minute: "2-digit",
    }).format(now),
    [now],
  );

  const { data: departures = [], isLoading: departuresLoading } = useQuery({
    queryKey: ["departures", preferences.station, updatedAt.getTime()],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("next_departures", {
        p_station_query: stationQuery(preferences.station),
        p_limit: 4,
      });
      if (error) throw error;
      const now = new Date();
      return (data ?? []).map((row) => {
        const scheduled = row.departure_time ?? "";
        const fetchedAt = row.realtime_fetched_at ? new Date(row.realtime_fetched_at) : null;
        const fresh = Boolean(
          fetchedAt && now.getTime() - fetchedAt.getTime() < REALTIME_MAX_AGE_MS,
        );
        const delaySeconds = fresh ? row.delay_seconds ?? 0 : 0;
        const live = fresh && delaySeconds > DELAY_THRESHOLD_SECONDS;
        return {
          time: formatDepartureTime(scheduled),
          liveTime: live ? formatDepartureTime(shiftTime(scheduled, delaySeconds)) : null,
          away: minutesAway(live ? shiftTime(scheduled, delaySeconds) : scheduled, now),
          delayMinutes: Math.round(delaySeconds / 60),
          isLive: fresh,
          headsign: row.trip_headsign ?? "",
        };
      });
    },
    staleTime: 30_000,
    refetchInterval: 30_000,
  });

  const nextDeparture = departures[0];
  const realtimeActive = departures.some((departure) => departure.isLive);




  function refresh() {
    setRefreshing(true);
    window.setTimeout(() => {
      const date = new Date();
      setNow(date);
      setUpdatedAt(date);
      setRefreshing(false);
    }, 550);
  }

  function savePreferences() {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
    setPreferences(draft);
    setSettingsOpen(false);
  }

  return (
    <main
      className="min-h-dvh bg-background px-5 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))] text-foreground"
      onTouchStart={(event) => { touchStart.current = event.touches[0]?.clientY ?? null; }}
      onTouchEnd={(event) => {
        const end = event.changedTouches[0]?.clientY;
        if (touchStart.current !== null && end !== undefined && touchStart.current < 80 && end - touchStart.current > 85) refresh();
        touchStart.current = null;
      }}
    >
      <div className="mx-auto flex w-full max-w-[440px] flex-col">
        <header className="flex min-h-11 items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase text-muted-foreground">Good morning</p>
            <p className="mt-1 text-[15px] font-medium text-foreground">{timeText}</p>
          </div>
          <Button variant="ghost" size="icon" aria-label="Open settings" onClick={() => { setDraft(preferences); setSettingsOpen(true); }} className="rounded-full text-muted-foreground hover:text-foreground">
            <Settings className="size-5" />
          </Button>
        </header>

        <section className="py-12" aria-labelledby="verdict-title">
          <div className="mb-5 flex items-center gap-2 text-recommended">
            <span className="flex size-6 items-center justify-center rounded-full bg-recommended text-recommended-foreground"><Check className="size-4 stroke-[3]" /></span>
            <span className="text-xs font-bold uppercase">Best option</span>
          </div>
          <h1 id="verdict-title" className="max-w-[360px] text-[clamp(3.4rem,15vw,4.5rem)] font-bold leading-[0.9] text-foreground">TAKE THE RAIL</h1>
          <p className="mt-5 text-lg font-medium text-muted-foreground">
            12 min faster{nextDeparture ? ` · leaves in ${nextDeparture.away} min` : ""}
          </p>
        </section>

        <section aria-label="Commute comparison" className="grid grid-cols-2 border-y border-border">
          <article className="border-r border-border py-7 pr-5">
            <p className="text-xs font-bold uppercase text-recommended">Rail</p>
            <p className="mt-3 text-5xl font-semibold leading-none text-recommended">42<span className="ml-1 text-base font-medium">min</span></p>
            <dl className="mt-7 space-y-4 text-sm">
              <div><dt className="text-muted-foreground">Next train</dt><dd className="mt-1 font-semibold text-foreground">{nextDeparture ? nextDeparture.time : departuresLoading ? "…" : "—"}</dd></div>
              <div className="flex items-center gap-2 text-muted-foreground"><Clock3 className="size-4 text-recommended" /><span>{nextDeparture ? `${nextDeparture.away} min away` : "No more trains today"}</span></div>
              <div className="flex items-center gap-2 text-muted-foreground"><Footprints className="size-4 text-recommended" /><span>{preferences.walkMinutes} min walk</span></div>
            </dl>
          </article>
          <article className="py-7 pl-5 opacity-55">
            <p className="text-xs font-bold uppercase text-muted-foreground">Drive</p>
            <p className="mt-3 text-5xl font-semibold leading-none text-foreground">54<span className="ml-1 text-base font-medium">min</span></p>
            <dl className="mt-7 space-y-4 text-sm">
              <div><dt className="text-muted-foreground">H-1 traffic</dt><dd className="mt-1 font-semibold text-foreground">Heavy</dd></div>
              <div><dt className="text-muted-foreground">To</dt><dd className="mt-1 truncate font-semibold text-foreground">{preferences.destination}</dd></div>
            </dl>
          </article>
        </section>

        <section className="py-8" aria-labelledby="departures-title">
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <h2 id="departures-title" className="text-lg font-semibold">Next departures</h2>
              <p className="mt-1 truncate text-sm text-muted-foreground">{preferences.station}</p>
            </div>
          </div>
          <ol className="divide-y divide-border">
            {departures.map((departure, index) => (
              <li key={`${departure.time}-${index}`} className="flex min-h-14 items-center justify-between">
                <span className={index === 0 ? "font-semibold text-recommended" : "font-medium text-foreground"}>{departure.time}</span>
                <span className="flex items-center gap-1 text-sm text-muted-foreground">{departure.away} min <ChevronRight className="size-4" /></span>
              </li>
            ))}
            {departures.length === 0 && (
              <li className="flex min-h-14 items-center text-sm text-muted-foreground">
                {departuresLoading ? "Loading schedule…" : "No scheduled departures found."}
              </li>
            )}
          </ol>

        </section>

        <footer className="mt-auto flex items-center justify-between border-t border-border pt-5 text-sm text-muted-foreground">
          <span>{updatedAt.getTime() > Date.now() - 60_000 ? "Updated just now" : "Updated 2 min ago"}</span>
          <Button variant="ghost" size="sm" onClick={refresh} disabled={refreshing} className="text-muted-foreground hover:text-foreground">
            <RefreshCw className={refreshing ? "animate-spin" : ""} /> Refresh
          </Button>
        </footer>
      </div>

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="bottom-0 left-0 top-auto w-full max-w-none translate-x-0 translate-y-0 gap-6 rounded-t-lg border-x-0 border-b-0 bg-background p-6 sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-lg">
          <DialogHeader className="text-left">
            <DialogTitle className="text-2xl">Your commute</DialogTitle>
            <DialogDescription>Set the trip Kine compares each morning.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-5">
            <div className="grid gap-2"><Label htmlFor="station">Home station</Label><Select value={draft.station} onValueChange={(station) => setDraft((current) => ({ ...current, station }))}><SelectTrigger id="station" className="h-12 bg-surface-raised"><SelectValue /></SelectTrigger><SelectContent>{stations.map((station) => <SelectItem key={station.label} value={station.label}>{station.label}</SelectItem>)}</SelectContent></Select></div>
            <div className="grid gap-2"><Label htmlFor="destination">Work destination</Label><Input id="destination" className="h-12 bg-surface-raised" value={draft.destination} onChange={(event) => setDraft((current) => ({ ...current, destination: event.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2"><Label htmlFor="departure">Usual departure</Label><Input id="departure" type="time" className="h-12 bg-surface-raised" value={draft.departureTime} onChange={(event) => setDraft((current) => ({ ...current, departureTime: event.target.value }))} /></div>
              <div className="grid gap-2"><Label htmlFor="walk">Walk (minutes)</Label><Input id="walk" type="number" min="0" max="60" className="h-12 bg-surface-raised" value={draft.walkMinutes} onChange={(event) => setDraft((current) => ({ ...current, walkMinutes: Number(event.target.value) }))} /></div>
            </div>
          </div>
          <DialogFooter><Button onClick={savePreferences} className="h-12 w-full shadow-none">Save commute</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
