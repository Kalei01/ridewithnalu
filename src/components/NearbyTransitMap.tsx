import { useEffect, useRef } from "react";
import L from "leaflet";

export type NearbyMapStop = {
  stopId: string;
  stopName: string;
  lat: number;
  lon: number;
  kind: "rail" | "bus";
};

type NearbyTransitMapProps = {
  userPoint: { lat: number; lon: number };
  stops: NearbyMapStop[];
  selectedStopId: string | null;
  onSelectStop: (stopId: string) => void;
};

function markerIcon(kind: "rail" | "bus", selected: boolean) {
  const glyph = kind === "rail" ? "▰" : "●";
  const label = kind === "rail" ? "Rail station" : "Bus stop";
  return L.divIcon({
    className: "nalu-marker-shell",
    html: `<span class="nalu-marker nalu-marker-${kind}${selected ? " is-selected" : ""}" aria-label="${label}">${glyph}</span>`,
    iconSize: selected ? [42, 42] : [34, 34],
    iconAnchor: selected ? [21, 21] : [17, 17],
  });
}

export default function NearbyTransitMap({ userPoint, stops, selectedStopId, onSelectStop }: NearbyTransitMapProps) {
  const nodeRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    const node = nodeRef.current;
    if (!node || mapRef.current) return;

    const map = L.map(node, {
      zoomControl: false,
      attributionControl: true,
      scrollWheelZoom: false,
      dragging: true,
      tap: true,
    }).setView([userPoint.lat, userPoint.lon], 14);

    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap &copy; CARTO",
    }).addTo(map);
    L.control.zoom({ position: "bottomright" }).addTo(map);
    markersRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      markersRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const markers = markersRef.current;
    if (!map || !markers) return;
    markers.clearLayers();

    L.circleMarker([userPoint.lat, userPoint.lon], {
      radius: 8,
      color: "var(--color-foreground)",
      weight: 3,
      fillColor: "var(--color-location)",
      fillOpacity: 1,
      className: "nalu-location-dot",
    }).bindTooltip("Your location", { direction: "top", offset: [0, -10] }).addTo(markers);

    for (const stop of stops) {
      const marker = L.marker([stop.lat, stop.lon], {
        icon: markerIcon(stop.kind, stop.stopId === selectedStopId),
        title: stop.stopName,
        keyboard: true,
      });
      marker.on("click", () => onSelectStop(stop.stopId));
      marker.bindTooltip(stop.stopName, { direction: "top", offset: [0, -18] });
      marker.addTo(markers);
    }

    const points: L.LatLngExpression[] = [[userPoint.lat, userPoint.lon], ...stops.map((stop) => [stop.lat, stop.lon] as L.LatLngTuple)];
    if (points.length > 1) map.fitBounds(L.latLngBounds(points), { padding: [38, 38], maxZoom: 15 });
    else map.setView([userPoint.lat, userPoint.lon], 14);
  }, [userPoint.lat, userPoint.lon, stops, selectedStopId, onSelectStop]);

  return <div ref={nodeRef} className="h-full w-full" aria-label="Map of nearby rail stations and bus stops" />;
}