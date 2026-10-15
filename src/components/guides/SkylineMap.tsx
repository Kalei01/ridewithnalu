import { useId } from "react";
import { COAST_PATH, SKYLINE_PATH, SKYLINE_STATIONS } from "@/components/home/island-data";
import "@/components/home/home.css";
import "./skyline-map.css";

/**
 * A static picture of the Skyline line for the guides: Oʻahu's coast and the
 * line drawn from the same baked data as the home page map (island-data.ts),
 * with chosen stations lit. No tiles, no network, no script beyond React: the
 * svg is server-rendered and its size is fixed by `aspect-ratio`, so nothing
 * shifts when it loads. Pair it with a text list of the same stations (the
 * map is a picture of that list, not the only place the facts live).
 *
 * Reuse: pass `pins` for the stations to light (by GTFS stop id), `view` to
 * crop (default: the whole line), and `showAllStations` to dot the other
 * stations in muted blue (for the rail guide). Put it inside a `.nh` element
 * (the colour tokens live there).
 */
export type SkylineMapPin = {
  /** GTFS stop_id, as in SKYLINE_STATIONS. */
  id: string;
  /** Short mark on the pin, like "1". */
  mark: string;
  /** Where the mark sits relative to the dot, in map units. */
  dx?: number;
  dy?: number;
  anchor?: "start" | "middle" | "end";
};

export type SkylineMapView = { x: number; y: number; w: number; h: number };

/** Leeward and south shore, framing the whole line without empty sea. */
export const SKYLINE_LINE_VIEW: SkylineMapView = { x: 195, y: 295, w: 205, h: 100 };

export function SkylineMap({
  pins,
  title,
  view = SKYLINE_LINE_VIEW,
  showAllStations = false,
}: {
  pins: SkylineMapPin[];
  /** Accessible name, read by screen readers. */
  title: string;
  view?: SkylineMapView;
  showAllStations?: boolean;
}) {
  const uid = useId().replace(/:/g, "");
  const byId = new Map(SKYLINE_STATIONS.map((s) => [s.id, s]));
  const pinIds = new Set(pins.map((p) => p.id));
  return (
    <svg
      className="sk-map"
      viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
      style={{ aspectRatio: `${view.w} / ${view.h}` }}
      role="img"
      aria-labelledby={`${uid}-t`}
    >
      <title id={`${uid}-t`}>{title}</title>
      <defs>
        <linearGradient id={`${uid}-land`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--nh-land)" />
          <stop offset="1" stopColor="var(--nh-land-2)" />
        </linearGradient>
      </defs>
      <path className="nh-coast-glow" d={COAST_PATH} />
      <path className="nh-land" d={COAST_PATH} style={{ fill: `url(#${uid}-land)` }} />
      <path className="nh-rail-glow" d={SKYLINE_PATH} />
      <path className="nh-rail" d={SKYLINE_PATH} />
      {showAllStations &&
        SKYLINE_STATIONS.filter((s) => !pinIds.has(s.id)).map((s) => (
          <circle key={s.id} className="sk-dot" cx={s.x} cy={s.y} r={1.9} />
        ))}
      {pins.map((p) => {
        const s = byId.get(p.id);
        if (!s) return null;
        return (
          <g key={p.id}>
            <circle className="sk-pin-halo" cx={s.x} cy={s.y} r={5.5} />
            <circle className="sk-pin" cx={s.x} cy={s.y} r={3} />
            <text
              className="sk-mark"
              x={s.x + (p.dx ?? 0)}
              y={s.y + (p.dy ?? -7)}
              textAnchor={p.anchor ?? "middle"}
            >
              {p.mark}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
