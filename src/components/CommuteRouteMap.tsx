import "./map-2.css";
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

type MapIncident = {
  description: string;
  road: string | null;
  delayMinutes: number | null;
  points?: Array<{ lat: number; lon: number }>;
};

type JourneySegment = {
  id: string;
  mode: "walk" | "drive" | "bus" | "rail";
  points: Array<{ lat: number; lon: number }>;
};

type CommuteRouteMapProps = {
  points: JourneyPoint[];
  livePoint: { lat: number; lon: number } | null;
  liveHeading?: number | null;
  followLive?: boolean;
  path?: Array<{ lat: number; lon: number }>;
  segments?: JourneySegment[];
  trafficSections?: TrafficSection[];
  focusSection?: number | null;
  incidents?: MapIncident[];
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

function journeyIcon(point: JourneyPoint) {
  const label =
    point.kind === "start"
      ? "Start"
      : point.kind === "end"
        ? "End"
        : point.kind === "rail"
          ? "Rail station"
          : "Bus stop";
  const endpoint = point.kind === "start" || point.kind === "end";
  const glyph =
    point.kind === "rail"
      ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h10a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3Zm0 3v4h10V6H7Zm0 7a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Zm10 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3ZM8 19h8v2H8v-2Z"/></svg>'
      : point.kind === "bus"
        ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4h12a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3h-1l1.5 2h-3L14 18h-4l-1.5 2h-3L7 18H6a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3Zm0 3v5h12V7H6Zm1 7a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0-3 0Zm10 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0-3 0Z"/></svg>'
        : "";
  const hitSize = endpoint ? 58 : 40;
  const half = hitSize / 2;
  return L.divIcon({
    className: "nalu-marker-shell",
    html: `<span class="nalu-journey-marker nalu-journey-marker-${point.kind}" aria-label="${label}"><span class="nalu-journey-marker-label">${endpoint ? (point.kind === "start" ? "START" : "END") : glyph}</span></span>`,
    iconSize: [hitSize, hitSize],
    iconAnchor: [half, half],
  });
}

function tooltip(label: string, value: string) {
  const content = document.createElement("span");
  const strong = document.createElement("strong");
  strong.textContent = label;
  content.append(strong, document.createElement("br"), document.createTextNode(value));
  return content;
}

export default function CommuteRouteMap({
  points,
  livePoint,
  liveHeading,
  followLive = false,
  path,
  segments,
  trafficSections,
  focusSection = null,
  incidents,
}: CommuteRouteMapProps) {
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
    tileLayerRef.current = L.tileLayer(next.url, {
      maxZoom: 19,
      subdomains: "abcd",
      attribution: next.attribution,
    }).addTo(map);
    tileLayerRef.current.bringToBack();
  }, [basemap]);

  const routeSignature = useMemo(
    () =>
      [
        points
          .map((point) => `${point.kind}:${point.lat.toFixed(5)},${point.lon.toFixed(5)}`)
          .join("|"),
        `path:${(path ?? []).map((point) => `${point.lat.toFixed(5)},${point.lon.toFixed(5)}`).join(";")}`,
        `segments:${(segments ?? []).map((segment) => `${segment.id}:${segment.points.map((point) => `${point.lat.toFixed(5)},${point.lon.toFixed(5)}`).join(";")}`).join("|")}`,
        `traffic:${(trafficSections ?? []).map((section) => `${section.severity}:${section.delayMinutes}:${section.points.map((point) => `${point.lat.toFixed(5)},${point.lon.toFixed(5)}`).join(";")}`).join("|")}`,
        `incidents:${(incidents ?? []).map((incident) => `${incident.description}:${incident.road ?? ""}:${incident.delayMinutes ?? ""}:${(incident.points ?? []).map((point) => `${point.lat.toFixed(5)},${point.lon.toFixed(5)}`).join(";")}`).join("|")}`,
      ].join("#"),
    [points, path, segments, trafficSections, incidents],
  );
  const pointsRef = useRef(points);
  pointsRef.current = points;
  const pathRef = useRef(path);
  pathRef.current = path;
  const segmentsRef = useRef(segments);
  segmentsRef.current = segments;
  const trafficRef = useRef(trafficSections);
  trafficRef.current = trafficSections;
  const incidentsRef = useRef(incidents);
  incidentsRef.current = incidents;
  const fittedGeometryRef = useRef<string | null>(null);
  const suppressLiveFollowRef = useRef(false);
  const geometrySignature = useMemo(
    () =>
      [
        points
          .map((point) => `${point.kind}:${point.lat.toFixed(5)},${point.lon.toFixed(5)}`)
          .join("|"),
        (path ?? []).map((point) => `${point.lat.toFixed(5)},${point.lon.toFixed(5)}`).join(";"),
        (segments ?? [])
          .map(
            (segment) =>
              `${segment.id}:${segment.points.map((point) => `${point.lat.toFixed(5)},${point.lon.toFixed(5)}`).join(";")}`,
          )
          .join("|"),
      ].join("#"),
    [points, path, segments],
  );
  const geometrySignatureRef = useRef(geometrySignature);
  geometrySignatureRef.current = geometrySignature;

  useEffect(() => {
    const map = mapRef.current;
    const routeLayer = routeLayerRef.current;
    const current = pointsRef.current;
    if (!map || !routeLayer || current.length < 2) return;
    routeLayer.clearLayers();

    const roadPath = pathRef.current;
    const transitSegments =
      segmentsRef.current?.filter((segment) => segment.points.length > 1) ?? [];
    const hasTransitPoints = current.some(
      (point) => point.kind === "rail" || point.kind === "bus",
    );
    const drawableSegments =
      roadPath && roadPath.length > 1
        ? [{ id: "drive", mode: "drive" as const, points: roadPath }]
        : transitSegments.length > 0
          ? transitSegments
          : hasTransitPoints
            ? []
            : [{ id: "fallback", mode: "rail" as const, points: current }];

    for (const segment of drawableSegments) {
      const latLngs = segment.points.map((point) => [point.lat, point.lon] as L.LatLngTuple);
      const walking = segment.mode === "walk";
      const color =
        segment.mode === "bus"
          ? "var(--color-location)"
          : segment.mode === "walk"
            ? "var(--color-muted-foreground)"
            : "var(--color-primary)";
      L.polyline(latLngs, {
        color: "var(--color-background)",
        weight: walking ? 8 : 12,
        opacity: 0.92,
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

    for (const incident of incidentsRef.current ?? []) {
      const point = incident.points?.[0];
      if (!point) continue;
      const description = incident.description.trim().toLowerCase();
      const isCrash = /accident|crash|collision/.test(description);
      const road = incident.road ? ` on ${incident.road}` : "";
      const delay = incident.delayMinutes && incident.delayMinutes > 0 ? ` · +${incident.delayMinutes} min` : "";
      const marker = L.marker([point.lat, point.lon], {
        icon: L.divIcon({
          className: "nalu-marker-shell",
          html: `<span class="nalu-incident-marker nalu-incident-marker-${isCrash ? "crash" : "alert"}"><span aria-hidden="true">!</span></span>`,
          iconSize: [34, 34],
          iconAnchor: [17, 17],
        }),
        title: `${isCrash ? "Crash reported" : "Traffic incident"}${road}`,
        keyboard: true,
        zIndexOffset: 1300,
      });
      marker
        .bindTooltip(`${isCrash ? "Crash reported" : "Traffic incident"}${road}${delay}`, {
          direction: "top",
          sticky: true,
        })
        .addTo(routeLayer);
    }

    for (const [index, section] of (trafficRef.current ?? []).entries()) {
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
        .on("click", () => {
          map.flyToBounds(L.latLngBounds(latLngs), { padding: [60, 60], maxZoom: 16, duration: 0.6 });
          setSpotlight(index);
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
          tooltip(
            point.kind === "start"
              ? "Start"
              : point.kind === "end"
                ? "End"
                : point.kind === "rail"
                  ? "Rail"
                  : "Bus",
            point.name,
          ),
          { direction: "top", offset: [0, -18] },
        )
        .addTo(routeLayer);
    });

    const boundsLatLngs = [
      ...drawableSegments.flatMap((segment) =>
        segment.points.map((point) => [point.lat, point.lon] as L.LatLngTuple),
      ),
      ...current.map((point) => [point.lat, point.lon] as L.LatLngTuple),
    ];
    if (fittedGeometryRef.current !== geometrySignatureRef.current) {
      const firstFit = fittedGeometryRef.current === null;
      fittedGeometryRef.current = geometrySignatureRef.current;
      if (followLive) suppressLiveFollowRef.current = true;
      map.invalidateSize({ animate: false });
      const fit = () => {
        if (map.getSize().x < 20 || map.getSize().y < 20) return;
        if (firstFit || followLive)
          map.fitBounds(L.latLngBounds(boundsLatLngs), { padding: [52, 52], maxZoom: 12, animate: false });
        else
          map.flyToBounds(L.latLngBounds(boundsLatLngs), { padding: [52, 52], maxZoom: 12, duration: 0.7 });
      };
      requestAnimationFrame(() => {
        map.invalidateSize({ animate: false });
        fit();
      });
    }
  }, [routeSignature]);

  const [spotlight, setSpotlight] = useState<number | null>(null);
  useEffect(() => setSpotlight(focusSection), [focusSection]);
  const spotlightLayerRef = useRef<L.Polyline | null>(null);
  useEffect(() => {
    const map = mapRef.current;
    spotlightLayerRef.current?.remove();
    spotlightLayerRef.current = null;
    const section = spotlight === null ? null : trafficRef.current?.[spotlight];
    if (!map || !section || section.points.length < 2) return;
    const latLngs = section.points.map((p) => [p.lat, p.lon] as L.LatLngTuple);
    spotlightLayerRef.current = L.polyline(latLngs, {
      color: section.severity === "heavy" ? "var(--color-traffic-heavy)" : "var(--color-traffic-moderate)",
      weight: 12,
      opacity: 1,
      lineCap: "round",
      className: "nalu-traffic-spotlight",
    }).addTo(map);
    map.flyToBounds(L.latLngBounds(latLngs), { padding: [60, 60], maxZoom: 16, duration: 0.6 });
  }, [spotlight]);

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
    if (suppressLiveFollowRef.current) {
      suppressLiveFollowRef.current = false;
      return;
    }
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
      ...(segments ?? []).flatMap((segment) =>
        segment.points.map((point) => [point.lat, point.lon] as L.LatLngTuple),
      ),
      ...points.map((point) => [point.lat, point.lon] as L.LatLngTuple),
    ];
    map.flyToBounds(L.latLngBounds(corridor), {
      padding: [42, 42],
      maxZoom: 13,
      duration: 0.7,
    });
  };

  return (
    <div className="relative z-0 isolate h-full w-full nalu-map-frame">
      <div
        ref={nodeRef}
        className="h-full w-full"
        aria-label="Interactive map of your commute"
      />
      <div className="nalu-map-vignette pointer-events-none absolute inset-0 z-[400]" aria-hidden="true" />
      <div
        className="nalu-map-controls"
        aria-label="Map controls"
      >
        <div className="nalu-map-control-cluster" role="group" aria-label="Map style">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Show standard map"
            aria-pressed={basemap === "standard"}
            onClick={() => setBasemap("standard")}
            className="nalu-map-control-button"
            data-pressed={basemap === "standard"}
            title="Standard map"
          >
            <Map aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Show satellite map"
            aria-pressed={basemap === "satellite"}
            onClick={() => setBasemap("satellite")}
            className="nalu-map-control-button"
            data-pressed={basemap === "satellite"}
            title="Satellite map"
          >
            <Satellite aria-hidden="true" />
          </Button>
        </div>
        <div className="nalu-map-control-cluster" role="group" aria-label="Map actions">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={fitRoute}
            aria-label="Fit full route"
            title="Fit full route"
            className="nalu-map-icon-button"
          >
            <Maximize aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={recenter}
            disabled={!livePoint}
            aria-label={livePoint ? "Recenter on my location" : "Current location unavailable"}
            title={livePoint ? "Recenter on my location" : "Current location unavailable"}
            className="nalu-map-icon-button"
          >
            <LocateFixed aria-hidden="true" />
          </Button>
        </div>
      </div>
    </div>
  );
}
