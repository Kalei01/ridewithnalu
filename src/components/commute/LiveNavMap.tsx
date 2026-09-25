import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowUpLeft,
  ArrowUpRight,
  Flag,
  LocateFixed,
  RotateCcw,
  RefreshCcw,
  Volume2,
  VolumeX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TurnGlyph } from "@/lib/navigation-voice";

type Pt = { lat: number; lon: number };

export type LiveNavMapProps = {
  lines: Array<{ id: string; mode: "walk" | "drive" | "bus" | "rail"; points: Pt[] }>;
  destination: Pt | null;
  livePoint: Pt | null;
  bearing: number | null;
  maneuver: { glyph: TurnGlyph; distanceText: string; road: string } | null;
  eta: { arrive: string; range: string | null; minutes: number; distance: string | null } | null;
  muted: boolean;
  onToggleMute: () => void;
};

const GLYPHS: Record<TurnGlyph, typeof ArrowUp> = {
  left: ArrowLeft,
  right: ArrowRight,
  "slight-left": ArrowUpLeft,
  "slight-right": ArrowUpRight,
  straight: ArrowUp,
  uturn: RotateCcw,
  roundabout: RefreshCcw,
  arrive: Flag,
};

function cssVar(name: string, fallback: string) {
  if (typeof window === "undefined") return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

export default function LiveNavMap(props: LiveNavMapProps) {
  const { lines, destination, livePoint, bearing, maneuver, eta, muted, onToggleMute } = props;
  const nodeRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);
  const followRef = useRef(true);
  const [following, setFollowing] = useState(true);
  const [ready, setReady] = useState(false);
  const token = import.meta.env.VITE_LOVABLE_CONNECTOR_MAPBOX_PUBLIC_TOKEN as string | undefined;

  useEffect(() => {
    if (!nodeRef.current || mapRef.current || !token) return;
    mapboxgl.accessToken = token;
    const start = livePoint ?? lines[0]?.points[0] ?? destination ?? { lat: 21.31, lon: -157.86 };
    const map = new mapboxgl.Map({
      container: nodeRef.current,
      style: "mapbox://styles/mapbox/navigation-night-v1",
      center: [start.lon, start.lat],
      zoom: 16,
      pitch: 55,
      bearing: bearing ?? 0,
      attributionControl: true,
    });
    const stopFollow = (event: { originalEvent?: unknown }) => {
      if (!event.originalEvent) return; // programmatic camera moves
      followRef.current = false;
      setFollowing(false);
    };
    map.on("dragstart", stopFollow);
    map.on("rotatestart", stopFollow);
    map.on("pitchstart", stopFollow);
    map.on("load", () => setReady(true));
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Route lines.
  const lineKey = lines.map((l) => `${l.id}:${l.points.length}:${l.points[0]?.lat}`).join("|");
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const colors = {
      drive: cssVar("--color-primary", "#4fb3ff"),
      rail: cssVar("--color-primary", "#4fb3ff"),
      bus: cssVar("--color-location", "#38e0c0"),
      walk: cssVar("--color-muted-foreground", "#9aa4b2"),
    };
    const data: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      features: lines
        .filter((l) => l.points.length > 1)
        .map((l) => ({
          type: "Feature",
          properties: { color: colors[l.mode], walk: l.mode === "walk" },
          geometry: { type: "LineString", coordinates: l.points.map((p) => [p.lon, p.lat]) },
        })),
    };
    const source = map.getSource("nalu-route") as mapboxgl.GeoJSONSource | undefined;
    if (source) {
      source.setData(data);
      return;
    }
    map.addSource("nalu-route", { type: "geojson", data });
    map.addLayer({
      id: "nalu-route-casing",
      type: "line",
      source: "nalu-route",
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": "#0b1220", "line-width": 12, "line-opacity": 0.85 },
    });
    map.addLayer({
      id: "nalu-route-line",
      type: "line",
      source: "nalu-route",
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": ["get", "color"], "line-width": 7 },
    });
    if (destination) {
      const el = document.createElement("span");
      el.className = "nalu-journey-marker nalu-journey-marker-end";
      el.innerHTML = '<span class="nalu-journey-marker-label">END</span>';
      new mapboxgl.Marker({ element: el }).setLngLat([destination.lon, destination.lat]).addTo(map);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lineKey, ready]);

  // Live puck and heading-up camera.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !livePoint) return;
    if (!markerRef.current) {
      const el = document.createElement("div");
      el.className = "nalu-nav-puck";
      el.innerHTML = '<span class="nalu-nav-puck-arrow"></span>';
      markerRef.current = new mapboxgl.Marker({ element: el, rotationAlignment: "map", pitchAlignment: "map" })
        .setLngLat([livePoint.lon, livePoint.lat])
        .addTo(map);
    } else {
      markerRef.current.setLngLat([livePoint.lon, livePoint.lat]);
    }
    if (bearing !== null) markerRef.current.setRotation(bearing);
    if (!followRef.current) return;
    map.easeTo({
      center: [livePoint.lon, livePoint.lat],
      bearing: bearing ?? map.getBearing(),
      pitch: 55,
      zoom: Math.max(map.getZoom(), 15.5),
      duration: 900,
      easing: (t) => t * (2 - t),
      essential: true,
    });
  }, [livePoint, bearing]);

  const recenter = () => {
    followRef.current = true;
    setFollowing(true);
    const map = mapRef.current;
    if (map && livePoint)
      map.easeTo({ center: [livePoint.lon, livePoint.lat], bearing: bearing ?? 0, pitch: 55, zoom: 16, duration: 700 });
  };

  if (!token) return null;
  const Glyph = maneuver ? GLYPHS[maneuver.glyph] : null;

  return (
    <div className="relative isolate h-full w-full">
      <div ref={nodeRef} className="h-full w-full" aria-label="Heading-up navigation map" />

      <div className="pointer-events-none absolute inset-x-2 top-2 z-10 flex items-start justify-between gap-2">
        {maneuver && Glyph ? (
          <div
            className="nav-hud pointer-events-auto flex min-w-0 max-w-[62%] items-center gap-3 rounded-xl px-3 py-2.5"
            aria-live="polite"
          >
            <Glyph className="size-9 shrink-0 text-primary" strokeWidth={2.6} aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-2xl font-black leading-none tabular-nums text-foreground">
                {maneuver.distanceText}
              </p>
              <p className="mt-1 truncate text-sm font-semibold text-foreground/85">{maneuver.road}</p>
            </div>
          </div>
        ) : (
          <span />
        )}
        <div className="flex shrink-0 flex-col items-end gap-2">
          {eta && (
            <div className="nav-hud pointer-events-auto rounded-xl px-3 py-2 text-right" aria-live="polite">
              <p className="text-lg font-black leading-none tabular-nums text-foreground">{eta.arrive}</p>
              <p className="mt-1 text-[11px] font-bold tabular-nums text-muted-foreground">
                {eta.minutes} min{eta.distance ? ` · ${eta.distance}` : ""}
              </p>
              {eta.range && (
                <p className="text-[10px] font-semibold tabular-nums text-muted-foreground">{eta.range}</p>
              )}
            </div>
          )}
          <Button
            type="button"
            size="icon"
            variant="secondary"
            onClick={onToggleMute}
            aria-pressed={muted}
            aria-label={muted ? "Unmute voice guidance" : "Mute voice guidance"}
            className="nav-hud pointer-events-auto size-11 rounded-full"
          >
            {muted ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}
          </Button>
        </div>
      </div>

      {!following && livePoint && (
        <Button
          type="button"
          onClick={recenter}
          className="absolute bottom-4 left-1/2 z-10 h-11 -translate-x-1/2 gap-2 rounded-full px-5 font-bold shadow-xl"
        >
          <LocateFixed className="size-4" /> Recenter
        </Button>
      )}
    </div>
  );
}
