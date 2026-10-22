import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { ClientOnly } from "@tanstack/react-router";
import {
  Bus,
  ChevronDown,
  ChevronRight,
  MapPinOff,
  Plus,
  Settings,
  TrainFront,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { WaveMark } from "@/components/commute/NaluPersonalityStrip";
import { WhereToSearch } from "@/components/home/WhereToSearch";
import "@/components/home/home.css";
import { Waves } from "@/components/home/Waves";
import { StationName } from "@/components/commute/StationName";
import { LandmarkHint } from "@/components/commute/TransitNotices";
import { WalkingMicroMap } from "@/components/commute/RailTripBreakdown";
import { DataExpiryNotice } from "@/components/commute/DataExpiry";
import { TONE_CLASS } from "@/components/commute/H1ConditionsCard";
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
import { waitText } from "@/lib/browse-peek";
import {
  incidentPins,
  roadLines,
  trafficSourceLabel,
  type MapFocus,
  type RightNowItem,
} from "@/lib/browse-right-now";
import { plannerHref } from "@/lib/home/planner-link";
import { findByKind, kindLabel } from "@/lib/places/saved-places";
import { activeRegion } from "@/lib/region";
import { useBrowseSheetOptIn, useLeaveBrowseSheet } from "./browse-flag";
import { BrowseSheet, type SheetState } from "./BrowseSheet";
import type { MapCommand, MapLayers, MapSelection } from "./BrowseMap";
import { MapControls } from "./MapControls";
import { RightNowBlock, RightNowLine } from "./RightNow";
import { RoadStatusRows } from "./OnTheRoad";
import { browseDemo } from "./browse-demo";
import { scrollBehavior } from "@/lib/motion";
import { useBrowseData } from "./useBrowseData";

const BrowseMap = lazy(() => import("./BrowseMap"));

const LAYERS_KEY = "nalu-browse-layers-v1";
const DEFAULT_LAYERS: MapLayers = {
  skyline: true,
  traffic: true,
  incidents: true,
  stops: true,
  places: true,
};

/** Test states (?demo=morning-clear | morning-incident | evening), development builds only. */
function readDemo() {
  if (!import.meta.env.DEV || typeof window === "undefined") return null;
  return browseDemo(new URLSearchParams(window.location.search).get("demo"));
}

/** A number that rolls up once when it changes (never on a redraw with the same value). */
function Roll({ value, children }: { value: string | number; children: React.ReactNode }) {
  return (
    <span key={value} className="nb-roll">
      {children}
    </span>
  );
}

/**
 * Browse as one live map with one bottom sheet (preview at /browse-preview).
 *   PEEK  Right now (one line) + Where to?
 *   HALF  Right now (up to 3 items), Where to?, saved places, Today
 *   FULL  On the road, Near you, then the quiet cards
 * Roads and stations follow the rider (their location, saved Home and Work),
 * in every direction: nothing here assumes the west side or a trip to work.
 */
export function BrowseSheetScreen({ onOpenSettings }: { onOpenSettings?: () => void } = {}) {
  const optedIn = useBrowseSheetOptIn();
  const leaveSheet = useLeaveBrowseSheet();
  const [demo] = useState(readDemo);
  const data = useBrowseData(demo);
  const gate = useGate();
  const { user } = useAuth();
  const [sheet, setSheet] = useState<SheetState>("peek");
  // The station card (map pin or tap) replaces the Near-you lists until closed.
  const [stationFocus, setStationFocus] = useState(false);
  const [stopsOpen, setStopsOpen] = useState(false);
  // True once the rider chose a stop themselves (a pin or a chip), not the default one.
  const [stopPicked, setStopPicked] = useState(false);
  const [activeItem, setActiveItem] = useState<string | null>(null);
  const [command, setCommand] = useState<MapCommand | null>(null);
  const nonce = useRef(0);

  const {
    browseStation,
    browseStations,
    browseUserPoint,
    browseDirections,
    nearbyStops,
    selectedNearbyStop,
    nowSeconds,
    rightNow,
    roadChecks,
  } = data;

  const hasTransit = activeRegion().hasTransit;
  // The nearest Skyline station has its own card; keep it out of the stop chips.
  const listedStops = nearbyStops.filter((stop) => stop.stopId !== browseStation?.stopId);
  const shownStop =
    listedStops.find((stop) => stop.stopId === selectedNearbyStop?.stopId) ??
    listedStops[0] ??
    null;

  const lines = roadLines(roadChecks);
  const pins = incidentPins(roadChecks, data.now.getTime());
  const trainSource = trafficSourceLabel(roadChecks);

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
          skyline: saved.skyline !== false,
          traffic: saved.traffic !== false,
          incidents: saved.incidents !== false,
          stops: saved.stops !== false,
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
  const nearRef = useRef<HTMLElement | null>(null);
  const stopsRef = useRef<HTMLElement | null>(null);
  const stationRef = useRef<HTMLElement | null>(null);

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
      ? [{ id: p.id, kind, label: p.label, address: p.address, lat: p.lat, lon: p.lon }]
      : [];
  });
  const selectedPlace =
    selection?.kind === "place" ? (mapPlaces.find((p) => p.id === selection.id) ?? null) : null;

  function openHalf() {
    setSheet((current) => (current === "peek" ? "half" : current));
  }

  function pickStop(stopId: string) {
    data.setSelectedNearbyStopId(stopId);
    setStopPicked(true);
    setSelection({ kind: "stop", id: stopId });
    setStationFocus(false);
    setStopsOpen(true);
    openHalf();
  }

  /** A pin was tapped: the sheet opens to the matching card. */
  function selectOnMap(next: MapSelection) {
    if (next.kind === "place") {
      setSelection(next);
      openHalf();
      return;
    }
    if (next.kind === "incident") {
      setSelection(next);
      setActiveItem(next.id);
      openHalf();
      return;
    }
    const inNearby = nearbyStops.some((stop) => stop.stopId === next.id);
    if (next.kind === "stop" && next.id !== browseStation?.stopId) {
      pickStop(next.id);
      return;
    }
    if (next.kind === "stop" && inNearby && next.id === browseStation?.stopId) {
      setStationFocus(true);
      setSelection({ kind: "station", id: next.id });
      openHalf();
      return;
    }
    // A Skyline station that is not the nearest becomes "Near you".
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
    setStationFocus(true);
    setSelection(next);
    openHalf();
  }

  function closeStation() {
    setStationFocus(false);
    setSelection(null);
  }

  /** A Right now item was tapped: the map flies to it. */
  function flyTo(item: RightNowItem, focus: MapFocus | null) {
    setActiveItem(item.id);
    if (!focus) return;
    nonce.current += 1;
    setCommand(
      focus.kind === "point"
        ? { nonce: nonce.current, type: "point", point: focus.point }
        : { nonce: nonce.current, type: "path", points: focus.points },
    );
  }
  function locate() {
    nonce.current += 1;
    setCommand({ nonce: nonce.current, type: "locate" });
  }

  // Bring the matching card into view when something is selected on the map.
  useEffect(() => {
    if (!selection) return;
    const frame = window.requestAnimationFrame(() => {
      const target =
        selection.kind === "place" || selection.kind === "incident"
          ? null
          : selection.kind === "stop" && selection.id !== browseStation?.stopId
            ? (stopsRef.current ?? nearRef.current)
            : (stationRef.current ?? nearRef.current);
      const body = (target ?? nearRef.current)?.closest(".nb-sheet-body") as HTMLElement | null;
      if (!body) return;
      const top = target
        ? target.getBoundingClientRect().top - body.getBoundingClientRect().top + body.scrollTop - 8
        : 0;
      body.scrollTo({ top, behavior: scrollBehavior() });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [selection]);

  const header =
    sheet === "peek" ? (
      <RightNowLine now={rightNow} onOpen={openHalf} />
    ) : (
      <RightNowBlock now={rightNow} activeId={activeItem} onFocus={flyTo} />
    );
  const peek = (
    <div>
      {header}
      <div className="nb-where" onFocusCapture={openHalf}>
        <WhereToSearch />
      </div>
    </div>
  );

  const skylineFar = data.skylineOutOfReach;
  const stationCard =
    browseStation && !skylineFar ? (
      <StationCard
        data={data}
        stationRef={stationRef}
        onClose={closeStation}
        focus={stationFocus}
      />
    ) : null;

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
                  traffic={lines}
                  incidents={pins}
                  command={command}
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
                ? "Location is off, so the map is hidden. Turn it on to see roads and Skyline near you."
                : "Finding where you are…"}
            </p>
          </div>
        )}
      </div>

      {browseUserPoint && (
        <MapControls
          layers={layers}
          onToggle={toggleLayer}
          onLocate={locate}
          trafficSource={trainSource}
        />
      )}

      <div className="nb-brand">
        <WaveMark className="h-5 w-auto text-foreground" />
        <span className="text-base font-medium tracking-wide">Nalu</span>
        <span className="hidden pr-2 text-xs text-muted-foreground min-[380px]:inline">
          {alohaGreeting(data.now, profileFirstName(user))}
        </span>
        {onOpenSettings && (
          <button
            type="button"
            aria-label="Open settings"
            onClick={onOpenSettings}
            className="inline-flex size-11 items-center justify-center rounded-full text-muted-foreground active:bg-white/10"
          >
            <Settings aria-hidden="true" className="size-5" />
          </button>
        )}
      </div>

      <BrowseSheet state={sheet} onStateChange={setSheet} peek={peek}>
        {!hasTransit && (
          <p className="mt-2 w-fit rounded-full border border-warning/40 bg-warning/10 px-3 py-1 text-xs font-semibold text-warning">
            Test: {activeRegion().name} · driving and rides only
          </p>
        )}
        {optedIn && (
          <button
            type="button"
            onClick={leaveSheet}
            className="mt-2 inline-flex min-h-11 items-center rounded-full border border-white/15 px-4 text-sm font-semibold text-foreground active:bg-white/10"
          >
            Back to current Browse
          </button>
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

        {selectedPlace && (
          <section className="nb-select-card nh-card p-4" aria-label={`${selectedPlace.label}`}>
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
                  {selectedPlace.kind === "home" ? "Home" : "Work"}
                </p>
                <p className="mt-0.5 break-words text-lg font-semibold text-foreground">
                  {selectedPlace.address || selectedPlace.label}
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
                window.location.assign(
                  plannerHref({
                    name: selectedPlace.label,
                    lat: selectedPlace.lat,
                    lon: selectedPlace.lon,
                  }),
                )
              }
            >
              Plan trip
            </Button>
          </section>
        )}

        {/* The station card replaces the Near-you lists while a station is picked. */}
        {stationFocus && stationCard}

        {/* Saved places are shortcuts, never assumptions: no default destination. */}
        <div className="nh-rail-scroll mt-1" role="group" aria-label="Saved places">
          {data.savedPlaces.slice(0, 4).map((place) => {
            const Icon = shortcutIcon(place.kind);
            return (
              <a
                key={place.id}
                href={plannerHref({
                  name: place.name || place.label,
                  lat: place.lat,
                  lon: place.lon,
                })}
                className="nh-chip"
                aria-label={`Plan a trip to ${place.label || kindLabel(place.kind)}`}
              >
                <Icon aria-hidden="true" className="size-4 text-muted-foreground" />{" "}
                {place.label || kindLabel(place.kind)}
              </a>
            );
          })}
          <a href="/" className="nh-chip" aria-label="Add a place">
            <Plus aria-hidden="true" className="size-4 text-muted-foreground" />
            {data.savedPlaces.length ? "" : "Add place"}
          </a>
        </div>

        {/* Today: Morning / Evening Pulse and Beat the Rush (each in its own time window) */}
        {hasTransit && (
          <section className="nb-card nb-today" aria-label="Today">
            <h2 className="nb-card-title">Today</h2>
            <div className="nh-card nb-today-card">
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

        {/* On the road: the rider's own roads both ways, roadwork, weather */}
        <section className="nb-card" aria-label="On the road">
          <h2 className="nb-card-title">On the road</h2>
          <div className="nh-card nb-card-inner">
            <RoadStatusRows
              checks={roadChecks}
              loading={rightNow.status === "loading"}
              unavailable={rightNow.status === "failed"}
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

        {/* Near you: nearest Skyline station (wherever the rider is) + nearby stops */}
        {hasTransit && (
          <section ref={nearRef} className="nb-card" aria-label="Near you">
            <h2 className="nb-card-title">Near you</h2>
            {skylineFar && browseStation ? (
              <div className="nh-card flex items-start gap-3 px-4 py-3 text-sm">
                <TrainFront
                  aria-hidden="true"
                  className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                />
                <p className="text-muted-foreground">
                  <span className="font-semibold text-foreground">
                    Skyline doesn’t reach this area.
                  </span>{" "}
                  The closest station, {stationLabel(browseStation.stopName)}, is{" "}
                  {formatDistance(data.browseStationMeters ?? 0)} away. Buses near you are below.
                </p>
              </div>
            ) : !stationFocus && stationCard ? (
              stationCard
            ) : !browseStation ? (
              <p className="nh-card px-4 py-3 text-sm text-muted-foreground">
                {data.browseLocationDenied
                  ? "Turn on location to see the closest Skyline station."
                  : "Finding the closest Skyline station…"}
              </p>
            ) : null}

            {browseUserPoint && (
              <details
                ref={stopsRef as React.RefObject<HTMLDetailsElement>}
                open={stopsOpen}
                onToggle={(event) => setStopsOpen((event.currentTarget as HTMLDetailsElement).open)}
                className="nh-card nh-details mt-3"
              >
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
                            {waitText(
                              Math.max(
                                0,
                                Math.ceil(
                                  (shownStop.arrivals[0].departure_seconds - nowSeconds) / 60,
                                ),
                              ),
                            )}
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

type BrowseData = ReturnType<typeof useBrowseData>;

/** The closest Skyline station: two directions as scheduled, then each direction's last train. */
function StationCard({
  data,
  stationRef,
  onClose,
  focus,
}: {
  data: BrowseData;
  stationRef: React.RefObject<HTMLElement | null>;
  onClose: () => void;
  focus: boolean;
}) {
  const { browseStation, browseDirections, browseLastTrains, nowSeconds, browseUserPoint } = data;
  if (!browseStation) return null;
  return (
    <section
      ref={stationRef}
      className={`nb-station nh-card p-4 ${focus ? "nb-select-card mt-3" : ""}`}
      aria-label="Skyline station"
    >
      <div className="flex items-start gap-3">
        <TrainFront aria-hidden="true" className="mt-1 size-5 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-semibold leading-tight text-foreground">
            <StationName name={browseStation.stopName} hawaiianClassName="text-xs font-normal" />
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {browseUserPoint
              ? `${formatDistance(distanceM(browseUserPoint, browseStation))} away`
              : ""}
            {browseUserPoint && data.trainsEveryMinutes ? " · " : ""}
            {data.trainsEveryMinutes ? `Trains every ${data.trainsEveryMinutes} min` : ""}
            {data.stationParking
              ? ` · ${data.stationParking.status === "limited" ? "Limited parking" : "Park & Ride"}`
              : ""}
          </p>
          <LandmarkHint name={browseStation.stopName} />
        </div>
        {focus && (
          <Button
            size="icon"
            variant="ghost"
            className="size-11 shrink-0"
            aria-label="Close station"
            onClick={onClose}
          >
            <X className="size-4" />
          </Button>
        )}
      </div>

      <div
        className="mt-3 divide-y divide-white/10"
        aria-label={`Departures from ${stationLabel(browseStation.stopName)}`}
      >
        {data.browseDeparturesLoading && (
          <p className="py-2 text-sm text-muted-foreground">Loading departures…</p>
        )}
        {data.browseDeparturesFailed && (
          <p className="py-2 text-sm text-warning">
            Rail departure times are not available right now.
          </p>
        )}
        {!data.browseDeparturesLoading &&
          !data.browseDeparturesFailed &&
          browseDirections.length === 0 && (
            <p className="py-2 text-sm text-muted-foreground">
              No rail departures are scheduled from this station right now.
            </p>
          )}
        {browseDirections.slice(0, 2).map((direction) => {
          const first = direction[0];
          if (!first) return null;
          const towardDowntown =
            first.terminus_lon !== null &&
            first.terminus_lon !== undefined &&
            first.terminus_lon > browseStation.lon;
          const endpoint =
            terminusLabel(first.direction_terminus) ||
            stationLabel(first.trip_headsign) ||
            "the end of the line";
          const secondsAway = first.departure_seconds - nowSeconds;
          const minutesAway = Math.max(1, Math.ceil(secondsAway / 60));
          const nowDeparture = secondsAway >= -30 && secondsAway < 60;
          const soon = secondsAway >= 60 && secondsAway < 20 * 60;
          const key = `${first.route_id}-${first.direction_id ?? "x"}`;
          const last = browseLastTrains.get(key);
          const lastGone = last ? last.departure_seconds < nowSeconds - 30 : false;
          const lastSoon = last
            ? last.departure_seconds >= nowSeconds && last.departure_seconds - nowSeconds <= 90 * 60
            : false;
          return (
            <div key={key} className="py-2.5">
              <div className="flex items-baseline justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">
                    {towardDowntown ? "Eastbound" : "Westbound"}
                  </p>
                  <p className="text-xs text-muted-foreground">to {endpoint}</p>
                </div>
                <p className="shrink-0 text-right text-xl font-semibold tabular-nums text-primary">
                  {nowDeparture ? (
                    <Roll value="now">Now</Roll>
                  ) : soon ? (
                    <Roll value={minutesAway}>in {minutesAway} min</Roll>
                  ) : (
                    clockFromSeconds(first.departure_seconds)
                  )}
                  {(nowDeparture || soon) && (
                    <span className="block text-xs font-normal text-muted-foreground">
                      {clockFromSeconds(first.departure_seconds)}
                    </span>
                  )}
                </p>
              </div>
              {last && (
                <p
                  className={`nb-last mt-1.5 text-xs ${lastSoon ? "nb-last-soon text-foreground" : "text-muted-foreground"}`}
                >
                  {lastGone
                    ? `Last train tonight was ${clockFromSeconds(last.departure_seconds)}`
                    : `Last train ${clockFromSeconds(last.departure_seconds)}`}
                </p>
              )}
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        As scheduled · timetable from TheBus / DTS, not live tracking
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        HOLO fare {HOLO_FARES.singleRide} · free TheBus–Skyline transfers for{" "}
        {HOLO_FARES.transferWindowHours} hours
      </p>
      <a
        href={plannerHref({
          name: stationLabel(browseStation.stopName),
          lat: browseStation.lat,
          lon: browseStation.lon,
        })}
        className="mt-2 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-primary"
      >
        Plan a trip to this station <ChevronRight aria-hidden="true" className="size-4" />
      </a>
    </section>
  );
}
