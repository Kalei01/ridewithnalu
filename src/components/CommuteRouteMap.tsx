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

type CommuteRouteMapProps = {
  points: JourneyPoint[];
  livePoint: { lat: number; lon: number } | null;
  /** Real road geometry to draw instead of straight hops (used for Drive mode). */
  path?: Array<{ lat: number; lon: number }>;
};

type Basemap = "standard" | "satellite";

const BASEMAPS = {
  standard: {
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
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

export default function CommuteRouteMap({ points, livePoint, path }: CommuteRouteMapProps) {
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
    tileLayerRef.current = L.tileLayer(next.url, { maxZoom: 19, attribution: next.attribution }).addTo(map);
    tileLayerRef.current.bringToBack();
  }, [basemap]);

  // A stable signature of the itinerary geometry: route layers and the viewport
  // only rebuild when the actual stops change, not on every data refetch tick.
  const routeSignature = useMemo(
    () => points.map((point) => `${point.kind}:${point.lat.toFixed(5)},${point.lon.toFixed(5)}`).join("|"),
    [points],
  );
  const pointsRef = useRef(points);
  pointsRef.current = points;

  useEffect(() => {
    const map = mapRef.current;
    const routeLayer = routeLayerRef.current;
    const current = pointsRef.current;
    if (!map || !routeLayer || current.length < 2) return;
    routeLayer.clearLayers();

    const latLngs = current.map((point) => [point.lat, point.lon] as L.LatLngTuple);
    L.polyline(latLngs, {
      color: "var(--color-primary)",
      weight: 5,
      opacity: 0.9,
      lineCap: "round",
      lineJoin: "round",
      className: "nalu-journey-line",
    }).addTo(routeLayer);

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

    map.invalidateSize({ animate: false });
    map.flyToBounds(L.latLngBounds(latLngs), { padding: [34, 34], maxZoom: 15, duration: 0.7 });
  }, [routeSignature]);

  // The live dot moves in place; recreating it (or touching the viewport) on every
  // watchPosition tick is what made the map twitch.
  const liveMarkerRef = useRef<L.CircleMarker | null>(null);
  useEffect(() => {
    const liveLayer = liveLayerRef.current;
    if (!liveLayer) return;
    if (!livePoint) {
      liveLayer.clearLayers();
      liveMarkerRef.current = null;
      return;
    }
    if (liveMarkerRef.current) {
      liveMarkerRef.current.setLatLng([livePoint.lat, livePoint.lon]);
      return;
    }
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
  }, [livePoint]);


  const recenter = () => {
    const map = mapRef.current;
    if (!map || !livePoint) return;
    map.flyTo([livePoint.lat, livePoint.lon], 15, { duration: 0.7 });
  };

  const fitRoute = () => {
    const map = mapRef.current;
    if (!map || points.length < 2) return;
    map.flyToBounds(L.latLngBounds(points.map((point) => [point.lat, point.lon] as L.LatLngTuple)), {
      padding: [42, 42],
      maxZoom: 15,
      duration: 0.7,
    });
  };

  return (
    <div className="relative z-0 isolate h-full w-full">
      <div ref={nodeRef} className="h-full w-full" aria-label="Interactive map of your door-to-door commute" />
      <div className="absolute right-3 top-3 z-[500] flex flex-col items-end gap-2" aria-label="Map controls">
        <div className="flex overflow-hidden rounded-md border border-border bg-background/95 shadow-lg backdrop-blur-md">
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
          <Button type="button" variant="secondary" size="icon" onClick={fitRoute} aria-label="Fit full route" title="Fit full route" className="size-11 border border-border bg-background/95 shadow-lg backdrop-blur-md">
            <Maximize className="size-5" />
          </Button>
          <Button type="button" variant="secondary" size="icon" onClick={recenter} disabled={!livePoint} aria-label={livePoint ? "Recenter on my location" : "Current location unavailable"} title={livePoint ? "Recenter on my location" : "Current location unavailable"} className="size-11 border border-border bg-background/95 shadow-lg backdrop-blur-md">
            <LocateFixed className="size-5" />
          </Button>
        </div>
      </div>
    </div>
  );
}