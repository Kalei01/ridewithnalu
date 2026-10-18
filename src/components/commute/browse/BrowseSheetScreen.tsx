import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { ClientOnly } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Bus,
  ChevronDown,
  ChevronRight,
  MapPinOff,
  Plus,
  RefreshCw,
  TrainFront,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { WaveMark } from "@/components/commute/NaluPersonalityStrip";
import { WhereToSearch } from "@/components/home/WhereToSearch";
import "@/components/home/home.css";
import { Waves } from "@/components/home/Waves";
import { StationName } from "@/components/commute/StationName";
import { LandmarkHint } from "@/components/commute/TransitNotices";
import { WalkingMicroMap } from "@/components/commute/RailTripBreakdown";
import { DataExpiryNotice } from "@/components/commute/DataExpiry";
import { H1ConditionsCard, TONE_CLASS } from "@/components/commute/H1ConditionsCard";
import { RoadworkTile } from "@/components/commute/RoadworkTile";
import {
  AskNaluIfAvailable,
  BeatTheRush,
  EveningPulse,
  MorningPulse,
  WeeklyDigestCard,
} from "@/components/ai/NaluAi";
import { InstallNaluCard } from "@/components/InstallNaluCard";
import { LeaveAlertCard } from "@/components/LeaveAlertCard";
import { shortcutIcon } from "@/components/places/Shortcuts";
import { useGate } from "@/hooks/use-gate";
import { useAuth } from "@/hooks/use-auth";
import { nearbyChipTitle, nearbyServiceLabel, profileFirstName } from "@/lib/commute-model";
import {
  alohaGreeting,
  clockFromSeconds,
  distanceM,
  formatDistance,
  stationLabel,
  terminusLabel,
  titleCase,
} from "@/lib/commute-formatting";
import { HOLO_FARES } from "@/lib/fares";
import { h1PeekLine, nextTrainLine } from "@/lib/browse-peek";
import { plannerHref } from "@/lib/home/planner-link";
import { findByKind, kindLabel } from "@/lib/places/saved-places";
import { activeRegion } from "@/lib/region";
import { BrowseSheet, type SheetState } from "./BrowseSheet";
import type { MapLayers, MapSelection } from "./BrowseMap";
import { startTripFrom } from "./start-trip";
import { scrollBehavior } from "@/lib/motion";
import { useBrowseData } from "./useBrowseData";

const BrowseMap = lazy(() => import("./BrowseMap"));

const LAYERS_KEY = "nalu-browse-layers-v1";
const DEFAULT_LAYERS: MapLayers = { stops: true, skyline: true, places: true };
/** The chips along the map's top edge. Phase 3 adds Traffic, Incidents and Roadwork here. */
const LAYER_CHIPS: { id: keyof MapLayers; label: string }[] = [
  { id: "stops", label: "Stops" },
  { id: "skyline", label: "Skyline" },
  { id: "places", label: "Places" },
];

const CHIP_KINDS = ["home", "work", "gym"] as const;

/**
 * Browse as one live map with one bottom sheet (preview at /browse-preview).
 * Same data and the same cards as the Browse screen, regrouped:
 *   PEEK  Where to? + one live line + one live number
 *   HALF  destination chips, Today, On the road, Near you
 *   FULL  weekly digest, walk to a picked stop, Ask Nalu, Install, alerts
 */
export function BrowseSheetScreen() {
  const data = useBrowseData();
  const gate = useGate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [sheet, setSheet] = useState<SheetState>("peek");
  const [stationExpanded, setStationExpanded] = useState(false);
  // True once the rider chose a stop themselves (a pin or a chip), not the default one.
  const [stopPicked, setStopPicked] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const {
    browseStation,
    browseStations,
    browseUserPoint,
    browseDirections,
    nearbyStops,
    selectedNearbyStop,
    nowSeconds,
  } = data;

  const hasTransit = activeRegion().hasTransit;
  // The nearest Skyline station has its own card; keep it out of the stop chips.
  const listedStops = nearbyStops.filter((stop) => stop.stopId !== browseStation?.stopId);
  const shownStop =
    listedStops.find((stop) => stop.stopId === selectedNearbyStop?.stopId) ??
    listedStops[0] ??
    null;
  const roadLine = h1PeekLine(
    data.eastboundTraffic,
    data.westboundTraffic,
    data.trafficUnavailable && !data.trafficLoading,
  );
  const trainLine = browseStation
    ? nextTrainLine(browseDirections, nowSeconds, browseStation.stopName, data.browseWalkMinutes)
    : null;

  // How much of the map's lower part the open sheet covers, so the map can keep
  // its view centered in what is still visible.
  const mapRef = useRef<HTMLDivElement | null>(null);
  const [cover, setCover] = useState(0);
  useEffect(() => {
    if (sheet === "peek") {
      setCover(0);
      return;
    }
    const mapHeight = mapRef.current?.clientHeight ?? 0;
    setCover(Math.max(0, Math.round(mapHeight - window.innerHeight * 0.5)));
  }, [sheet]);

  // Which map layers are on (remembered on this device) and what the rider tapped on the map.
  const [layers, setLayers] = useState<MapLayers>(DEFAULT_LAYERS);
  useEffect(() => {
    try {
      const saved = JSON.parse(
        window.localStorage.getItem(LAYERS_KEY) ?? "null",
      ) as Partial<MapLayers> | null;
      if (saved && typeof saved === "object")
        setLayers({
          stops: saved.stops !== false,
          skyline: saved.skyline !== false,
          places: saved.places !== false,
        });
    } catch {
      /* a private window or bad value: the defaults are fine */
    }
  }, []);
  function toggleLayer(id: keyof MapLayers) {
    setLayers((current) => {
      const next = { ...current, [id]: !current[id] };
      try {
        window.localStorage.setItem(LAYERS_KEY, JSON.stringify(next));
      } catch {
        /* not remembered */
      }
      return next;
    });
  }
  const [selection, setSelection] = useState<MapSelection | null>(null);
  // Start a trip from a stop the rider tapped, instead of from where they stand.
  const [startFrom, setStartFrom] = useState<{ name: string; lat: number; lon: number } | null>(
    null,
  );
  const nearRef = useRef<HTMLElement | null>(null);

  const mapStations = data.browseStations
    .filter((s) => s.stop_lat !== null && s.stop_lon !== null)
    .map((s) => ({
      stopId: s.stop_id,
      name: s.stop_name ?? "",
      lat: Number(s.stop_lat),
      lon: Number(s.stop_lon),
    }));
  const mapPlaces = (["home", "work"] as const).flatMap((kind) => {
    const p = findByKind(data.savedPlaces, kind);
    return p && p.lat != null && p.lon != null
      ? [{ id: p.id, kind, label: p.label, lat: p.lat, lon: p.lon }]
      : [];
  });
  const selectedPlace =
    selection?.kind === "place" ? (mapPlaces.find((p) => p.id === selection.id) ?? null) : null;

  function pickStop(stopId: string) {
    data.setSelectedNearbyStopId(stopId);
    setStopPicked(true);
    setSelection({ kind: "stop", id: stopId });
    setSheet((current) => (current === "peek" ? "half" : current));
  }

  /** A pin was tapped: the sheet opens to the matching card. */
  function selectOnMap(next: MapSelection) {
    if (next.kind === "place") {
      setSelection(next);
      setSheet((current) => (current === "peek" ? "half" : current));
      return;
    }
    const inNearby = nearbyStops.some((stop) => stop.stopId === next.id);
    if (next.kind === "stop" || inNearby) {
      pickStop(next.id);
      return;
    }
    // A Skyline station that is not among the nearby stops becomes "Near you".
    const station = data.browseStations.find((item) => item.stop_id === next.id);
    if (station && station.stop_id !== browseStation?.stopId) {
      data.rememberBrowseStation({
        stopId: station.stop_id,
        stopName: station.stop_name ?? "",
        lat: Number(station.stop_lat),
        lon: Number(station.stop_lon),
        ...(browseStation?.userLat !== undefined ? { userLat: browseStation.userLat } : {}),
        ...(browseStation?.userLon !== undefined ? { userLon: browseStation.userLon } : {}),
      });
    }
    setStationExpanded(true);
    setSelection(next);
    setSheet((current) => (current === "peek" ? "half" : current));
  }

  // Bring the matching card into view when something is selected on the map.
  useEffect(() => {
    if (!selection) return;
    const frame = window.requestAnimationFrame(() => {
      const target = selection.kind === "place" ? null : nearRef.current;
      const body = (target ?? nearRef.current)?.closest(".nb-sheet-body") as HTMLElement | null;
      if (!body) return;
      const top = target
        ? target.getBoundingClientRect().top - body.getBoundingClientRect().top + body.scrollTop - 8
        : 0;
      body.scrollTo({ top, behavior: scrollBehavior() });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [selection]);

  /** Go to a destination: from here, or from the stop the rider chose to start at. */
  async function goTo(place: { name: string; lat: number; lon: number }) {
    if (!startFrom) {
      window.location.assign(plannerHref(place));
      return;
    }
    if (!gate.tripCheck()) return;
    const id = toast.loading(`Finding the quickest trip to ${place.name}…`);
    try {
      await startTripFrom(startFrom, place);
    } catch {
      toast.error("Nalu couldn’t build that trip right now.", { id });
    }
  }

  async function refresh() {
    setRefreshing(true);
    try {
      await queryClient.invalidateQueries();
    } finally {
      setRefreshing(false);
    }
  }

  const peek = (
    <div onFocusCapture={() => setSheet((current) => (current === "peek" ? "half" : current))}>
      <WhereToSearch {...(startFrom ? { onPick: (place) => void goTo(place) } : {})} />
      <button
        type="button"
        className="nb-peek-row"
        onClick={() => setSheet((current) => (current === "peek" ? "half" : current))}
        aria-label="Show what is happening now"
      >
        <span className="flex min-w-0 flex-1 items-center gap-2 text-sm font-medium text-foreground">
          <span className="nh-live-dot shrink-0" aria-hidden="true" />
          <span className="truncate">{roadLine ?? "Checking the roads…"}</span>
        </span>
      </button>
      {trainLine && (
        <p
          className="nb-peek-row flex items-center gap-2 text-sm text-muted-foreground"
          aria-label={`Scheduled: ${trainLine}`}
        >
          <TrainFront aria-hidden="true" className="size-4 shrink-0 text-primary" />
          <span className="truncate">{trainLine}</span>
        </p>
      )}
    </div>
  );

  return (
    <main className="nh nb text-foreground">
      <div ref={mapRef} className="nb-map">
        {browseUserPoint ? (
          <section aria-label="Nearby transit map" className="nh-island-card relative">
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
                <BrowseMap
                  userPoint={browseUserPoint}
                  stops={nearbyStops.map((stop) => ({
                    stopId: stop.stopId,
                    stopName: stop.stopName,
                    lat: stop.lat,
                    lon: stop.lon,
                    kind: stop.routeType === 1 ? "rail" : "bus",
                  }))}
                  stations={mapStations}
                  places={mapPlaces}
                  layers={layers}
                  selected={selection}
                  onSelect={selectOnMap}
                  coverBottom={cover}
                />
              </Suspense>
            </ClientOnly>
          </section>
        ) : (
          <div className="nh-hero h-full">
            <Waves />
            <p className="relative mx-auto flex max-w-[320px] items-center gap-2 px-6 pt-40 text-sm text-muted-foreground">
              <MapPinOff aria-hidden="true" className="size-5 shrink-0" />
              {data.browseLocationDenied
                ? "Location is off, so the map is hidden. Skyline and H-1 below still work."
                : "Finding where you are…"}
            </p>
          </div>
        )}
      </div>

      {browseUserPoint && (
        <div className="nb-layers" role="group" aria-label="Map layers">
          {LAYER_CHIPS.map((chip) => (
            <button
              key={chip.id}
              type="button"
              className="nb-layer-chip"
              aria-pressed={layers[chip.id]}
              onClick={() => toggleLayer(chip.id)}
            >
              {chip.label}
            </button>
          ))}
        </div>
      )}

      <div className="nb-brand">
        <WaveMark className="h-5 w-auto text-foreground" />
        <span className="text-base font-medium tracking-wide">Nalu</span>
        <span className="hidden text-xs text-muted-foreground min-[380px]:inline">
          {alohaGreeting(data.now, profileFirstName(user))}
        </span>
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
      </div>

      <BrowseSheet state={sheet} onStateChange={setSheet} peek={peek}>
        {!hasTransit && (
          <p className="mt-2 w-fit rounded-full border border-warning/40 bg-warning/10 px-3 py-1 text-xs font-semibold text-warning">
            Test: {activeRegion().name} · driving and rides only
          </p>
        )}
        <DataExpiryNotice />
        {!data.online && (
          <p
            role="status"
            className="mt-3 rounded-lg border border-border bg-surface-raised px-4 py-3 text-sm text-muted-foreground"
          >
            You’re offline. Available schedules stay visible; live arrivals will refresh when you
            reconnect.
          </p>
        )}

        {startFrom && (
          <div className="nb-select-card nh-card flex items-center gap-3 px-4 py-3" role="status">
            <TrainFront aria-hidden="true" className="size-5 shrink-0 text-primary" />
            <p className="min-w-0 flex-1 text-sm text-foreground">
              Starting from <span className="font-semibold">{startFrom.name}</span>. Pick where to
              with Where to? or a chip.
            </p>
            <Button
              size="icon"
              variant="ghost"
              className="size-11 shrink-0"
              aria-label="Start from where I am instead"
              onClick={() => setStartFrom(null)}
            >
              <X className="size-4" />
            </Button>
          </div>
        )}

        {selectedPlace && (
          <section className="nb-select-card nh-card p-4" aria-label={`${selectedPlace.label}`}>
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
                  {selectedPlace.kind === "home" ? "Home" : "Work"}
                </p>
                <p className="mt-0.5 break-words text-lg font-semibold text-foreground">
                  {selectedPlace.label}
                </p>
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="size-11 shrink-0"
                aria-label="Close place"
                onClick={() => setSelection(null)}
              >
                <X className="size-4" />
              </Button>
            </div>
            <Button
              className="mt-3 h-12 w-full text-base"
              onClick={() =>
                void goTo({
                  name: selectedPlace.label,
                  lat: selectedPlace.lat,
                  lon: selectedPlace.lon,
                })
              }
            >
              Plan trip
            </Button>
          </section>
        )}

        {/* Quick destinations */}
        <div className="nh-rail-scroll mt-3" role="group" aria-label="Quick destinations">
          {CHIP_KINDS.map((kind) => {
            const Icon = shortcutIcon(kind);
            const place = findByKind(data.savedPlaces, kind);
            const href = place
              ? plannerHref({ name: place.name || place.label, lat: place.lat, lon: place.lon })
              : "/";
            return (
              <a
                key={kind}
                href={href}
                onClick={(event) => {
                  if (!place || !startFrom) return;
                  event.preventDefault();
                  void goTo({ name: place.name || place.label, lat: place.lat, lon: place.lon });
                }}
                className={`nh-chip ${place ? "" : "opacity-70"}`}
                aria-label={
                  place ? `Plan a trip to ${kindLabel(kind)}` : `Set up ${kindLabel(kind)}`
                }
              >
                <Icon aria-hidden="true" className="size-4 text-muted-foreground" />{" "}
                {kindLabel(kind)}
              </a>
            );
          })}
          <a href="/" className="nh-chip">
            <Plus aria-hidden="true" className="size-4 text-muted-foreground" /> Add Place
          </a>
        </div>

        {/* Today: Morning / Evening Pulse and Beat the Rush, one heading */}
        {hasTransit && (
          <section className="nb-card nb-today" aria-label="Today">
            <h2 className="nb-card-title">Today</h2>
            <div className="nh-card p-4">
              <MorningPulse
                home={data.browseHome}
                work={data.browseWork}
                trainsEveryMinutes={data.trainsEveryMinutes}
                embedded
              />
              <EveningPulse
                home={data.browseHome}
                work={data.browseWork}
                trainsEveryMinutes={data.trainsEveryMinutes}
                embedded
              />
              <BeatTheRush home={data.browseHome} work={data.browseWork} embedded />
            </div>
          </section>
        )}

        {/* On the road: H-1 (with its incidents), roadwork, weather */}
        {hasTransit && (
          <section className="nb-card" aria-label="On the road">
            <h2 className="nb-card-title">On the road</h2>
            <div className="nh-card nb-card-inner">
              <H1ConditionsCard
                eastbound={data.eastboundTraffic}
                westbound={data.westboundTraffic}
                loading={data.trafficLoading}
                unavailable={data.trafficUnavailable}
                compact
                className=""
              />
              <RoadworkTile />
              <details className="nh-card nh-details">
                <summary className="flex min-h-14 cursor-pointer list-none items-center gap-2 px-4 py-3 [&::-webkit-details-marker]:hidden">
                  <span className="min-w-0 truncate text-sm font-semibold text-foreground">
                    {data.browseWeatherSummary}
                  </span>
                  <ChevronDown className="nh-chevron ml-auto size-4 shrink-0 text-muted-foreground" />
                </summary>
                <div className="border-t border-white/10 px-4 py-3">
                  {data.browseWeatherLine ? (
                    <p className={`text-sm ${TONE_CLASS[data.browseWeatherLine.tone]}`}>
                      {data.browseWeatherLine.text}
                    </p>
                  ) : data.browseWeather ? (
                    <p className="text-sm text-muted-foreground">
                      No weather or air-quality concerns right now.
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {data.browseWeatherFailed || (!browseStation && data.browseLocationDenied)
                        ? "Weather isn’t available right now."
                        : "Checking weather…"}
                    </p>
                  )}
                  <p className="mt-2 text-xs text-muted-foreground">
                    Weather: NWS · Air quality: AirNow / EPA
                  </p>
                </div>
              </details>
            </div>
          </section>
        )}

        {/* Near you: nearest Skyline station + nearby stops */}
        {hasTransit && (
          <section ref={nearRef} className="nb-card" aria-label="Near you">
            <h2 className="nb-card-title">Near you</h2>
            {browseStation && data.browseFar && !stationExpanded ? (
              <button
                type="button"
                onClick={() => setStationExpanded(true)}
                className="nh-card flex w-full min-w-0 items-center gap-2 px-4 py-3 text-left text-sm"
                aria-label="Show Skyline station details"
              >
                <TrainFront className="size-4 shrink-0 text-primary" />
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-foreground">
                    <StationName name={browseStation.stopName} />
                  </span>
                  <span className="block text-muted-foreground">
                    {browseUserPoint
                      ? `${formatDistance(distanceM(browseUserPoint, browseStation))} away`
                      : ""}
                    {browseUserPoint && data.trainsEveryMinutes ? " · " : ""}
                    {data.trainsEveryMinutes ? `Trains every ${data.trainsEveryMinutes} min` : ""}
                  </span>
                </span>
                <ChevronDown className="ml-auto size-4 shrink-0 text-muted-foreground" />
              </button>
            ) : (
              <div className="nh-card p-4" aria-labelledby="browse-station-title">
                <div className="flex items-start gap-3">
                  <TrainFront className="mt-5 size-6 shrink-0 text-primary" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold uppercase tracking-[0.14em] text-muted-foreground">
                      Skyline station
                    </p>
                    <h3 id="browse-station-title" className="text-xl font-semibold text-foreground">
                      <Select
                        value={browseStation?.stopId ?? ""}
                        onValueChange={(stopId) => {
                          const station = browseStations.find((item) => item.stop_id === stopId);
                          if (!station) return;
                          data.rememberBrowseStation({
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
                              <StationName name={station.stop_name} />
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </h3>
                    {browseStation && <LandmarkHint name={browseStation.stopName} />}
                  </div>
                  {data.browseFar && (
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
                    {browseUserPoint && (
                      <span className="rounded-full border border-border px-2 py-0.5 text-foreground">
                        {formatDistance(distanceM(browseUserPoint, browseStation))} away
                      </span>
                    )}
                    {data.trainsEveryMinutes && (
                      <span className="rounded-full border border-border px-2 py-0.5 text-muted-foreground">
                        Trains every {data.trainsEveryMinutes} min
                      </span>
                    )}
                    {data.stationParking && (
                      <span className="rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-primary">
                        {data.stationParking.status === "limited"
                          ? "Limited parking"
                          : "Park & Ride available"}
                        {data.stationParking.note ? ` · ${data.stationParking.note}` : ""}
                      </span>
                    )}
                  </div>
                )}
                {browseStation &&
                  browseUserPoint &&
                  data.browseWalkMinutes !== null &&
                  data.browseWalkMinutes > 18 &&
                  data.feederBuses.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5 text-xs font-semibold text-foreground">
                      {data.feederBuses.slice(0, 2).map((bus) => (
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
                {data.browseLocationDenied && browseStation && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Location unavailable · showing a data-derived West Oahu station
                  </p>
                )}
                {browseStation && (
                  <div
                    className="mt-4 grid grid-cols-2 gap-3"
                    aria-label={`Departures from ${stationLabel(browseStation.stopName)}`}
                  >
                    {data.browseDeparturesLoading && (
                      <p className="text-sm text-muted-foreground">Loading departures…</p>
                    )}
                    {data.browseDeparturesFailed && (
                      <p className="col-span-2 text-sm text-warning">
                        Rail departure times are not available right now.
                      </p>
                    )}
                    {!data.browseDeparturesLoading &&
                      !data.browseDeparturesFailed &&
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
                      return (
                        <article
                          key={`${first?.route_id}-${first?.direction_id ?? "x"}`}
                          className="browse-departure-card nh-card nh-fade-in min-w-0 p-3"
                        >
                          <h4 className="text-sm font-semibold text-foreground">
                            {towardDowntown ? "Eastbound" : "Westbound"}
                          </h4>
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
                <p className="mt-1 text-xs text-muted-foreground">Scheduled times · TheBus / DTS</p>
                {browseStation && (
                  <button
                    type="button"
                    className="mt-2 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-primary"
                    onClick={() =>
                      setStartFrom({
                        name: stationLabel(browseStation.stopName).replace(/\s*\(.*\)\s*$/, ""),
                        lat: browseStation.lat,
                        lon: browseStation.lon,
                      })
                    }
                  >
                    Start a trip from here <ChevronRight aria-hidden="true" className="size-4" />
                  </button>
                )}
              </div>
            )}

            {browseUserPoint && (
              <details open className="nh-card nh-details mt-3">
                <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
                  <Bus aria-hidden="true" className="size-5 text-muted-foreground" />
                  <span className="text-base font-bold text-foreground">Nearby stops</span>
                  <span className="ml-auto whitespace-nowrap text-xs text-muted-foreground">
                    {data.nearbyStopsLoading && !listedStops.length
                      ? "Looking…"
                      : `${listedStops.length} ${listedStops.length === 1 ? "stop" : "stops"}`}
                  </span>
                  <ChevronDown
                    aria-hidden="true"
                    className="nh-chevron size-4 text-muted-foreground"
                  />
                </summary>
                <div className="border-t border-white/10 p-4">
                  <div
                    className="nh-rail-scroll pb-3"
                    role="group"
                    aria-label="Choose a nearby stop"
                  >
                    {listedStops.map((stop) => {
                      const Icon = stop.routeType === 1 ? TrainFront : Bus;
                      return (
                        <button
                          key={stop.stopId}
                          type="button"
                          aria-pressed={shownStop?.stopId === stop.stopId}
                          onClick={() => pickStop(stop.stopId)}
                          className="nh-stop max-w-56"
                          aria-label={`Show ${nearbyServiceLabel(stop)} at ${titleCase(stop.stopName)}`}
                        >
                          <Icon aria-hidden="true" className="size-4 shrink-0" />
                          <span className="min-w-0">
                            <span className="block truncate font-semibold">
                              {nearbyChipTitle(stop)}
                            </span>
                            <span className="block text-xs font-medium opacity-80">
                              {formatDistance(stop.distanceM)}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  {data.nearbyStopsLoading && (
                    <p className="text-sm text-muted-foreground">Finding nearby transit…</p>
                  )}
                  {shownStop && (
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-semibold text-foreground">
                            {shownStop.routeType === 1 ? (
                              <StationName
                                name={shownStop.stopName}
                                hawaiianClassName="text-xs font-normal"
                              />
                            ) : (
                              titleCase(shownStop.stopName)
                            )}
                          </div>
                          <LandmarkHint name={shownStop.stopName} />
                          <p className="mt-1 text-xs text-muted-foreground">
                            {formatDistance(shownStop.distanceM)} away
                          </p>
                        </div>
                        {shownStop.arrivals[0] && (
                          <p className="shrink-0 whitespace-nowrap text-lg font-bold tabular-nums text-primary">
                            {Math.max(
                              0,
                              Math.ceil(
                                (shownStop.arrivals[0].departure_seconds - nowSeconds) / 60,
                              ),
                            )}{" "}
                            min
                          </p>
                        )}
                      </div>
                      <div className="mt-3 divide-y divide-white/10">
                        {shownStop.arrivals.length ? (
                          shownStop.arrivals.slice(0, 3).map((arrival, index) => (
                            <div
                              key={`${arrival.departure_seconds}-${index}`}
                              className="flex items-center gap-2 py-2 text-sm text-foreground"
                            >
                              <span className="shrink-0 rounded-md bg-primary/15 px-2 py-1 font-bold text-primary">
                                {shownStop.routeType === 1
                                  ? "Skyline"
                                  : arrival.route_short_name || arrival.route_long_name || "Bus"}
                              </span>
                              <span className="min-w-0 flex-1 line-clamp-2 font-medium">
                                {arrival.headsign
                                  ? shownStop.routeType === 1
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
                      <a
                        href={plannerHref({
                          name: titleCase(shownStop.stopName),
                          lat: shownStop.lat,
                          lon: shownStop.lon,
                        })}
                        className="mt-3 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-primary"
                      >
                        Plan a trip to this stop{" "}
                        <ChevronRight aria-hidden="true" className="size-4" />
                      </a>
                      <button
                        type="button"
                        className="ml-4 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-primary"
                        onClick={() =>
                          setStartFrom({
                            name: titleCase(shownStop.stopName),
                            lat: shownStop.lat,
                            lon: shownStop.lon,
                          })
                        }
                      >
                        Start from here
                      </button>
                    </div>
                  )}
                </div>
              </details>
            )}
          </section>
        )}

        {/* FULL: the rest. Quiet cards last, never above content. */}
        {hasTransit && <WeeklyDigestCard />}

        {browseUserPoint && shownStop && stopPicked && (
          <section className="nb-card" aria-label="Walk to this stop">
            <h2 className="nb-card-title">Walk to {titleCase(shownStop.stopName)}</h2>
            <div className="nh-island-card rounded-2xl">
              <ClientOnly
                fallback={
                  <div className="h-40 animate-pulse bg-muted" aria-label="Loading walking map" />
                }
              >
                <Suspense
                  fallback={
                    <div className="h-40 animate-pulse bg-muted" aria-label="Loading walking map" />
                  }
                >
                  <WalkingMicroMap
                    from={{ ...browseUserPoint, label: "Your location" }}
                    to={{
                      lat: shownStop.lat,
                      lon: shownStop.lon,
                      label: titleCase(shownStop.stopName),
                    }}
                  />
                </Suspense>
              </ClientOnly>
            </div>
          </section>
        )}

        {hasTransit && gate.allows("ask_nalu") && <AskNaluIfAvailable origin={browseUserPoint} />}

        <div className="nb-quiet">
          <InstallNaluCard />
          {hasTransit && <LeaveAlertCard places={data.savedPlaces} variant="offer" />}
        </div>
      </BrowseSheet>
    </main>
  );
}
