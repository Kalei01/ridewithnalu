import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import { LocateFixed, Map, Maximize, Satellite } from "lucide-react";
import { Button } from "@/components/ui/button";

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
  const [basemap, setBasemap] = useState<Basemap>("standard");
  const nodeRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);
  const fittedStopsRef = useRef<string | null>(null);

  useEffect(() => {
    const node = nodeRef.current;
    if (!node || mapRef.current) return;

    const map = L.map(node, {
      zoomControl: false,
      attributionControl: true,
      scrollWheelZoom: false,
      dragging: true,
    }).setView([userPoint.lat, userPoint.lon], 14);

    tileLayerRef.current = L.tileLayer(BASEMAPS.standard.url, {
      maxZoom: 19,
      subdomains: "abcd",
      attribution: BASEMAPS.standard.attribution,
    }).addTo(map);
    L.control.zoom({ position: "bottomright" }).addTo(map);
    markersRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      tileLayerRef.current = null;
      markersRef.current = null;
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

  // Stop markers rebuild only when the stops or the selection change.
  const stopsSignature = stops.map((stop) => `${stop.stopId}:${stop.lat.toFixed(5)},${stop.lon.toFixed(5)}`).join("|");
  const userDotRef = useRef<L.CircleMarker | null>(null);
  const onSelectStopRef = useRef(onSelectStop);
  onSelectStopRef.current = onSelectStop;
  const userRef = useRef(userPoint);
  userRef.current = userPoint;

  useEffect(() => {
    const map = mapRef.current;
    const markers = markersRef.current;
    if (!map || !markers) return;
    markers.clearLayers();
    userDotRef.current = null;

    userDotRef.current = L.circleMarker([userRef.current.lat, userRef.current.lon], {
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
      marker.on("click", () => onSelectStopRef.current(stop.stopId));
      const tooltip = document.createElement("span");
      tooltip.textContent = stop.stopName;
      marker.bindTooltip(tooltip, { direction: "top", offset: [0, -18] });
      marker.addTo(markers);
    }
  }, [stopsSignature, selectedStopId]);

  // Fit the viewport once per set of stops, never on each GPS tick.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || fittedStopsRef.current === stopsSignature) return;
    fittedStopsRef.current = stopsSignature;
    const points: L.LatLngExpression[] = [
      [userRef.current.lat, userRef.current.lon],
      ...stops.map((stop) => [stop.lat, stop.lon] as L.LatLngTuple),
    ];
    map.invalidateSize({ animate: false });
    if (points.length > 1) map.fitBounds(L.latLngBounds(points), { padding: [38, 38], maxZoom: 15 });
    else map.setView([userRef.current.lat, userRef.current.lon], 14);
  }, [stopsSignature]);

  // The live dot slides to the new position without moving the viewport.
  useEffect(() => {
    userDotRef.current?.setLatLng([userPoint.lat, userPoint.lon]);
  }, [userPoint.lat, userPoint.lon]);


  const recenter = () => mapRef.current?.flyTo([userPoint.lat, userPoint.lon], 15, { duration: 0.7 });

  const fitNearby = () => {
    const map = mapRef.current;
    if (!map) return;
    const points: L.LatLngExpression[] = [[userPoint.lat, userPoint.lon], ...stops.map((stop) => [stop.lat, stop.lon] as L.LatLngTuple)];
    if (points.length > 1) map.flyToBounds(L.latLngBounds(points), { padding: [42, 42], maxZoom: 15, duration: 0.7 });
  };

  return (
    <div className="relative z-0 isolate h-full w-full">
      <div ref={nodeRef} className="h-full w-full" aria-label="Map of nearby rail stations and bus stops" />
      <div className="absolute right-3 top-16 z-[500] flex flex-col items-end gap-2" aria-label="Map controls">
        <div className="flex overflow-hidden rounded-md border border-border bg-background/95 shadow-lg backdrop-blur-md">
          <Button type="button" variant="ghost" size="sm" aria-label="Show standard map" aria-pressed={basemap === "standard"} data-pressed={basemap === "standard"} onClick={() => setBasemap("standard")} className="rounded-none px-2.5 text-foreground data-[pressed=true]:bg-primary data-[pressed=true]:text-primary-foreground">
            <Map /> Standard
          </Button>
          <Button type="button" variant="ghost" size="sm" aria-label="Show satellite map" aria-pressed={basemap === "satellite"} data-pressed={basemap === "satellite"} onClick={() => setBasemap("satellite")} className="rounded-none border-l border-border px-2.5 text-foreground data-[pressed=true]:bg-primary data-[pressed=true]:text-primary-foreground">
            <Satellite /> Satellite
          </Button>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="secondary" size="icon" onClick={fitNearby} aria-label="Fit nearby stops" title="Fit nearby stops" className="size-11 border border-border bg-background/95 shadow-lg backdrop-blur-md">
            <Maximize className="size-5" />
          </Button>
          <Button type="button" variant="secondary" size="icon" onClick={recenter} aria-label="Recenter on my location" title="Recenter on my location" className="size-11 border border-border bg-background/95 shadow-lg backdrop-blur-md">
            <LocateFixed className="size-5" />
          </Button>
        </div>
      </div>
    </div>
  );
}