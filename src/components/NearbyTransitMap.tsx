import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import { LocateFixed, Map, Maximize, Satellite, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export type NearbyMapStop = {
  stopId: string;
  stopName: string;
  lat: number;
  lon: number;
  kind: "rail" | "bus";
  arrivals: Array<{ label: string; time: string; minutesAway: number }>;
};

type NearbyTransitMapProps = {
  userPoint: { lat: number; lon: number };
  stops: NearbyMapStop[];
  selectedStopId: string | null;
  onSelectStop: (stopId: string) => void;
  onSetStart: (stop: NearbyMapStop) => void;
  onSetDestination: (stop: NearbyMapStop) => void;
  actionBusy?: boolean;
};

type Basemap = "standard" | "satellite";

const BASEMAPS = {
  standard: {
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png?key=cb1_3t31_1_b6f69033d24b3d666819845e",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
  },
  satellite: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution:
      "Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community",
  },
} as const;

function markerIcon(kind: "rail" | "bus", selected: boolean) {
  const label = kind === "rail" ? "Rail station" : "Bus stop";
  // Keep the map footprint stable; selection is communicated with a ring, not a stretched marker.
  const size = kind === "bus" ? 20 : 24;
  const half = size / 2;
  const glyph =
    kind === "rail"
      ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h10a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3Zm0 3v4h10V6H7Zm0 7a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Zm10 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3ZM8 19h8v2H8v-2Z"/></svg>'
      : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4h12a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3h-1l1.5 2h-3L14 18h-4l-1.5 2h-3L7 18H6a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3Zm0 3v5h12V7H6Zm1 7a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Zm10 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Z"/></svg>';
  const hitSize = 40;
  const hitHalf = hitSize / 2;
  return L.divIcon({
    className: "nalu-marker-shell",
    html: `<span class="nalu-marker nalu-marker-${kind}${selected ? " is-selected" : ""}" aria-label="${label}">${glyph}</span>`,
    iconSize: [hitSize, hitSize],
    iconAnchor: [hitHalf, hitHalf],
  });
}

export default function NearbyTransitMap({
  userPoint,
  stops,
  selectedStopId,
  onSelectStop,
  onSetStart,
  onSetDestination,
  actionBusy = false,
}: NearbyTransitMapProps) {
  const [basemap, setBasemap] = useState<Basemap>("standard");
  const [previewStopId, setPreviewStopId] = useState<string | null>(null);
  const previewStop = stops.find((stop) => stop.stopId === previewStopId) ?? null;
  const previewMissing = Boolean(previewStopId && !previewStop);
  const previewLat = previewStop?.lat;
  const previewLon = previewStop?.lon;
  const cardRef = useRef<HTMLDivElement | null>(null);
  const nodeRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);
  const fittedStopsRef = useRef<string | null>(null);

  useEffect(() => {
    if (previewMissing) setPreviewStopId(null);
  }, [previewMissing]);

  useEffect(() => {
    const node = nodeRef.current;
    if (!node || mapRef.current) return;

    const map = L.map(node, {
      zoomControl: false,
      attributionControl: true,
      scrollWheelZoom: false,
      dragging: true,
    }).setView([userPoint.lat, userPoint.lon], 13);

    tileLayerRef.current = L.tileLayer(BASEMAPS.standard.url, {
      maxZoom: 19,
      subdomains: "abcd",
      attribution: BASEMAPS.standard.attribution,
    }).addTo(map);
    L.control.zoom({ position: "bottomright" }).addTo(map);
    map.createPane("nalu-stop-pane");
    const stopPane = map.getPane("nalu-stop-pane");
    if (stopPane) stopPane.style.zIndex = "650";
    map.createPane("nalu-location-pane");
    const locationPane = map.getPane("nalu-location-pane");
    if (locationPane) locationPane.style.zIndex = "700";
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
    tileLayerRef.current = L.tileLayer(next.url, {
      maxZoom: 19,
      subdomains: "abcd",
      attribution: next.attribution,
    }).addTo(map);
    tileLayerRef.current.bringToBack();
  }, [basemap]);

  // Stop markers rebuild only when the stops or the selection change.
  const stopsSignature = stops
    .map((stop) => `${stop.stopId}:${stop.lat.toFixed(5)},${stop.lon.toFixed(5)}`)
    .join("|");
  const userDotRef = useRef<L.CircleMarker | null>(null);
  const onSelectStopRef = useRef(onSelectStop);
  onSelectStopRef.current = onSelectStop;
  const openPreview = (stopId: string) => {
    setPreviewStopId(stopId);
    onSelectStopRef.current(stopId);
  };
  const openPreviewRef = useRef(openPreview);
  openPreviewRef.current = openPreview;
  const userRef = useRef(userPoint);
  userRef.current = userPoint;

  useEffect(() => {
    const map = mapRef.current;
    const markers = markersRef.current;
    if (!map || !markers) return;
    markers.clearLayers();
    userDotRef.current = null;

    userDotRef.current = L.circleMarker([userRef.current.lat, userRef.current.lon], {
      pane: "nalu-location-pane",
      radius: 7,
      color: "var(--color-foreground)",
      weight: 3,
      fillColor: "var(--color-location)",
      fillOpacity: 1,
      className: "nalu-location-dot",
    })
      .bindTooltip("Your location", { direction: "top", offset: [0, -10] })
      .addTo(markers);

    for (const stop of stops) {
      const marker = L.marker([stop.lat, stop.lon], {
        pane: "nalu-stop-pane",
        icon: markerIcon(stop.kind, stop.stopId === (previewStopId ?? selectedStopId)),
        title: stop.stopName,
        keyboard: true,
      });
      marker.on("click", () => openPreviewRef.current(stop.stopId));
      const tooltip = document.createElement("span");
      tooltip.textContent = stop.stopName;
      marker.bindTooltip(tooltip, { direction: "top", offset: [0, -18] });
      marker.addTo(markers);
    }
  }, [stopsSignature, selectedStopId, previewStopId]);

  // Move the selected pin into the open space above the bottom preview card.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || previewLat === undefined || previewLon === undefined) return;
    const zoom = Math.max(map.getZoom(), 14);
    const cardHeight = cardRef.current?.offsetHeight ?? 180;
    const offset = Math.min(map.getSize().y * 0.32, cardHeight / 2 + 24);
    const pin = L.latLng(previewLat, previewLon);
    const center = map.unproject(map.project(pin, zoom).add([0, offset]), zoom);
    map.flyTo(center, zoom, { duration: 0.45 });
  }, [previewStopId, previewLat, previewLon]);

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
    if (points.length > 1)
      map.fitBounds(L.latLngBounds(points), { padding: [56, 56], maxZoom: 13 });
    else map.setView([userRef.current.lat, userRef.current.lon], 14);
  }, [stopsSignature]);

  // The live dot slides to the new position without moving the viewport.
  useEffect(() => {
    userDotRef.current?.setLatLng([userPoint.lat, userPoint.lon]);
  }, [userPoint.lat, userPoint.lon]);

  const recenter = () =>
    mapRef.current?.flyTo([userPoint.lat, userPoint.lon], 15, { duration: 0.7 });

  const fitNearby = () => {
    const map = mapRef.current;
    if (!map) return;
    const points: L.LatLngExpression[] = [
      [userPoint.lat, userPoint.lon],
      ...stops.map((stop) => [stop.lat, stop.lon] as L.LatLngTuple),
    ];
    if (points.length > 1)
      map.flyToBounds(L.latLngBounds(points), { padding: [56, 56], maxZoom: 13, duration: 0.7 });
  };

  return (
    <div className="relative z-0 isolate h-full w-full">
      <div
        ref={nodeRef}
        className="h-full w-full"
        aria-label="Map of nearby rail stations and bus stops"
      />
      <div
        className="absolute right-3 top-16 z-[500] flex flex-col items-end gap-2"
        aria-label="Map controls"
      >
        <div className="flex overflow-hidden rounded-md border border-border bg-background/95 shadow-lg backdrop-blur-md">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label="Show standard map"
            aria-pressed={basemap === "standard"}
            data-pressed={basemap === "standard"}
            onClick={() => setBasemap("standard")}
            className="rounded-none px-2.5 text-[var(--nalu-platinum)] data-[pressed=true]:bg-primary data-[pressed=true]:text-[#04111f]"
          >
            <Map /> Standard
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label="Show satellite map"
            aria-pressed={basemap === "satellite"}
            data-pressed={basemap === "satellite"}
            onClick={() => setBasemap("satellite")}
            className="rounded-none border-l border-border px-2.5 text-[var(--nalu-platinum)] data-[pressed=true]:bg-primary data-[pressed=true]:text-[#04111f]"
          >
            <Satellite /> Satellite
          </Button>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="secondary"
            size="icon"
            onClick={fitNearby}
            aria-label="Fit nearby stops"
            title="Fit nearby stops"
            className="size-11 border border-border bg-background/95 shadow-lg backdrop-blur-md"
          >
            <Maximize className="size-5" />
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="icon"
            onClick={recenter}
            aria-label="Recenter on my location"
            title="Recenter on my location"
            className="size-11 border border-border bg-background/95 shadow-lg backdrop-blur-md"
          >
            <LocateFixed className="size-5" />
          </Button>
        </div>
      </div>
      {previewStop && (
        <div
          ref={cardRef}
          role="region"
          aria-label={`Departures at ${previewStop.stopName}`}
          className="absolute inset-x-3 bottom-3 z-[600] rounded-3xl bg-card/80 p-4 pt-2 shadow-2xl ring-1 ring-foreground/10 backdrop-blur-2xl backdrop-saturate-150"
        >
          <div aria-hidden className="mx-auto mb-2 h-1 w-9 rounded-full bg-foreground/20" />
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-foreground">{previewStop.stopName}</p>
              <p className="text-xs text-muted-foreground">
                {previewStop.kind === "rail" ? "Skyline station" : "TheBus stop"} · scheduled departures
              </p>
            </div>
            <Button variant="ghost" size="icon" className="size-8 shrink-0" aria-label="Close stop preview"
              onClick={() => setPreviewStopId(null)}>
              <X className="size-4" />
            </Button>
          </div>
          <div className="mt-2 flex gap-2 overflow-x-auto" aria-live="polite">
            {previewStop.arrivals.length ? previewStop.arrivals.slice(0, 3).map((arrival, index) => (
              <div key={`${arrival.time}-${index}`} className="min-w-20 rounded-lg bg-surface-raised px-2 py-1.5">
                <p className="truncate text-xs font-semibold text-foreground">{arrival.label}</p>
                <p className="text-sm font-bold tabular-nums text-primary">{arrival.minutesAway} min</p>
                <p className="text-xs tabular-nums text-muted-foreground">{arrival.time}</p>
              </div>
            )) : (
              <p className="text-xs text-muted-foreground">No upcoming scheduled departures.</p>
            )}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button size="sm" variant="outline" disabled={actionBusy} onClick={() => onSetStart(previewStop)}>
              Set as Start
            </Button>
            <Button size="sm" disabled={actionBusy} onClick={() => onSetDestination(previewStop)}>
              Set as Destination
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
