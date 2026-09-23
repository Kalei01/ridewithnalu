import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import { LocateFixed, Map, Maximize, Satellite } from "lucide-react";
import { Button } from "@/components/ui/button";

type JourneyPoint = {
  id: string;
  name: string;
  lat: number;
  lon: number;
  kind: "start" | "rail" | "bus" | "end";
};

type TrafficSection = {
  severity: "moderate" | "heavy";
  delayMinutes: number;
  points: Array<{ lat: number; lon: number }>;
};

type JourneySegment = {
  id: string;
  mode: "walk" | "drive" | "bus" | "rail";
  points: Array<{ lat: number; lon: number }>;
};

type CommuteRouteMapProps = {
  points: JourneyPoint[];
  livePoint: { lat: number; lon: number } | null;
  /** Compass heading in degrees, when the device reports one, to point the live dot. */
  liveHeading?: number | null;
  /** Keep an active trip centered on the moving live location. */
  followLive?: boolean;
  /** Real road geometry to draw instead of straight hops (used for Drive mode). */
  path?: Array<{ lat: number; lon: number }>;
  /** Scheduled stop-by-stop geometry for every leg of a transit itinerary. */
  segments?: JourneySegment[];
  /** Congested stretches drawn in amber/red over the route (Drive mode). */
  trafficSections?: TrafficSection[];
};


type Basemap = "standard" | "satellite";

const BASEMAPS = {
  standard: {
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png?key=cb1_3t31_1_b6f69033d24b3d666819845e",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
  },
  satellite: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community",
  },
} as const;

function journeyIcon(point: JourneyPoint) {
  const glyph = point.kind === "start" ? "START" : point.kind === "end" ? "END" : point.kind === "rail" ? "▰" : "●";
  const label = point.kind === "start" ? "Start" : point.kind === "end" ? "End" : point.kind === "rail" ? "Rail station" : "Bus stop";
  const endpoint = point.kind === "start" || point.kind === "end";
  return L.divIcon({
    className: "nalu-marker-shell",
    html: `<span class="nalu-journey-marker nalu-journey-marker-${point.kind}" aria-label="${label}"><span class="nalu-journey-marker-label">${glyph}</span></span>`,
    iconSize: endpoint ? [58, 34] : [30, 30],
    iconAnchor: endpoint ? [29, 17] : [15, 15],
  });
}

export default function CommuteRouteMap({ points, livePoint, liveHeading, followLive = false, path, segments, trafficSections }: CommuteRouteMapProps) {
  const [basemap, setBasemap] = useState<Basemap>("standard");
  const nodeRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const routeLayerRef = useRef<L.LayerGroup | null>(null);
  const liveLayerRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    const node = nodeRef.current;
    const first = points[0];
    if (!node || !first || mapRef.current) return;

    const map = L.map(node, {
      zoomControl: false,
      attributionControl: true,
      scrollWheelZoom: false,
      dragging: true,
    }).setView([first.lat, first.lon], 12);

    tileLayerRef.current = L.tileLayer(BASEMAPS.standard.url, {
      maxZoom: 19,
      subdomains: "abcd",
      attribution: BASEMAPS.standard.attribution,
    }).addTo(map);
    L.control.zoom({ position: "bottomright" }).addTo(map);
    routeLayerRef.current = L.layerGroup().addTo(map);
    liveLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      tileLayerRef.current = null;
      routeLayerRef.current = null;
      liveLayerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const previousLayer = tileLayerRef.current;
    if (previousLayer) map.removeLayer(previousLayer);
    const next = BASEMAPS[basemap];
    tileLayerRef.current = L.tileLayer(next.url, { maxZoom: 19, subdomains: "abcd", attribution: next.attribution }).addTo(map);
    tileLayerRef.current.bringToBack();
  }, [basemap]);

  // A stable signature of the drawn geometry: route layers and the viewport only
  // rebuild when the actual stops or road corridor change, not on every refetch tick.
  const routeSignature = useMemo(
    () =>
      [
        points.map((point) => `${point.kind}:${point.lat.toFixed(5)},${point.lon.toFixed(5)}`).join("|"),
        `path:${(path ?? []).map((point) => `${point.lat.toFixed(5)},${point.lon.toFixed(5)}`).join(";")}`,
        `segments:${(segments ?? []).map((segment) => `${segment.id}:${segment.points.map((point) => `${point.lat.toFixed(5)},${point.lon.toFixed(5)}`).join(";")}`).join("|")}`,
        `traffic:${(trafficSections ?? []).map((section) => `${section.severity}:${section.delayMinutes}:${section.points.map((point) => `${point.lat.toFixed(5)},${point.lon.toFixed(5)}`).join(";")}`).join("|")}`,
      ].join("#"),
    [points, path, segments, trafficSections],
  );
  const pointsRef = useRef(points);
  pointsRef.current = points;
  const pathRef = useRef(path);
  pathRef.current = path;
  const segmentsRef = useRef(segments);
  segmentsRef.current = segments;
  const trafficRef = useRef(trafficSections);
  trafficRef.current = trafficSections;


  useEffect(() => {
    const map = mapRef.current;
    const routeLayer = routeLayerRef.current;
    const current = pointsRef.current;
    if (!map || !routeLayer || current.length < 2) return;
    routeLayer.clearLayers();

    const roadPath = pathRef.current;
    // Drive mode draws TomTom's road geometry. Transit draws each scheduled
    // stop sequence independently, so rail, bus and walking legs stay visible.
    const lineLatLngs: L.LatLngTuple[] =
      roadPath && roadPath.length > 1
        ? roadPath.map((point) => [point.lat, point.lon] as L.LatLngTuple)
        : current.map((point) => [point.lat, point.lon] as L.LatLngTuple);
    const transitSegments = segmentsRef.current?.filter((segment) => segment.points.length > 1) ?? [];
    const drawableSegments = roadPath && roadPath.length > 1
      ? [{ id: "drive", mode: "drive" as const, points: roadPath }]
      : transitSegments.length > 0
        ? transitSegments
        : [{ id: "fallback", mode: "rail" as const, points: current }];

    for (const segment of drawableSegments) {
      const latLngs = segment.points.map((point) => [point.lat, point.lon] as L.LatLngTuple);
      const walking = segment.mode === "walk";
      const color = segment.mode === "bus" ? "var(--color-location)" : segment.mode === "walk" ? "var(--color-muted-foreground)" : "var(--color-primary)";
      L.polyline(latLngs, {
        color: "var(--color-background)",
        weight: walking ? 7 : 11,
        opacity: 0.94,
        lineCap: "round",
        lineJoin: "round",
        className: "nalu-journey-line-casing",
      }).addTo(routeLayer);
      L.polyline(latLngs, {
        color,
        weight: walking ? 3 : 5,
        opacity: 1,
        dashArray: walking ? "5 7" : undefined,
        lineCap: "round",
        lineJoin: "round",
        className: `nalu-journey-line nalu-journey-line-${segment.mode}`,
      }).addTo(routeLayer);
    }

    // Congestion drawn over the corridor: amber for moderate, red for heavy backups.
    for (const section of trafficRef.current ?? []) {
      if (section.points.length < 2) continue;
      const latLngs = section.points.map((point) => [point.lat, point.lon] as L.LatLngTuple);
      const heavy = section.severity === "heavy";
      L.polyline(latLngs, {
        color: heavy ? "var(--color-traffic-heavy)" : "var(--color-traffic-moderate)",
        weight: 6,
        opacity: 0.95,
        lineCap: "round",
        lineJoin: "round",
        className: "nalu-traffic-line",
      })
        .bindTooltip(
          `${heavy ? "Heavy traffic" : "Slow traffic"}${section.delayMinutes > 0 ? ` · +${section.delayMinutes} min` : ""}`,
          { direction: "top", sticky: true },
        )
        .addTo(routeLayer);
    }


    current.forEach((point) => {
      L.marker([point.lat, point.lon], {
        icon: journeyIcon(point),
        title: `${point.kind === "start" ? "Start: " : point.kind === "end" ? "End: " : ""}${point.name}`,
        keyboard: true,
        zIndexOffset: point.kind === "start" || point.kind === "end" ? 1500 : 0,
      })
        .bindTooltip(
          `<strong>${point.kind === "start" ? "Start" : point.kind === "end" ? "End" : point.kind === "rail" ? "Rail" : "Bus"}</strong><br>${point.name}`,
          { direction: "top", offset: [0, -18] },
        )
        .addTo(routeLayer);
    });

    const boundsLatLngs = [
      ...drawableSegments.flatMap((segment) => segment.points.map((point) => [point.lat, point.lon] as L.LatLngTuple)),
      ...current.map((point) => [point.lat, point.lon] as L.LatLngTuple),
    ];
    map.invalidateSize({ animate: false });
    // Snap, never animate: an animated fit on every data refresh is what made the
    // map appear to twitch while a trip was on screen.
    map.fitBounds(L.latLngBounds(boundsLatLngs), { padding: [34, 34], maxZoom: 15, animate: false });
  }, [routeSignature]);


  // The live dot moves in place; recreating it (or touching the viewport) on every
  // watchPosition tick is what made the map twitch.
  const liveMarkerRef = useRef<L.CircleMarker | null>(null);
  const headingMarkerRef = useRef<L.Marker | null>(null);
  useEffect(() => {
    const liveLayer = liveLayerRef.current;
    if (!liveLayer) return;
    if (!livePoint) {
      liveLayer.clearLayers();
      liveMarkerRef.current = null;
      headingMarkerRef.current = null;
      return;
    }
    if (liveMarkerRef.current) {
      liveMarkerRef.current.setLatLng([livePoint.lat, livePoint.lon]);
    } else {
      liveMarkerRef.current = L.circleMarker([livePoint.lat, livePoint.lon], {
        radius: 8,
        color: "var(--color-foreground)",
        weight: 3,
        fillColor: "var(--color-location)",
        fillOpacity: 1,
        className: "nalu-location-dot",
      })
        .bindTooltip("Your live location", { direction: "top", offset: [0, -10] })
        .addTo(liveLayer);
    }

    // A heading arrow above the dot, so a driver can see which way they face.
    if (typeof liveHeading !== "number" || Number.isNaN(liveHeading)) {
      if (headingMarkerRef.current) {
        liveLayer.removeLayer(headingMarkerRef.current);
        headingMarkerRef.current = null;
      }
      return;
    }
    const icon = L.divIcon({
      className: "nalu-marker-shell",
      html: `<span class="nalu-heading-arrow" style="transform: rotate(${Math.round(liveHeading)}deg)"></span>`,
      iconSize: [34, 34],
      iconAnchor: [17, 17],
    });
    if (headingMarkerRef.current) {
      headingMarkerRef.current.setLatLng([livePoint.lat, livePoint.lon]);
      headingMarkerRef.current.setIcon(icon);
      return;
    }
    headingMarkerRef.current = L.marker([livePoint.lat, livePoint.lon], {
      icon,
      interactive: false,
      zIndexOffset: 800,
    }).addTo(liveLayer);
  }, [livePoint, liveHeading]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !followLive || !livePoint) return;
    map.setView([livePoint.lat, livePoint.lon], Math.max(map.getZoom(), 15), { animate: false });
  }, [followLive, livePoint]);


  const recenter = () => {
    const map = mapRef.current;
    if (!map || !livePoint) return;
    map.flyTo([livePoint.lat, livePoint.lon], 15, { duration: 0.7 });
  };

  const fitRoute = () => {
    const map = mapRef.current;
    if (!map || points.length < 2) return;
    const corridor: L.LatLngTuple[] = [
      ...(path ?? []).map((point) => [point.lat, point.lon] as L.LatLngTuple),
      ...(segments ?? []).flatMap((segment) => segment.points.map((point) => [point.lat, point.lon] as L.LatLngTuple)),
      ...points.map((point) => [point.lat, point.lon] as L.LatLngTuple),
    ];
    map.flyToBounds(L.latLngBounds(corridor), {
      padding: [42, 42],
      maxZoom: 15,
      duration: 0.7,
    });
  };


  return (
    <div className="relative z-0 isolate h-full w-full">
      <div ref={nodeRef} className="h-full w-full" aria-label="Interactive map of your door-to-door commute" />
      <div className="absolute right-3 top-3 z-[500] flex flex-col items-end gap-2" aria-label="Map controls">
        <div className="flex overflow-hidden rounded-lg border border-foreground/15 bg-background/80 shadow-xl backdrop-blur-xl">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label="Show standard map"
            aria-pressed={basemap === "standard"}
            onClick={() => setBasemap("standard")}
            className="rounded-none px-2.5 text-foreground data-[pressed=true]:bg-primary data-[pressed=true]:text-primary-foreground"
            data-pressed={basemap === "standard"}
          >
            <Map /> Standard
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label="Show satellite map"
            aria-pressed={basemap === "satellite"}
            onClick={() => setBasemap("satellite")}
            className="rounded-none border-l border-border px-2.5 text-foreground data-[pressed=true]:bg-primary data-[pressed=true]:text-primary-foreground"
            data-pressed={basemap === "satellite"}
          >
            <Satellite /> Satellite
          </Button>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="secondary" size="icon" onClick={fitRoute} aria-label="Fit full route" title="Fit full route" className="size-11 rounded-lg border border-foreground/15 bg-background/80 shadow-xl backdrop-blur-xl">
            <Maximize className="size-5" />
          </Button>
          <Button type="button" variant="secondary" size="icon" onClick={recenter} disabled={!livePoint} aria-label={livePoint ? "Recenter on my location" : "Current location unavailable"} title={livePoint ? "Recenter on my location" : "Current location unavailable"} className="size-11 rounded-lg border border-foreground/15 bg-background/80 shadow-xl backdrop-blur-xl">
            <LocateFixed className="size-5" />
          </Button>
        </div>
      </div>
    </div>
  );
}