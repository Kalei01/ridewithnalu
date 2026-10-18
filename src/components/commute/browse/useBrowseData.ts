import { useEffect, useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { driveTime, type DriveTime } from "@/lib/drive.functions";
import { outdoorConditions } from "@/lib/weather.functions";
import { airLine, type WeatherLine } from "@/components/commute/H1ConditionsCard";
import { useRailStations } from "@/hooks/use-rail-stations";
import {
  BROWSE_LOCATION_DENIED_KEY,
  BROWSE_STATION_KEY,
  DOWNTOWN_POINT,
  KAPOLEI_POINT,
  STORAGE_KEY,
  type BrowseDeparture,
  type BrowseStation,
  type Coords,
  type NearbyArrival,
  type NearbyStop,
} from "@/lib/commute-model";
import {
  distanceM,
  honoluluSeconds,
  stationLabel,
  walkingEstimate,
} from "@/lib/commute-formatting";
import { skylineFallbackHeadwayMinutes } from "@/lib/rail/skyline-fallback";
import { weatherSummaryText } from "@/lib/loading-labels";
import { isPermissionDeniedError } from "@/lib/location-permission";
import {
  LEGACY_SAVED_PLACES_KEY,
  SAVED_PLACES_KEY,
  findByKind,
  migrateSavedPlaces,
  type SavedPlace,
} from "@/lib/places/saved-places";

const NO_STATIONS: import("@/lib/commute-model").RailStation[] = [];

/**
 * Everything the Browse sheet shows, read the same way the Browse screen in
 * src/routes/index.tsx reads it (same queries, same server calls, same cache
 * keys), so the preview answers exactly what Browse answers. It only reads;
 * the one thing it writes is the remembered station, the same key Browse uses.
 * When Browse's state moves out of index.tsx (Phase 3), this hook is the
 * piece to replace with the shared one.
 */
export function useBrowseData() {
  const [hydrated, setHydrated] = useState(false);
  const [savedPlaces, setSavedPlaces] = useState<SavedPlace[]>([]);
  const [now, setNow] = useState(() => new Date());
  const [online, setOnline] = useState(true);
  const [browseStation, setBrowseStation] = useState<BrowseStation | null>(null);
  const [browseLocationDenied, setBrowseLocationDenied] = useState(false);
  const [selectedNearbyStopId, setSelectedNearbyStopId] = useState<string | null>(null);

  useEffect(() => {
    const places = migrateSavedPlaces(
      window.localStorage.getItem(SAVED_PLACES_KEY),
      window.localStorage.getItem(LEGACY_SAVED_PLACES_KEY),
      window.localStorage.getItem(STORAGE_KEY),
    );
    setSavedPlaces(places);
    setHydrated(true);
  }, []);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const { data: browseStations = NO_STATIONS } = useRailStations(hydrated);
  const nowSeconds = honoluluSeconds(now);
  const scheduleAfterSeconds = Math.floor(nowSeconds / 60) * 60;

  function rememberBrowseStation(next: BrowseStation) {
    setBrowseStation(next);
    window.localStorage.setItem(BROWSE_STATION_KEY, JSON.stringify(next));
  }

  // Closest rail station to the rider; the west-side default when location is unavailable.
  useEffect(() => {
    if (!hydrated || browseStation || browseLocationDenied) return;
    if (!navigator.geolocation) {
      setBrowseLocationDenied(true);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;
        const { data, error } = await supabase.rpc("nearest_stop", {
          p_lat: lat,
          p_lon: lon,
          p_rail_only: true,
        });
        const nearest = data?.[0];
        if (error || !nearest) {
          setBrowseLocationDenied(true);
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
        if (isPermissionDeniedError(error)) {
          // Same remembered answer the Browse screen keeps, so the question is not repeated.
          window.localStorage.setItem(BROWSE_LOCATION_DENIED_KEY, "1");
        }
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
    );
  }, [hydrated, browseStation, browseLocationDenied]);

  useEffect(() => {
    if (!browseLocationDenied || browseStation || browseStations.length === 0) return;
    const nearest = browseStations
      .filter((station) => station.stop_lat !== null && station.stop_lon !== null)
      .map((station) => ({
        station,
        distance: distanceM(KAPOLEI_POINT, {
          lat: Number(station.stop_lat),
          lon: Number(station.stop_lon),
        }),
      }))
      .sort((a, b) => a.distance - b.distance)[0]?.station;
    if (!nearest) return;
    rememberBrowseStation({
      stopId: nearest.stop_id,
      stopName: nearest.stop_name ?? "",
      lat: Number(nearest.stop_lat),
      lon: Number(nearest.stop_lon),
    });
  }, [browseLocationDenied, browseStation, browseStations]);

  const {
    data: browseDepartures = [],
    isLoading: browseDeparturesLoading,
    isError: browseDeparturesFailed,
  } = useQuery({
    queryKey: ["browse-departures", browseStation?.stopId, Math.floor(scheduleAfterSeconds / 60)],
    enabled: hydrated && Boolean(browseStation?.stopId),
    staleTime: 120_000,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("rail_departures", {
        p_home_stop: browseStation?.stopId as string,
        p_after_seconds: scheduleAfterSeconds,
        p_limit: 3,
      });
      if (error) throw error;
      return (data ?? []) as BrowseDeparture[];
    },
  });

  const browseDirections = useMemo(() => {
    const here = stationLabel(browseStation?.stopName).toLowerCase();
    const groups = new Map<string, BrowseDeparture[]>();
    for (const departure of browseDepartures) {
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

  const browseFar = Boolean(
    browseUserPoint && browseStation && distanceM(browseUserPoint, browseStation) > 2414,
  );
  const browseWalkMinutes =
    browseUserPoint && browseStation
      ? walkingEstimate(browseUserPoint, browseStation).minutes
      : null;
  const trainsEveryMinutes = useMemo(() => {
    const gaps = browseDirections
      .map((d) =>
        d[0] && d[1] ? Math.round((d[1].departure_seconds - d[0].departure_seconds) / 60) : null,
      )
      .filter((g): g is number => g !== null && g > 0 && g < 60);
    return gaps.length
      ? Math.min(...gaps)
      : browseStation
        ? skylineFallbackHeadwayMinutes(browseStation.stopName)
        : null;
  }, [browseDirections, browseStation]);

  const { data: feederBuses = [] } = useQuery({
    queryKey: [
      "feeder-bus",
      browseStation?.stopId,
      browseUserPoint?.lat.toFixed(3),
      browseUserPoint?.lon.toFixed(3),
      Math.floor(scheduleAfterSeconds / 300),
    ],
    enabled: hydrated && Boolean(browseStation && browseUserPoint) && (browseWalkMinutes ?? 0) > 18,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("feeder_bus_to_station", {
        p_lat: browseUserPoint!.lat,
        p_lon: browseUserPoint!.lon,
        p_station: browseStation!.stopId,
        p_after_seconds: scheduleAfterSeconds,
      });
      if (error) throw error;
      return data ?? [];
    },
  });
  const { data: parkingRows = [] } = useQuery({
    queryKey: ["station-parking"],
    staleTime: 60 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("station_parking").select("*");
      if (error) throw error;
      return data ?? [];
    },
  });
  const stationParking = useMemo(() => {
    const name = (browseStation?.stopName ?? "").toLowerCase();
    return parkingRows.find((row) => name.includes(row.name_match)) ?? null;
  }, [parkingRows, browseStation?.stopName]);

  const browseHome = useMemo(() => {
    const p = findByKind(savedPlaces, "home");
    return p && p.lat != null && p.lon != null ? { lat: p.lat, lon: p.lon, label: p.label } : null;
  }, [savedPlaces]);
  const browseWork = useMemo(() => {
    const p = findByKind(savedPlaces, "work");
    return p && p.lat != null && p.lon != null ? { lat: p.lat, lon: p.lon, label: p.label } : null;
  }, [savedPlaces]);

  const { data: nearbyStops = [], isLoading: nearbyStopsLoading } = useQuery({
    queryKey: [
      "nearby-transit-stops",
      browseUserPoint?.lat.toFixed(5),
      browseUserPoint?.lon.toFixed(5),
      Math.floor(scheduleAfterSeconds / 60),
    ],
    enabled: hydrated && Boolean(browseUserPoint),
    staleTime: 120_000,
    refetchInterval: 60_000,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const point = browseUserPoint as Coords;
      const { data, error } = await supabase.rpc("nearby_transit_stops", {
        p_lat: point.lat,
        p_lon: point.lon,
        p_after_seconds: scheduleAfterSeconds,
        p_rail_limit: 2,
        p_bus_limit: 5,
      });
      if (error) throw error;
      return (data ?? [])
        .map((row): NearbyStop => ({
          stopId: row.stop_id,
          stopName: row.stop_name ?? "",
          lat: Number(row.stop_lat),
          lon: Number(row.stop_lon),
          routeType: row.route_type,
          distanceM: Number(row.distance_m),
          arrivals: Array.isArray(row.arrivals) ? (row.arrivals as NearbyArrival[]) : [],
        }))
        .sort((x, y) => x.distanceM - y.distanceM);
    },
  });
  useEffect(() => {
    if (!nearbyStops.length) return;
    if (!selectedNearbyStopId || !nearbyStops.some((s) => s.stopId === selectedNearbyStopId)) {
      setSelectedNearbyStopId(nearbyStops[0]?.stopId ?? null);
    }
  }, [nearbyStops, selectedNearbyStopId]);
  const selectedNearbyStop =
    nearbyStops.find((stop) => stop.stopId === selectedNearbyStopId) ?? nearbyStops[0] ?? null;

  // H-1 both ways, the same two checks Browse makes.
  const rawFetchDriveTime = useServerFn(driveTime);
  const fetchDriveTime = async (
    input: Parameters<typeof rawFetchDriveTime>[0],
  ): Promise<DriveTime> => {
    const result = await rawFetchDriveTime(input);
    if (!result) throw new Error("Drive routing temporarily unavailable");
    return result;
  };
  const eastbound = useQuery({
    queryKey: ["browse-h1", "eastbound"],
    enabled: hydrated,
    staleTime: 2 * 60_000,
    refetchInterval: 2 * 60_000,
    retry: 1,
    queryFn: () =>
      fetchDriveTime({
        data: {
          fromLat: KAPOLEI_POINT.lat,
          fromLon: KAPOLEI_POINT.lon,
          toLat: DOWNTOWN_POINT.lat,
          toLon: DOWNTOWN_POINT.lon,
          forceRefresh: false,
        },
      }),
  });
  const westbound = useQuery({
    queryKey: ["browse-h1", "westbound"],
    enabled: hydrated,
    staleTime: 2 * 60_000,
    refetchInterval: 2 * 60_000,
    retry: 1,
    queryFn: () =>
      fetchDriveTime({
        data: {
          fromLat: DOWNTOWN_POINT.lat,
          fromLon: DOWNTOWN_POINT.lon,
          toLat: KAPOLEI_POINT.lat,
          toLon: KAPOLEI_POINT.lon,
          forceRefresh: false,
        },
      }),
  });

  const fetchWeather = useServerFn(outdoorConditions);
  const { data: browseWeather, isError: browseWeatherFailed } = useQuery({
    queryKey: ["browse-weather", browseStation?.lat?.toFixed(2), browseStation?.lon?.toFixed(2)],
    enabled: hydrated && Boolean(browseStation),
    staleTime: 20 * 60_000,
    refetchInterval: 20 * 60_000,
    retry: false,
    queryFn: () =>
      fetchWeather({
        data: {
          points: [
            { id: "browse", lat: browseStation!.lat, lon: browseStation!.lon, offsetMinutes: 0 },
          ],
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
    if (hot && humid)
      return { text: `Hot and humid · feels like ${feels}°F`, tone: "heat", source: "NWS" };
    if (hot) return { text: `Hot out · feels like ${feels}°F`, tone: "heat", source: "NWS" };
    return airLine(browseWeather?.air?.category ?? 0);
  }, [browseWeather]);
  const browseWeatherSummary = useMemo(() => {
    const reading = browseWeather?.moments[0];
    const parts: string[] = [];
    if (reading?.heatIndexF !== null && reading?.heatIndexF !== undefined)
      parts.push(`${reading.heatIndexF}°`);
    if (reading?.shortForecast) parts.push(reading.shortForecast);
    const airCategory = browseWeather?.air?.category;
    if (airCategory === 1) parts.push("Good AQI");
    else if (airCategory === 2) parts.push("Moderate AQI");
    else if (airCategory === 3) parts.push("Poor AQI");
    else if (typeof airCategory === "number" && airCategory >= 4) parts.push("Unhealthy AQI");
    return weatherSummaryText(parts, {
      hasData: Boolean(browseWeather),
      failed: browseWeatherFailed,
      canLoad: Boolean(browseStation) || !browseLocationDenied,
    });
  }, [browseWeather, browseWeatherFailed, browseStation, browseLocationDenied]);

  const trafficLoading = eastbound.isLoading || westbound.isLoading;
  const trafficUnavailable =
    eastbound.isError ||
    westbound.isError ||
    (!trafficLoading && (!eastbound.data || !westbound.data));

  return {
    hydrated,
    online,
    now,
    nowSeconds,
    savedPlaces,
    browseHome,
    browseWork,
    browseStation,
    browseStations,
    browseUserPoint,
    browseFar,
    browseWalkMinutes,
    browseLocationDenied,
    browseDirections,
    browseDeparturesLoading,
    browseDeparturesFailed,
    trainsEveryMinutes,
    feederBuses,
    stationParking,
    nearbyStops,
    nearbyStopsLoading,
    selectedNearbyStop,
    setSelectedNearbyStopId,
    rememberBrowseStation,
    eastboundTraffic: eastbound.data,
    westboundTraffic: westbound.data,
    trafficLoading,
    trafficUnavailable,
    browseWeather,
    browseWeatherFailed,
    browseWeatherLine,
    browseWeatherSummary,
  };
}
