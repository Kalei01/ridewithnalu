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

export type SkylineMapLabel = {
  id: string;
  text: string;
  dx?: number;
  dy?: number;
  anchor?: "start" | "middle" | "end";
};

export type SkylineMapView = { x: number; y: number; w: number; h: number };

/** Leeward and south shore, framing the whole line without empty sea. */
export const SKYLINE_LINE_VIEW: SkylineMapView = { x: 198, y: 300, w: 196, h: 100 };

export function SkylineMap({
  pins,
  title,
  view = SKYLINE_LINE_VIEW,
  showAllStations = false,
  labels = [],
  showHarbor = true,
}: {
  pins: SkylineMapPin[];
  /** Accessible name, read by screen readers. */
  title: string;
  view?: SkylineMapView;
  showAllStations?: boolean;
  /** Small muted name tags, like the two ends of the line. */
  labels?: SkylineMapLabel[];
  /** Tint Pearl Harbor as water and name it (on by default; the zoomed crops need it). */
  showHarbor?: boolean;
}) {
  const k = (view.w / 205) * 0.95;
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
        {/* Pearl Harbor is a notch cut into the coast, so its water is "everything
            that is not land" inside this box; the mask keeps the tint off the land. */}
        <mask
          id={`${uid}-harbor-mask`}
          maskUnits="userSpaceOnUse"
          x="238"
          y="318"
          width="92"
          height="76"
        >
          <rect x="238" y="318" width="92" height="76" fill={`url(#${uid}-harbor-fade)`} />
          <path d={COAST_PATH} fill="#000" />
        </mask>
        <linearGradient id={`${uid}-harbor-fade`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" />
          <stop offset="0.75" stopColor="#fff" />
          <stop offset="1" stopColor="#000" />
        </linearGradient>
      </defs>
      <path className="nh-coast-glow" d={COAST_PATH} />
      <path className="nh-land" d={COAST_PATH} style={{ fill: `url(#${uid}-land)` }} />
      {showHarbor && (
        <>
          <rect
            className="sk-harbor"
            x="238"
            y="318"
            width="92"
            height="76"
            mask={`url(#${uid}-harbor-mask)`}
          />
          <text
            className="sk-water"
            style={{ fontSize: 6.2 * k }}
            x="283"
            y="368"
            textAnchor="middle"
          >
            Pearl Harbor
          </text>
        </>
      )}
      <path className="nh-rail-glow" d={SKYLINE_PATH} />
      <path className="nh-rail" d={SKYLINE_PATH} />
      {showAllStations &&
        SKYLINE_STATIONS.filter((s) => !pinIds.has(s.id)).map((s) => (
          <circle key={s.id} className="sk-dot" cx={s.x} cy={s.y} r={1.9 * k} />
        ))}
      {labels.map((l) => {
        const s = byId.get(l.id);
        if (!s) return null;
        return (
          <text
            key={l.id}
            className="sk-label"
            style={{ fontSize: 7.5 * k }}
            x={s.x + (l.dx ?? 0) * k}
            y={s.y + (l.dy ?? 10) * k}
            textAnchor={l.anchor ?? "middle"}
          >
            {l.text}
          </text>
        );
      })}
      {pins.map((p) => {
        const s = byId.get(p.id);
        if (!s) return null;
        return (
          <g key={p.id}>
            <circle className="sk-pin-halo" cx={s.x} cy={s.y} r={5.5 * k} />
            <circle className="sk-pin" cx={s.x} cy={s.y} r={3 * k} />
            <text
              className="sk-mark"
              {...(p.mark.length > 2 ? { style: { fontSize: 6.6 } } : {})}
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
