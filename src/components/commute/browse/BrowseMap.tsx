import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import { removeMapSafely } from "@/lib/leaflet-safe";
import { flyMotion, prefersReducedMotion } from "@/lib/motion";
import { skylineStationParts } from "@/lib/rail/station-names";
import { splitSkylineStations } from "@/lib/rail/skyline-stations";
import { INCIDENT_GLYPH } from "./incident-glyphs";

/**
 * The Browse sheet's map: one dark, non-satellite map with switchable layers.
 * It never shows popups (the sheet is the detail view) and it keeps its own
 * size, shifting its view when the sheet covers its lower part.
 * Tiles: CARTO dark (same provider NearbyTransitMap uses, no new key).
 */

export type MapStop = {
  stopId: string;
  stopName: string;
  lat: number;
  lon: number;
  kind: "rail" | "bus";
};
export type MapStation = { stopId: string; name: string; lat: number; lon: number };
export type MapPlace = {
  id: string;
  kind: "home" | "work";
  label: string;
  lat: number;
  lon: number;
};
export type MapSelection =
  | { kind: "stop"; id: string }
  | { kind: "station"; id: string }
  | { kind: "place"; id: string }
  | { kind: "incident"; id: string }
  /** A traffic-coloured road segment: id is "<road id>#<slow-stretch number or b for the road itself>". */
  | { kind: "traffic"; id: string; lat: number; lon: number };
export type MapLayers = {
  skyline: boolean;
  traffic: boolean;
  incidents: boolean;
  stops: boolean;
  places: boolean;
};
type LL = { lat: number; lon: number };
/** One checked road, ready to draw: where it runs and how it is flowing. */
export type MapTraffic = {
  id: string;
  path: LL[];
  /** "clear": the live check answered with a usual-time comparison. "unknown": it did not. */
  state: "clear" | "unknown";
  sections: { severity: "moderate" | "heavy"; points: LL[] }[];
  /** Changes when the data does, so the layer redraws only then. */
  key: string;
};
export type MapIncident = {
  id: string;
  lat: number;
  lon: number;
  label: string;
  tone: "bad" | "warn" | "info";
  kind: "crash" | "police" | "closure" | "roadwork" | "other";
};
/** Something the sheet asks the map to do: fly to a place, or back to the rider. */
export type MapCommand =
  | { nonce: number; type: "locate" }
  | { nonce: number; type: "point"; point: LL }
  | { nonce: number; type: "path"; points: LL[] };

const TILES = {
  url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png?key=cb1_3t31_1_b6f69033d24b3d666819845e",
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
};

const RAIL_GLYPH =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h10a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3Zm0 3v4h10V6H7Zm0 7a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Zm10 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3ZM8 19h8v2H8v-2Z"/></svg>';
const BUS_GLYPH =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4h12a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3h-1l1.5 2h-3L14 18h-4l-1.5 2h-3L7 18H6a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3Zm0 3v5h12V7H6Zm1 7a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Zm10 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Z"/></svg>';
const HOME_GLYPH =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 3 10.5V21h6v-6h6v6h6V10.5L12 3Z"/></svg>';
const WORK_GLYPH =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3h6a2 2 0 0 1 2 2v2h3a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h3V5a2 2 0 0 1 2-2Zm0 2v2h6V5H9Z"/></svg>';

function icon(
  type: "rail" | "bus" | "home" | "work",
  label: string,
  selected: boolean,
  tag: string,
  /** Pixels to shift the pin from its true spot, so crowded pins can be tapped one by one. */
  shift: [number, number] = [0, 0],
) {
  const glyph =
    type === "rail"
      ? RAIL_GLYPH
      : type === "bus"
        ? BUS_GLYPH
        : type === "home"
          ? HOME_GLYPH
          : WORK_GLYPH;
  const cls = type === "home" || type === "work" ? "nb-marker-place" : `nalu-marker-${type}`;
  return L.divIcon({
    className: `nalu-marker-shell ${tag}`,
    html: `<span class="nalu-marker ${cls}${selected ? " is-selected" : ""}" role="img" aria-label="${label}">${glyph}</span>`,
    iconSize: [40, 40],
    iconAnchor: [20 - shift[0], 20 - shift[1]],
  });
}

const NO_BUSES: ReadonlyArray<{ id: string; route: string; lat: number; lon: number }> = [];

/** A bus on its way: a rounded tag with the route number, clearly not a stop pin. Static, never animated. */
function liveBusIcon(route: string) {
  const el = document.createElement("span");
  el.className = "nb-live-bus";
  el.setAttribute("role", "img");
  el.setAttribute("aria-label", `Bus ${route}, live position`);
  el.innerHTML = BUS_GLYPH;
  const number = document.createElement("span");
  number.textContent = route.slice(0, 4);
  el.appendChild(number);
  return L.divIcon({
    className: "nalu-marker-shell nb-live-bus-shell",
    html: el,
    iconSize: [56, 32],
    iconAnchor: [28, 16],
  });
}

function incidentIcon(
  label: string,
  kind: MapIncident["kind"],
  tone: MapIncident["tone"],
  selected: boolean,
  pulse: boolean,
) {
  const cls = kind === "other" ? `nb-incident-${tone}` : `nb-incident-${kind}`;
  return L.divIcon({
    className: "nalu-marker-shell nb-pin nb-pin-incident",
    html: `<span class="nb-incident ${cls}${selected ? " is-selected" : ""}${pulse ? " is-new" : ""}" role="img" aria-label="${label}">${INCIDENT_GLYPH[kind]}</span>`,
    // A 44 px hit area around the 36 px circle.
    iconSize: [44, 44],
    iconAnchor: [22, 22],
  });
}

function stationLabelHtml(name: string) {
  const parts = skylineStationParts(name);
  const english = parts?.english ?? name;
  const el = document.createElement("span");
  const a = document.createElement("span");
  a.className = "nb-label-en";
  a.textContent = english;
  el.appendChild(a);
  if (parts?.hawaiian) {
    const b = document.createElement("span");
    b.className = "nb-label-haw";
    b.textContent = parts.hawaiian;
    el.appendChild(b);
  }
  return el;
}

export default function BrowseMap({
  userPoint,
  stops,
  stations,
  places,
  layers,
  traffic,
  incidents,
  command,
  selected,
  onSelect,
  coverBottom = 0,
  liveBuses = NO_BUSES,
}: {
  userPoint: { lat: number; lon: number };
  stops: MapStop[];
  stations: MapStation[];
  places: MapPlace[];
  layers: MapLayers;
  traffic: MapTraffic[];
  incidents: MapIncident[];
  command: MapCommand | null;
  selected: MapSelection | null;
  onSelect: (selection: MapSelection) => void;
  /** Pixels of the map's lower part covered by the sheet. */
  coverBottom?: number;
  /** Live buses heading to the open stop card's stop. Empty when no card is open. */
  liveBuses?: ReadonlyArray<{ id: string; route: string; lat: number; lon: number }>;
}) {
  const [zoomTick, setZoomTick] = useState(0);
  const nodeRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const groupRef = useRef<L.LayerGroup | null>(null);
  const dotRef = useRef<L.CircleMarker | null>(null);
  const fittedRef = useRef<string | null>(null);
  const coverRef = useRef(coverBottom);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const userRef = useRef(userPoint);
  userRef.current = userPoint;

  useEffect(() => {
    const node = nodeRef.current;
    if (!node || mapRef.current) return;
    const map = L.map(node, {
      zoomControl: false,
      attributionControl: true,
      scrollWheelZoom: true,
      dragging: true,
    }).setView([userPoint.lat, userPoint.lon], 13);
    L.tileLayer(TILES.url, { maxZoom: 19, subdomains: "abcd", attribution: TILES.attribution })
      .addTo(map)
      .bringToBack();
    // Pinch (or the wheel) zooms; there are no +/- buttons.
    map.createPane("nb-traffic-pane").style.zIndex = "410";
    map.createPane("nb-line-pane").style.zIndex = "420";
    map.createPane("nalu-stop-pane").style.zIndex = "650";
    map.createPane("nalu-location-pane").style.zIndex = "700";
    groupRef.current = L.layerGroup().addTo(map);
    // Station names show once the map is zoomed in far enough to read them.
    const labels = () => node.classList.toggle("nb-show-labels", map.getZoom() >= 13);
    map.on("zoomend", labels);
    map.on("zoomend", () => setZoomTick((tick) => tick + 1));
    labels();
    mapRef.current = map;
    return () => {
      removeMapSafely(map);
      mapRef.current = null;
      groupRef.current = null;
      busLayerRef.current = null;
      dotRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Live buses live in their own layer: a 60 s position refresh never rebuilds the pins above.
  const busLayerRef = useRef<L.LayerGroup | null>(null);
  const busSignature = liveBuses.map((b) => `${b.id}:${b.route}:${b.lat},${b.lon}`).join("|");
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!busLayerRef.current) busLayerRef.current = L.layerGroup().addTo(map);
    const layer = busLayerRef.current;
    layer.clearLayers();
    for (const bus of liveBuses) {
      L.marker([bus.lat, bus.lon], {
        pane: "nalu-location-pane",
        icon: liveBusIcon(bus.route),
        title: `Bus ${bus.route}`,
        keyboard: false,
        interactive: false,
      }).addTo(layer);
    }
    return () => {
      layer.clearLayers();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busSignature]);

  const pulsedRef = useRef(new Set<string>());
  const signature = [
    layers.traffic && traffic.map((t) => `${t.id}:${t.key}`).join(","),
    layers.incidents && incidents.map((i) => `${i.id}`).join(","),
    layers.stops && stops.map((s) => s.stopId).join(","),
    layers.skyline && stations.map((s) => s.stopId).join(","),
    layers.places && places.map((p) => `${p.id}:${p.lat},${p.lon}`).join(","),
    selected ? `${selected.kind}:${selected.id}` : "",
    zoomTick,
  ].join("|");

  // Rebuild markers only when what is shown, or what is selected, changes.
  useEffect(() => {
    const map = mapRef.current;
    const group = groupRef.current;
    if (!map || !group) return;
    group.clearLayers();
    const isSel = (kind: MapSelection["kind"], id: string) =>
      selected?.kind === kind && selected.id === id;

    if (layers.traffic) {
      // Only the roads Nalu checks for this rider are coloured; others carry no colour at all.
      for (const road of traffic) {
        if (road.path.length < 2) continue;
        const line = road.path.map((p) => [p.lat, p.lon] as L.LatLngTuple);
        const base = road.state === "clear" ? "#30d158" : "#8e8e93";
        const tap = (id: string) => (event: L.LeafletMouseEvent) => {
          L.DomEvent.stopPropagation(event);
          onSelectRef.current({
            kind: "traffic",
            id,
            lat: event.latlng.lat,
            lon: event.latlng.lng,
          });
        };
        const roadSelected = selected?.kind === "traffic" && selected.id.startsWith(`${road.id}#`);
        L.polyline(line, {
          pane: "nb-traffic-pane",
          color: "#06090d",
          weight: 9,
          opacity: 0.55,
          interactive: false,
        }).addTo(group);
        L.polyline(line, {
          pane: "nb-traffic-pane",
          color: base,
          weight: 5,
          opacity: road.state === "clear" ? 0.8 : 0.55,
          interactive: false,
        }).addTo(group);
        // A wide, invisible strip makes the road easy to tap with a finger.
        L.polyline(line, {
          pane: "nb-traffic-pane",
          color: "#000",
          weight: 26,
          opacity: 0,
          bubblingMouseEvents: false,
        })
          .on("click", tap(`${road.id}#b`))
          .addTo(group);
        road.sections.forEach((section, index) => {
          if (section.points.length < 2) return;
          const heavy = section.severity === "heavy";
          const pts = section.points.map((p) => [p.lat, p.lon] as L.LatLngTuple);
          L.polyline(pts, {
            pane: "nb-traffic-pane",
            color: heavy ? "#ff453a" : "#ffb340",
            weight: 5,
            opacity: 0.95,
            interactive: false,
          }).addTo(group);
          // Flowing dashes only where traffic is slow; slower flow = heavier congestion (CSS).
          L.polyline(pts, {
            pane: "nb-traffic-pane",
            color: "#ffffff",
            weight: 2,
            opacity: 0.85,
            dashArray: "2 14",
            className: heavy ? "nb-flow nb-flow-heavy" : "nb-flow nb-flow-moderate",
            interactive: false,
          }).addTo(group);
          L.polyline(pts, {
            pane: "nb-traffic-pane",
            color: "#000",
            weight: 26,
            opacity: 0,
            bubblingMouseEvents: false,
          })
            .on("click", tap(`${road.id}#${index}`))
            .addTo(group);
          if (selected?.kind === "traffic" && selected.id === `${road.id}#${index}`)
            L.polyline(pts, {
              pane: "nb-traffic-pane",
              color: "#fff",
              weight: 9,
              opacity: 0.45,
              interactive: false,
            }).addTo(group);
        });
        if (roadSelected && selected.id.endsWith("#b"))
          L.polyline(line, {
            pane: "nb-traffic-pane",
            color: "#fff",
            weight: 9,
            opacity: 0.3,
            interactive: false,
          }).addTo(group);
      }
    }
    if (layers.incidents) {
      for (const incident of incidents) {
        const fresh = !pulsedRef.current.has(incident.id);
        pulsedRef.current.add(incident.id);
        const marker = L.marker([incident.lat, incident.lon], {
          pane: "nalu-stop-pane",
          icon: incidentIcon(
            incident.label,
            incident.kind,
            incident.tone,
            isSel("incident", incident.id),
            fresh,
          ),
          title: incident.label,
          keyboard: true,
          zIndexOffset: 400,
        });
        marker.on("click", () => onSelectRef.current({ kind: "incident", id: incident.id }));
        marker.addTo(group);
      }
    }

    const { known: lineStations, unknown } = splitSkylineStations(stations);
    if (unknown.length)
      console.warn(
        "Rail stations not in the Skyline name list:",
        unknown.map((u) => u.stopId),
      );
    if (layers.skyline && lineStations.length > 1) {
      const line = lineStations.map((s) => [s.lat, s.lon] as L.LatLngTuple);
      L.polyline(line, {
        pane: "nb-line-pane",
        color: "#0a84ff",
        weight: 9,
        opacity: 0.18,
        interactive: false,
      }).addTo(group);
      L.polyline(line, {
        pane: "nb-line-pane",
        color: "#6cb8ff",
        weight: 3,
        opacity: 0.95,
        interactive: false,
      }).addTo(group);
    }
    if (layers.skyline) {
      for (const station of lineStations) {
        const marker = L.marker([station.lat, station.lon], {
          pane: "nalu-stop-pane",
          icon: icon(
            "rail",
            "Skyline station",
            isSel("station", station.stopId) || isSel("stop", station.stopId),
            "nb-pin",
          ),
          title: skylineStationParts(station.name)?.english ?? station.name,
          keyboard: true,
        });
        // Names sit beside the pin (not on the line) so they stay clear of the chips.
        marker.bindTooltip(stationLabelHtml(station.name), {
          permanent: true,
          direction: "right",
          offset: [14, 0],
          className: "nb-label",
        });
        marker.on("click", () => onSelectRef.current({ kind: "station", id: station.stopId }));
        marker.addTo(group);
      }
    }
    if (layers.stops) {
      const stationIds = new Set(lineStations.map((s) => s.stopId));
      const shown = stops.filter(
        (stop) => !(layers.skyline && stop.kind === "rail" && stationIds.has(stop.stopId)),
      );
      // Pins closer than a fingertip fan out around their group's middle.
      const points = shown.map((stop) => map.latLngToContainerPoint([stop.lat, stop.lon]));
      const group_of: number[] = shown.map(() => -1);
      const groups: number[][] = [];
      shown.forEach((_, i) => {
        const hit = groups.findIndex((g) => g.some((j) => points[i]!.distanceTo(points[j]!) < 30));
        if (hit === -1) {
          group_of[i] = groups.length;
          groups.push([i]);
        } else {
          group_of[i] = hit;
          groups[hit]!.push(i);
        }
      });
      shown.forEach((stop, i) => {
        const members = groups[group_of[i]!]!;
        let shift: [number, number] = [0, 0];
        if (members.length > 1) {
          const slot = members.indexOf(i);
          const angle = (slot / members.length) * Math.PI * 2 - Math.PI / 2;
          const radius = 14 + members.length * 3;
          shift = [Math.cos(angle) * radius, Math.sin(angle) * radius];
        }
        const marker = L.marker([stop.lat, stop.lon], {
          pane: "nalu-stop-pane",
          icon: icon(
            stop.kind,
            stop.kind === "rail" ? "Rail station" : "Bus stop",
            isSel("stop", stop.stopId),
            "nb-pin",
            shift,
          ),
          title: stop.stopName,
          keyboard: true,
        });
        marker.on("click", () => onSelectRef.current({ kind: "stop", id: stop.stopId }));
        marker.addTo(group);
      });
    }
    if (layers.places) {
      for (const place of places) {
        const marker = L.marker([place.lat, place.lon], {
          pane: "nalu-stop-pane",
          icon: icon(place.kind, place.label, isSel("place", place.id), "nb-pin"),
          title: place.label,
          keyboard: true,
        });
        marker.on("click", () => onSelectRef.current({ kind: "place", id: place.id }));
        marker.addTo(group);
      }
    }
    dotRef.current = L.circleMarker([userRef.current.lat, userRef.current.lon], {
      pane: "nalu-location-pane",
      radius: 7,
      color: "var(--color-foreground)",
      weight: 3,
      fillColor: "var(--color-location)",
      fillOpacity: 1,
      className: "nalu-location-dot",
      interactive: false,
    }).addTo(group);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  useEffect(() => {
    dotRef.current?.setLatLng([userPoint.lat, userPoint.lon]);
  }, [userPoint.lat, userPoint.lon]);

  // The sheet rising over the map's lower part: shift the view by half the
  // change so what was centered stays centered in what is still visible.
  useEffect(() => {
    const map = mapRef.current;
    const delta = coverBottom - coverRef.current;
    coverRef.current = coverBottom;
    if (!map || !delta) return;
    map.panBy([0, delta / 2], { animate: !prefersReducedMotion(), duration: 0.28 });
  }, [coverBottom]);

  // Selecting something moves it into the part of the map the sheet leaves open.
  const selectedPoint = (() => {
    if (!selected) return null;
    if (selected.kind === "place") return places.find((p) => p.id === selected.id) ?? null;
    if (selected.kind === "traffic") return { lat: selected.lat, lon: selected.lon };
    if (selected.kind === "incident") return incidents.find((i) => i.id === selected.id) ?? null;
    if (selected.kind === "station") return stations.find((s) => s.stopId === selected.id) ?? null;
    return stops.find((s) => s.stopId === selected.id) ?? null;
  })();
  const selLat = selectedPoint?.lat;
  const selLon = selectedPoint?.lon;
  useEffect(() => {
    if (selLat === undefined || selLon === undefined) return;
    // After the sheet-cover shift (below) has finished, so the two pans never cancel each other.
    const timer = window.setTimeout(() => {
      const map = mapRef.current;
      if (!map) return;
      const visibleHeight = map.getSize().y - coverRef.current;
      const point = map.latLngToContainerPoint([selLat, selLon]);
      // Already comfortably in view: leave the camera alone.
      if (
        point.y > 72 &&
        point.y < visibleHeight - 40 &&
        point.x > 24 &&
        point.x < map.getSize().x - 24
      )
        return;
      map.panBy([point.x - map.getSize().x / 2, point.y - visibleHeight / 2], {
        animate: !prefersReducedMotion(),
        duration: 0.28,
      });
    }, 330);
    return () => window.clearTimeout(timer);
  }, [selLat, selLon]);

  const fitPoints = (): L.LatLngExpression[] => [
    [userRef.current.lat, userRef.current.lon],
    ...stops.map((s) => [s.lat, s.lon] as L.LatLngTuple),
  ];
  const fitOptions = () => ({
    paddingTopLeft: [56, 150] as L.PointTuple,
    paddingBottomRight: [56, 56 + coverRef.current] as L.PointTuple,
    maxZoom: 13,
  });

  // Fit once per set of nearby stops, never on each GPS tick.
  const stopsKey = stops.map((s) => s.stopId).join(",");
  useEffect(() => {
    const map = mapRef.current;
    if (!map || fittedRef.current === stopsKey) return;
    fittedRef.current = stopsKey;
    map.invalidateSize({ animate: false });
    const points = fitPoints();
    if (points.length > 1) map.fitBounds(L.latLngBounds(points), fitOptions());
    else map.setView([userRef.current.lat, userRef.current.lon], 14);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stopsKey]);

  // The sheet asks the map to fly somewhere (a tapped "Right now" item) or back to the rider.
  const lastCommand = useRef(0);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !command || command.nonce === lastCommand.current) return;
    lastCommand.current = command.nonce;
    const padBottom = 56 + coverRef.current;
    if (command.type === "locate") {
      map.flyTo([userRef.current.lat, userRef.current.lon], 14, { ...flyMotion(0.45) });
    } else if (command.type === "point") {
      const zoom = Math.max(map.getZoom(), 14);
      const target = map.project([command.point.lat, command.point.lon], zoom);
      // Aim a little above centre: the sheet covers the lower part.
      const center = map.unproject(target.add([0, coverRef.current / 2]), zoom);
      map.flyTo(center, zoom, { ...flyMotion(0.45) });
    } else if (command.points.length > 1) {
      map.flyToBounds(L.latLngBounds(command.points.map((p) => [p.lat, p.lon] as L.LatLngTuple)), {
        paddingTopLeft: [40, 150] as L.PointTuple,
        paddingBottomRight: [40, padBottom] as L.PointTuple,
        maxZoom: 13,
        ...flyMotion(0.45),
      });
    }
  }, [command]);

  return (
    <div
      className="relative z-0 isolate h-full w-full"
      style={{ "--nb-cover": `${coverBottom}px` } as React.CSSProperties}
    >
      <div
        ref={nodeRef}
        className="h-full w-full"
        aria-label="Map of nearby stops, the Skyline line and your places"
      />
    </div>
  );
}
