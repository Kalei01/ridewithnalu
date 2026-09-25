import { useEffect, useMemo, useRef, useState } from "react";
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
import {
  matchRoutePoint,
  routeDeviation,
  trimRoutePath,
  type TurnGlyph,
} from "@/lib/navigation-voice";

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
  rerouting?: boolean;
  onRouteStateChange?: (state: {
    offRoute: boolean;
    crossTrackM: number;
    headingDivergence: number | null;
  }) => void;
  /** Lift Recenter above a bottom overlay (px). */
  recenterBottom?: number;
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

/** Push the puck into the lower third so the road ahead fills the screen. */
function navPadding(map: mapboxgl.Map) {
  const h = map.getContainer().clientHeight;
  return { top: Math.round(h * 0.5), bottom: Math.round(h * 0.06), left: 0, right: 0 };
}

export default function LiveNavMap(props: LiveNavMapProps) {
  const {
    lines,
    destination,
    livePoint,
    bearing,
    maneuver,
    eta,
    muted,
    onToggleMute,
    rerouting = false,
    onRouteStateChange,
  } = props;
  const nodeRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);
  const routeIndexRef = useRef<number | null>(null);
  const routeIdentityRef = useRef("");
  const divergentFixesRef = useRef(0);
  const evaluatedFixRef = useRef("");
  const followRef = useRef(true);
  const [following, setFollowing] = useState(true);
  const [ready, setReady] = useState(false);
  const path = useMemo(() => lines.flatMap((line) => line.points), [lines]);
  const routeIdentity = lines
    .map(
      (line) =>
        `${line.id}:${line.points.length}:${line.points[0]?.lat}:${line.points.at(-1)?.lat}`,
    )
    .join("|");
  if (routeIdentityRef.current !== routeIdentity) {
    routeIdentityRef.current = routeIdentity;
    routeIndexRef.current = null;
    divergentFixesRef.current = 0;
    evaluatedFixRef.current = "";
  }
  const match = useMemo(
    () => (livePoint ? matchRoutePoint(livePoint, path, routeIndexRef.current, bearing) : null),
    [livePoint, path, bearing],
  );
  if (match && match.distanceM <= 80) routeIndexRef.current = match.segmentIndex;
  const displayedPoint = match && match.distanceM <= 80 ? match.point : livePoint;
  // GPS heading when moving; otherwise the route's own forward direction, so
  // the road ahead points straight up even at 0 mph.
  const heading = bearing ?? match?.bearing ?? null;
  const renderedLines = useMemo(() => {
    if (!match) return lines;
    let offset = 0;
    const forward: typeof lines = [];
    for (const line of lines) {
      const lastSegment = offset + Math.max(0, line.points.length - 2);
      if (match.segmentIndex > lastSegment) {
        offset += line.points.length;
        continue;
      }
      if (match.segmentIndex >= offset) {
        const localMatch = { ...match, segmentIndex: match.segmentIndex - offset };
        forward.push({ ...line, points: trimRoutePath(line.points, localMatch) });
      } else {
        forward.push(line);
      }
      offset += line.points.length;
    }
    return forward.length ? forward : lines;
  }, [lines, match]);
  const token = import.meta.env["VITE_LOVABLE_CONNECTOR_MAPBOX_PUBLIC_TOKEN"] as string | undefined;

  useEffect(() => {
    if (!livePoint || !match) return;
    const fixKey = `${livePoint.lat}:${livePoint.lon}:${bearing ?? "none"}`;
    if (evaluatedFixRef.current === fixKey) return;
    evaluatedFixRef.current = fixKey;
    const deviation = routeDeviation(match, bearing, divergentFixesRef.current);
    divergentFixesRef.current = deviation.divergentFixes;
    onRouteStateChange?.({
      offRoute: deviation.offRoute,
      crossTrackM: deviation.crossTrackM,
      headingDivergence: deviation.headingDivergence,
    });
  }, [livePoint, match, bearing, onRouteStateChange]);

  useEffect(() => {
    if (!nodeRef.current || mapRef.current || !token) return;
    mapboxgl.accessToken = token;
    const start = livePoint ?? lines[0]?.points[0] ?? destination ?? { lat: 21.31, lon: -157.86 };
    const map = new mapboxgl.Map({
      container: nodeRef.current,
      style: "mapbox://styles/mapbox/navigation-night-v1",
      center: [start.lon, start.lat],
      zoom: 17,
      pitch: 40,
      bearing: heading ?? 0,
      attributionControl: true,
    });
    map.setPadding(navPadding(map));
    const stopFollow = (event: object) => {
      if (!("originalEvent" in event)) return;
      followRef.current = false;
      setFollowing(false);
    };
    map.on("dragstart", stopFollow);
    map.on("rotatestart", stopFollow);
    map.on("pitchstart", stopFollow);
    map.on("load", () => {
      for (const layer of map.getStyle().layers ?? []) {
        if (/traffic|congestion|incidents/i.test(layer.id))
          map.setLayoutProperty(layer.id, "visibility", "none");
      }
      setReady(true);
    });
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Route lines.
  const lineKey = renderedLines
    .map((l) => `${l.id}:${l.points.length}:${l.points[0]?.lat}:${l.points[0]?.lon}`)
    .join("|");
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    // Mapbox only parses plain colours (not oklch theme tokens), so use hex.
    const colors = { drive: "#35d7ff", rail: "#35d7ff", bus: "#38e0c0", walk: "#f2f6fb" };
    const data: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      features: renderedLines
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
      paint: { "line-color": "#07111f", "line-width": 18, "line-opacity": 0.96 },
    });
    map.addLayer({
      id: "nalu-route-line",
      type: "line",
      source: "nalu-route",
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": ["get", "color"],
        "line-width": 11,
        "line-dasharray": ["case", ["get", "walk"], ["literal", [1, 1.5]], ["literal", [1, 0]]],
      },
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
    if (!map || !displayedPoint) return;
    if (!markerRef.current) {
      const el = document.createElement("div");
      el.className = "nalu-nav-puck";
      el.innerHTML = '<span class="nalu-nav-puck-arrow"></span>';
      markerRef.current = new mapboxgl.Marker({
        element: el,
        rotationAlignment: "map",
        pitchAlignment: "map",
      })
        .setLngLat([displayedPoint.lon, displayedPoint.lat])
        .addTo(map);
    } else {
      markerRef.current.setLngLat([displayedPoint.lon, displayedPoint.lat]);
    }
    if (heading !== null) markerRef.current.setRotation(heading);
    if (!followRef.current) return;
    map.stop();
    map.easeTo({
      center: [displayedPoint.lon, displayedPoint.lat],
      bearing: heading ?? map.getBearing(),
      padding: navPadding(map),
      pitch: 40,
      zoom: Math.max(map.getZoom(), 16.9),
      duration: 1000,
      easing: (t) => t,
      essential: true,
    });
  }, [displayedPoint, heading]);

  const recenter = () => {
    followRef.current = true;
    setFollowing(true);
    const map = mapRef.current;
    if (map && displayedPoint)
      map.stop();
    if (map && displayedPoint)
      map.easeTo({
        center: [displayedPoint.lon, displayedPoint.lat],
        bearing: heading ?? 0,
        padding: navPadding(map),
        pitch: 40,
        zoom: 17,
        duration: 650,
      });
  };

  if (!token) return null;
  const Glyph = maneuver ? GLYPHS[maneuver.glyph] : null;

  return (
    <div className="relative isolate h-full w-full">
      <div ref={nodeRef} className="h-full w-full" aria-label="Heading-up navigation map" />

      <div className="pointer-events-none absolute inset-x-2 top-2 z-10 flex items-start justify-between gap-2">
        {rerouting ? (
          <div
            className="nav-hud pointer-events-auto min-w-0 max-w-[62%] rounded-xl px-4 py-3"
            role="status"
            aria-live="assertive"
          >
            <p className="text-base font-black text-foreground">Rerouting…</p>
            <p className="mt-1 text-xs font-semibold text-muted-foreground">
              Proceeding to route…
            </p>
          </div>
        ) : maneuver && Glyph ? (
          <div
            className="nav-hud pointer-events-auto flex min-w-0 max-w-[62%] items-center gap-3 rounded-xl px-3 py-2.5"
            aria-live="polite"
          >
            <Glyph className="size-9 shrink-0 text-primary" strokeWidth={2.6} aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-2xl font-black leading-none tabular-nums text-foreground">
                {maneuver.distanceText}
              </p>
              <p className="mt-1 truncate text-sm font-semibold text-foreground/85">
                {maneuver.road}
              </p>
            </div>
          </div>
        ) : (
          <span />
        )}
        <div className="flex shrink-0 flex-col items-end gap-2">
          {eta && (
            <div
              className="nav-hud pointer-events-auto rounded-xl px-3 py-2 text-right"
              aria-live="polite"
            >
              <p className="text-lg font-black leading-none tabular-nums text-foreground">
                {eta.arrive}
              </p>
              <p className="mt-1 text-[11px] font-bold tabular-nums text-muted-foreground">
                {eta.minutes} min{eta.distance ? ` · ${eta.distance}` : ""}
              </p>
              {eta.range && (
                <p className="text-[10px] font-semibold tabular-nums text-muted-foreground">
                  {eta.range}
                </p>
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
          style={props.recenterBottom ? { bottom: props.recenterBottom } : undefined}
          className="absolute bottom-4 left-1/2 z-10 h-11 -translate-x-1/2 gap-2 rounded-full px-5 font-bold shadow-xl"
        >
          <LocateFixed className="size-4" /> Recenter
        </Button>
      )}
    </div>
  );
}
