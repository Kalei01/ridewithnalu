import { useEffect, useRef } from "react";
import L from "leaflet";

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
};

function journeyIcon(point: JourneyPoint) {
  const glyph = point.kind === "start" ? "S" : point.kind === "end" ? "E" : point.kind === "rail" ? "▰" : "●";
  const label = point.kind === "start" ? "Start" : point.kind === "end" ? "End" : point.kind === "rail" ? "Rail station" : "Bus stop";
  return L.divIcon({
    className: "nalu-marker-shell",
    html: `<span class="nalu-journey-marker nalu-journey-marker-${point.kind}" aria-label="${label}">${glyph}</span>`,
    iconSize: point.kind === "start" || point.kind === "end" ? [38, 38] : [30, 30],
    iconAnchor: point.kind === "start" || point.kind === "end" ? [19, 19] : [15, 15],
  });
}

export default function CommuteRouteMap({ points, livePoint }: CommuteRouteMapProps) {
  const nodeRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
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

    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap &copy; CARTO",
    }).addTo(map);
    L.control.zoom({ position: "bottomright" }).addTo(map);
    routeLayerRef.current = L.layerGroup().addTo(map);
    liveLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      routeLayerRef.current = null;
      liveLayerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const routeLayer = routeLayerRef.current;
    if (!map || !routeLayer || points.length < 2) return;
    routeLayer.clearLayers();

    const latLngs = points.map((point) => [point.lat, point.lon] as L.LatLngTuple);
    L.polyline(latLngs, {
      color: "var(--color-primary)",
      weight: 5,
      opacity: 0.9,
      lineCap: "round",
      lineJoin: "round",
      className: "nalu-journey-line",
    }).addTo(routeLayer);

    points.forEach((point) => {
      L.marker([point.lat, point.lon], {
        icon: journeyIcon(point),
        title: `${point.kind === "start" ? "Start: " : point.kind === "end" ? "End: " : ""}${point.name}`,
        keyboard: true,
      })
        .bindTooltip(
          `<strong>${point.kind === "start" ? "Start" : point.kind === "end" ? "End" : point.kind === "rail" ? "Rail" : "Bus"}</strong><br>${point.name}`,
          { direction: "top", offset: [0, -18] },
        )
        .addTo(routeLayer);
    });

    map.flyToBounds(L.latLngBounds(latLngs), { padding: [34, 34], maxZoom: 15, duration: 0.7 });
  }, [points]);

  useEffect(() => {
    const liveLayer = liveLayerRef.current;
    if (!liveLayer) return;
    liveLayer.clearLayers();
    if (!livePoint) return;
    L.circleMarker([livePoint.lat, livePoint.lon], {
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

  return <div ref={nodeRef} className="h-full w-full" aria-label="Interactive map of your door-to-door commute" />;
}