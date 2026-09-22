import { useEffect, useRef } from "react";
import L from "leaflet";

type WalkingMicroMapProps = {
  from: { lat: number; lon: number; label: string };
  to: { lat: number; lon: number; label: string };
};

function pin(color: string) {
  return L.divIcon({
    className: "nalu-marker-shell",
    html: `<span class="nalu-walk-pin" style="--walk-pin:${color}"></span>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}

export default function WalkingMicroMap({ from, to }: WalkingMicroMapProps) {
  const nodeRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const node = nodeRef.current;
    if (!node) return;
    const map = L.map(node, {
      zoomControl: false,
      attributionControl: true,
      dragging: true,
      scrollWheelZoom: false,
      doubleClickZoom: false,
    });
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      maxZoom: 20,
      subdomains: "abcd",
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    }).addTo(map);
    const points: L.LatLngTuple[] = [[from.lat, from.lon], [to.lat, to.lon]];
    L.polyline(points, {
      color: "var(--color-primary)",
      weight: 4,
      opacity: 0.95,
      dashArray: "7 8",
      lineCap: "round",
    }).addTo(map);
    L.marker(points[0], { icon: pin("var(--color-location)"), title: from.label }).bindTooltip(from.label).addTo(map);
    L.marker(points[1], { icon: pin("var(--color-primary)"), title: to.label }).bindTooltip(to.label).addTo(map);
    map.fitBounds(L.latLngBounds(points), { padding: [28, 28], maxZoom: 16, animate: false });
    window.requestAnimationFrame(() => map.invalidateSize({ animate: false }));
    return () => map.remove();
  }, [from.lat, from.lon, from.label, to.lat, to.lon, to.label]);

  return <div ref={nodeRef} className="h-40 w-full" aria-label={`Walking map from ${from.label} to ${to.label}`} />;
}