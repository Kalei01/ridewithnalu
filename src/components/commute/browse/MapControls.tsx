import { useEffect, useRef, useState } from "react";
import { Layers, LocateFixed } from "lucide-react";
import type { MapLayers } from "./BrowseMap";
import { INCIDENT_GLYPH } from "./incident-glyphs";

const LEGEND = [
  { kind: "crash", label: "Crash" },
  { kind: "police", label: "Police report" },
  { kind: "closure", label: "Closure" },
  { kind: "roadwork", label: "Roadwork" },
] as const;

const ROWS: { id: keyof MapLayers; label: string; note?: string }[] = [
  { id: "skyline", label: "Skyline & stations" },
  { id: "traffic", label: "Traffic" },
  { id: "incidents", label: "Incidents & roadwork" },
  { id: "stops", label: "Bus stops" },
  { id: "places", label: "Home & Work" },
];

/**
 * The map's only controls: one Layers menu and a locate button.
 * Pinch zooms; there are no +/- or fullscreen buttons.
 */
export function MapControls({
  layers,
  onToggle,
  onLocate,
  trafficSource,
}: {
  layers: MapLayers;
  onToggle: (id: keyof MapLayers) => void;
  onLocate: () => void;
  /** "TomTom live", "Mapbox estimate", or null when no road has answered. */
  trafficSource: string | null;
}) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: PointerEvent) => {
      if (!wrap.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={wrap} className="nb-controls">
      <button
        type="button"
        className="nb-control"
        aria-label="Map layers"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((v) => !v)}
      >
        <Layers aria-hidden="true" className="size-5" />
      </button>
      <button
        type="button"
        className="nb-control"
        aria-label="Center on my location"
        onClick={onLocate}
      >
        <LocateFixed aria-hidden="true" className="size-5" />
      </button>
      {open && (
        <div className="nb-layers-menu" role="group" aria-label="Map layers">
          {ROWS.map((row) => (
            <label key={row.id} className="nb-layers-row">
              <input
                type="checkbox"
                checked={layers[row.id]}
                onChange={() => onToggle(row.id)}
                className="nb-layers-check"
              />
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-foreground">{row.label}</span>
                {row.id === "traffic" && (
                  <span className="block text-xs text-muted-foreground">
                    {trafficSource
                      ? `${trafficSource}. Only the roads Nalu checks for you are coloured; grey means no data.`
                      : "Colours the roads Nalu checks for you once they answer."}
                  </span>
                )}
              </span>
            </label>
          ))}
          <ul className="nb-legend" aria-label="Incident icons">
            {LEGEND.map((item) => (
              <li key={item.kind}>
                <span
                  className={`nb-legend-dot nb-incident-${item.kind}`}
                  aria-hidden="true"
                  // Static, trusted glyph markup from incident-glyphs.ts.
                  dangerouslySetInnerHTML={{ __html: INCIDENT_GLYPH[item.kind] }}
                />
                {item.label}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
