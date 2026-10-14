import { lazy } from "react";
import { profileFirstName, nearbyServiceLabel, nearbyChipTitle } from "@/lib/commute-model";
import {
  alohaGreeting,
  clockFromSeconds,
  titleCase,
  walkingEstimate,
  formatDistance,
  stationLabel,
  distanceM,
  terminusLabel,
} from "@/lib/commute-formatting";
import { WaveMark } from "@/components/commute/NaluPersonalityStrip";
import { Button } from "@/components/ui/button";
import {
  RefreshCw,
  Settings,
  Search,
  ChevronRight,
  Plus,
  Bus,
  ChevronDown,
  TrainFront,
} from "lucide-react";
import { AccountButton } from "@/components/account/AccountDialog";
import { Tagline } from "@/components/brand/Tagline";
import { activeRegion } from "@/lib/region";
import { CommutePageNav } from "@/components/commute/CommutePageNav";
import { DataExpiryNotice } from "@/components/commute/DataExpiry";
import {
  MorningPulse,
  EveningPulse,
  BeatTheRush,
  WeeklyDigestCard,
  AskNaluIfAvailable,
} from "@/components/ai/NaluAi";
import { shortcutIcon, ShortcutGrid } from "@/components/places/Shortcuts";
import { findByKind, kindLabel } from "@/lib/saved-places";
import { InstallNaluCard } from "@/components/InstallNaluCard";
import { LeaveAlertCard } from "@/components/LeaveAlertCard";
import { ClientOnly } from "@tanstack/react-router";
import { Suspense } from "react";
import { StationName } from "@/components/commute/StationName";
import { LandmarkHint } from "@/components/commute/TransitNotices";
import { WalkingMicroMap } from "@/components/commute/RailTripBreakdown";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { HOLO_FARES } from "@/lib/fares";
import { H1ConditionsCard, TONE_CLASS } from "@/components/commute/H1ConditionsCard";
import { RoadworkTile } from "@/components/commute/RoadworkTile";

const NearbyTransitMap = lazy(() => import("@/components/NearbyTransitMap"));

export type BrowseScreenProps = {
  browseDeparturesFailed: boolean;
  browseDeparturesLoading: boolean;
  browseDirections: import("@/lib/commute-model").BrowseDeparture[][];
  browseFar: boolean;
  browseHome: { lat: number; lon: number; label: string } | null;
  browseLocationDenied: boolean;
  browseStation: import("@/lib/commute-model").BrowseStation | null;
  browseStations: import("@/lib/commute-model").RailStation[];
  browseUserPoint: { lat: number; lon: number } | null;
  browseWalkMinutes: number | null;
  browseWeather: NoInfer<import("@/lib/weather.functions").WeatherResult> | undefined;
  browseWeatherFailed: boolean;
  browseWeatherLine: import("@/components/commute/H1ConditionsCard").WeatherLine | null;
  browseWeatherSummary: string;
  browseWork: { lat: number; lon: number; label: string } | null;
  eastboundTraffic: NoInfer<import("@/lib/drive.functions").DriveTime> | undefined;
  eastboundTrafficFailed: boolean;
  eastboundTrafficLoading: boolean;
  feederBuses: NoInfer<
    {
      alight_stop_name: string;
      arrive_seconds: number;
      board_stop_name: string;
      board_walk_m: number;
      depart_seconds: number;
      ride_minutes: number;
      route_short_name: string;
    }[]
  >;
  gate: {
    tier: import("@/lib/tiers").Tier;
    allows: (feature: import("@/lib/tiers").Feature) => boolean;
    require(feature: import("@/lib/tiers").Feature): boolean;
    tripCheck(): boolean;
  };
  locationDenied: boolean;
  mapStopActionBusy: boolean;
  nearbyStops: NoInfer<import("@/lib/commute-model").NearbyStop[]>;
  nearbyStopsLoading: boolean;
  now: Date;
  nowSeconds: number;
  online: boolean;
  openSettingsList: () => void;
  persistPlaces: (next: import("@/lib/places/saved-places").SavedPlace[]) => void;
  quickStartSavedPlace: (slot: string, options?: { auto?: boolean }) => Promise<void>;
  refresh: () => Promise<void>;
  refreshing: boolean;
  rememberBrowseStation: (next: import("@/lib/commute-model").BrowseStation) => void;
  savedPlaces: import("@/lib/places/saved-places").SavedPlace[];
  selectedNearbyStop: import("@/lib/commute-model").NearbyStop | null;
  setAccountOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setMapStopAsDestination: (
    stop: import("@/components/NearbyTransitMap").NearbyMapStop,
  ) => Promise<void>;
  setMapStopAsStart: (stop: import("@/components/NearbyTransitMap").NearbyMapStop) => Promise<void>;
  setOnboardingOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setPageView: React.Dispatch<React.SetStateAction<"browse" | "commute">>;
  setRestoreSlot: React.Dispatch<React.SetStateAction<string | null>>;
  setSelectedNearbyStopId: React.Dispatch<React.SetStateAction<string | null>>;
  setStationExpanded: React.Dispatch<React.SetStateAction<boolean>>;
  setupDialog: React.JSX.Element;
  stationExpanded: boolean;
  stationParking: { name_match: string; note: string | null; status: string } | null;
  timeText: string;
  trainsEveryMinutes: number | null;
  user:
    | import("/home/user/ridewithnalu/node_modules/@supabase/auth-js/dist/module/lib/types").User
    | null;
  westboundTraffic: NoInfer<import("@/lib/drive.functions").DriveTime> | undefined;
  westboundTrafficFailed: boolean;
  westboundTrafficLoading: boolean;
};

export function BrowseScreen(props: BrowseScreenProps) {
  const {
    browseDeparturesFailed,
    browseDeparturesLoading,
    browseDirections,
    browseFar,
    browseHome,
    browseLocationDenied,
    browseStation,
    browseStations,
    browseUserPoint,
    browseWalkMinutes,
    browseWeather,
    browseWeatherFailed,
    browseWeatherLine,
    browseWeatherSummary,
    browseWork,
    eastboundTraffic,
    eastboundTrafficFailed,
    eastboundTrafficLoading,
    feederBuses,
    gate,
    locationDenied,
    mapStopActionBusy,
    nearbyStops,
    nearbyStopsLoading,
    now,
    nowSeconds,
    online,
    openSettingsList,
    persistPlaces,
    quickStartSavedPlace,
    refresh,
    refreshing,
    rememberBrowseStation,
    savedPlaces,
    selectedNearbyStop,
    setAccountOpen,
    setMapStopAsDestination,
    setMapStopAsStart,
    setOnboardingOpen,
    setPageView,
    setRestoreSlot,
    setSelectedNearbyStopId,
    setStationExpanded,
    setupDialog,
    stationExpanded,
    stationParking,
    timeText,
    trainsEveryMinutes,
    user,
    westboundTraffic,
    westboundTrafficFailed,
    westboundTrafficLoading,
  } = props;
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
  return (
    <main className="browse-radiance min-h-dvh px-5 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))] text-foreground">
      <div className="mx-auto flex w-full max-w-[440px] flex-col">
        <header className="flex min-h-11 items-start justify-between gap-4">
          <div>
            <p className="mb-1 text-xs font-semibold text-recommended">
              {alohaGreeting(now, profileName)}
            </p>
            <div className="flex items-center gap-1.5">
              <WaveMark className="h-6 w-auto text-foreground" />
              <p className="text-lg font-medium tracking-wide text-foreground">Nalu</p>
            </div>
          </div>
          <div className="flex max-w-[65%] flex-wrap items-center justify-end gap-1">
            <p className="w-full text-right text-xs font-medium text-foreground">{timeText}</p>
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
            <AccountButton
              onClick={() => {
                setRestoreSlot(null);
                setAccountOpen(true);
              }}
            />
            <Button
              variant="ghost"
              size="icon"
              aria-label="Open settings"
              onClick={() => openSettingsList()}
              className="size-11 shrink-0 rounded-full text-muted-foreground hover:text-foreground"
            >
              <Settings className="size-5" />
            </Button>
          </div>
        </header>
        <Tagline className="mt-2" />
        {!activeRegion().hasTransit && (
          <p className="mt-2 w-fit rounded-full border border-warning/40 bg-warning/10 px-3 py-1 text-xs font-semibold text-warning">
            Test: {activeRegion().name} · driving and rides only
          </p>
        )}

        <CommutePageNav current="browse" onBrowse={() => setPageView("browse")} />

        {/* The Home/Work shortcut cards below already start these trips in one tap. */}

        <DataExpiryNotice />
        {!online && (
          <p
            role="status"
            className="mt-3 rounded-lg border border-border bg-surface-raised px-4 py-3 text-sm text-muted-foreground"
          >
            You’re offline. Available schedules stay visible; live arrivals will refresh when you
            reconnect.
          </p>
        )}
        {/* Oʻahu commute cards use Oʻahu Home/Work; off in the SF test. */}
        {activeRegion().hasTransit && (
          <>
            <MorningPulse
              home={browseHome}
              work={browseWork}
              trainsEveryMinutes={trainsEveryMinutes}
            />
            <EveningPulse
              home={browseHome}
              work={browseWork}
              trainsEveryMinutes={trainsEveryMinutes}
            />
            <BeatTheRush home={browseHome} work={browseWork} />
            <WeeklyDigestCard />
          </>
        )}

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
          {/* Home and Work have their own cards just below; avoid showing them twice. */}
          {(["gym"] as const).map((kind) => {
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
            onClick={() => openSettingsList()}
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

        <InstallNaluCard />
        {activeRegion().hasTransit && <LeaveAlertCard places={savedPlaces} variant="offer" />}

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
                      minutesAway: Math.max(
                        0,
                        Math.ceil((arrival.departure_seconds - nowSeconds) / 60),
                      ),
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
                role="img"
                className="size-3 rounded-full border-2 border-foreground bg-location shadow-[0_0_10px_var(--color-location)]"
                aria-label="Your location"
              />
              <span className="text-xs font-semibold text-foreground">You</span>
            </div>
          </section>
        )}

        {browseUserPoint && (
          <details open className="glass-panel mt-4 rounded-lg">
            <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
              <Bus className="size-5 text-primary" />
              <span className="font-semibold text-foreground">Nearby stops</span>
              <span className="ml-auto whitespace-nowrap text-xs text-muted-foreground">
                {nearbyStopsLoading && !nearbyStops.length
                  ? "Looking…"
                  : `${nearbyStops.length} ${nearbyStops.length === 1 ? "stop" : "stops"}`}
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
                      variant={selectedNearbyStop?.stopId === stop.stopId ? "default" : "secondary"}
                      size="sm"
                      onClick={() => setSelectedNearbyStopId(stop.stopId)}
                      className="h-auto max-w-56 shrink-0 justify-start gap-2 px-3 py-2 text-left"
                      aria-label={`Show ${nearbyServiceLabel(stop)} at ${titleCase(stop.stopName)}`}
                    >
                      <Icon className="size-4 shrink-0" />
                      <span className="min-w-0">
                        <span className="block truncate font-semibold">
                          {nearbyChipTitle(stop)}
                        </span>
                        <span className="block text-xs font-medium opacity-80">
                          {walkingEstimate(browseUserPoint, stop).minutes} min walk
                        </span>
                      </span>
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
                    <div className="min-w-0">
                      <div className="font-semibold text-foreground">
                        {selectedNearbyStop.routeType === 1 ? (
                          <StationName
                            name={selectedNearbyStop.stopName}
                            hawaiianClassName="text-xs font-normal"
                          />
                        ) : (
                          titleCase(selectedNearbyStop.stopName)
                        )}
                      </div>
                      <LandmarkHint name={selectedNearbyStop.stopName} />
                      <p className="mt-1 text-xs text-muted-foreground">
                        Walk {walkingEstimate(browseUserPoint, selectedNearbyStop).minutes} min ·{" "}
                        {formatDistance(selectedNearbyStop.distanceM)}
                      </p>
                    </div>
                    {selectedNearbyStop.arrivals[0] && (
                      <p className="shrink-0 whitespace-nowrap text-lg font-bold tabular-nums text-primary">
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
                          <span className="min-w-0 flex-1 line-clamp-2 font-medium">
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
                  <p className="mt-1 text-xs text-muted-foreground">
                    Scheduled times · TheBus / DTS
                  </p>
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

        {/* Skyline, H-1 and Oʻahu weather: off in the SF test. */}
        {activeRegion().hasTransit && (
          <>
            {browseStation && browseFar && !stationExpanded ? (
              <button
                type="button"
                onClick={() => setStationExpanded(true)}
                className="glass-panel mt-4 flex w-full min-w-0 items-center gap-2 rounded-2xl px-4 py-3 text-left text-sm"
                aria-label="Show Skyline station details"
              >
                <TrainFront className="size-4 shrink-0 text-primary" />
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-foreground">
                    <StationName name={browseStation.stopName} />
                  </span>
                  <span className="block text-muted-foreground">
                    {browseUserPoint
                      ? `${Math.max(1, Math.ceil(distanceM(browseUserPoint, browseStation) / 670))} min drive`
                      : ""}
                    {browseUserPoint && trainsEveryMinutes ? " · " : ""}
                    {trainsEveryMinutes ? `Trains every ${trainsEveryMinutes} min` : ""}
                  </span>
                </span>
                <ChevronDown className="ml-auto size-4 shrink-0 text-muted-foreground" />
              </button>
            ) : (
              <section
                className="glass-panel mt-4 rounded-lg p-4"
                aria-labelledby="browse-station-title"
              >
                <div className="flex items-start gap-3">
                  <TrainFront className="mt-5 size-6 shrink-0 text-primary" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold uppercase text-muted-foreground">
                      Skyline station
                    </p>
                    <h2 id="browse-station-title" className="text-xl font-semibold text-foreground">
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
                  <div className="mt-3 flex flex-wrap gap-1.5 text-xs font-semibold">
                    {browseUserPoint && browseWalkMinutes !== null && browseWalkMinutes <= 18 && (
                      <span className="rounded-full border border-border px-2 py-0.5 text-foreground">
                        Walk {browseWalkMinutes} min ·{" "}
                        {formatDistance(walkingEstimate(browseUserPoint, browseStation).meters)}
                      </span>
                    )}
                    {browseUserPoint && (
                      <span className="rounded-full border border-border px-2 py-0.5 text-foreground">
                        Drive about{" "}
                        {Math.max(1, Math.ceil(distanceM(browseUserPoint, browseStation) / 670))}{" "}
                        min
                      </span>
                    )}
                    {trainsEveryMinutes && (
                      <span className="rounded-full border border-border px-2 py-0.5 text-muted-foreground">
                        Trains every {trainsEveryMinutes} min
                      </span>
                    )}
                    {stationParking && (
                      <span className="rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-primary">
                        {stationParking.status === "limited"
                          ? "Limited parking"
                          : "Park & Ride available"}
                        {stationParking.note ? ` · ${stationParking.note}` : ""}
                      </span>
                    )}
                  </div>
                )}
                {browseStation &&
                  browseUserPoint &&
                  browseWalkMinutes !== null &&
                  browseWalkMinutes > 18 &&
                  feederBuses.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5 text-xs font-semibold text-foreground">
                      {feederBuses.slice(0, 2).map((bus) => (
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
                {browseLocationDenied && browseStation && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Location unavailable · showing a data-derived West Oahu station
                  </p>
                )}
                {browseLocationDenied && locationDenied && (
                  <Button
                    variant="link"
                    onClick={() => openSettingsList()}
                    className="mt-1 h-auto px-0 text-xs text-muted-foreground"
                  >
                    Location blocked · see how to allow it
                  </Button>
                )}

                {browseStation && (
                  <div
                    className={`mt-4 grid grid-cols-2 gap-3 ${refreshing ? "animate-in fade-in duration-300" : ""}`}
                    aria-label={`Departures from ${stationLabel(browseStation.stopName)}`}
                  >
                    {browseDeparturesLoading && (
                      <p className="text-sm text-muted-foreground">Loading departures…</p>
                    )}
                    {browseDeparturesFailed && (
                      <p className="col-span-2 text-sm text-warning">
                        Rail departure times are not available right now.
                      </p>
                    )}
                    {!browseDeparturesLoading &&
                      !browseDeparturesFailed &&
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
                <p className="mt-1 text-xs text-muted-foreground">
                  Scheduled times · TheBus / DTS
                  {h1HasMeaningfulDelay
                    ? " · H-1 is delayed, so Skyline may be especially useful"
                    : ""}
                </p>
              </section>
            )}

            {gate.allows("ask_nalu") && <AskNaluIfAvailable origin={browseUserPoint} />}

            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <H1ConditionsCard
                eastbound={eastboundTraffic}
                westbound={westboundTraffic}
                loading={trafficLoading}
                unavailable={trafficUnavailable}
                compact
                className=""
              />
              <details className="glass-panel rounded-lg">
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
                  ) : browseWeather ? (
                    <p className="text-sm text-muted-foreground">
                      No weather or air-quality concerns right now.
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {browseWeatherFailed || (!browseStation && browseLocationDenied)
                        ? "Weather isn’t available right now."
                        : "Checking weather…"}
                    </p>
                  )}
                  <p className="mt-2 text-xs text-muted-foreground">
                    Weather: NWS · Air quality: AirNow / EPA
                  </p>
                </div>
              </details>
              <RoadworkTile className="sm:col-span-2" />
            </div>
          </>
        )}
      </div>
      {setupDialog}
    </main>
  );
}
