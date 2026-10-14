import { useEffect, useMemo, useRef, useState } from "react";
import { Flag, RotateCcw } from "lucide-react";
import { clockFromSeconds } from "@/lib/commute-formatting";
import { formatDriveMinutes } from "@/lib/drive/traffic-summary";
import { prefersReducedMotion } from "@/lib/motion";
import { skylineEmptyText } from "@/lib/trip-choices";
import { featuredTraffic, trainPositions, type TrainPosition } from "@/lib/home/home-now";
import { raceProgress, raceSegments, raceSpan, type RaceSegment } from "@/lib/home/race-timeline";
import type { HomeRace, HomeRaceEntrant } from "@/lib/home/home-types";
import { COAST_PATH, SKYLINE_LENGTH, SKYLINE_PATH, SKYLINE_STATIONS } from "./island-data";
import { OAHU_VIEW, projectPoint } from "./island-projection";
import { honoluluNowSeconds, useHomeLive, useHomeRace } from "./use-home-live";

type XY = [number, number];
type View = [number, number, number, number];

const FULL_VIEW: View = [0, 0, OAHU_VIEW.width, OAHU_VIEW.height];
/** The south shore, Kapolei to Waikīkī: where the race happens (same shape as the full view). */
const RACE_VIEW: View = [165, 255, 260, 206];
/** The whole real trip plays in this long. */
const RACE_MS = 8_000;

const PLACES: Array<{
  name: string;
  lat: number;
  lon: number;
  big?: boolean;
  anchor?: "start" | "middle" | "end";
}> = [
  { name: "Kapolei", lat: 21.352, lon: -158.09, anchor: "end" },
  { name: "Honolulu", lat: 21.292, lon: -157.862, big: true, anchor: "start" },
  { name: "Kāneʻohe", lat: 21.418, lon: -157.815, anchor: "end" },
  { name: "North Shore", lat: 21.6, lon: -158.03, anchor: "middle" },
];

const project = ([lat, lon]: [number, number]): XY => projectPoint(lat, lon);
const pointsAttr = (points: XY[]) =>
  points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");

/** A polyline with lengths, for "how far along" lookups. */
type Track = { points: XY[]; lengths: number[]; total: number; hop: boolean };
function track(points: XY[], hop = false): Track {
  const lengths = [0];
  for (let i = 1; i < points.length; i += 1)
    lengths.push(
      lengths[i - 1]! +
        Math.hypot(points[i]![0] - points[i - 1]![0], points[i]![1] - points[i - 1]![1]),
    );
  return { points, lengths, total: lengths.at(-1) ?? 0, hop };
}
function pointOn(t: Track, fraction: number): XY {
  if (t.points.length < 2) return t.points[0] ?? [0, 0];
  const target = t.total * Math.min(1, Math.max(0, fraction));
  let i = 1;
  while (i < t.lengths.length - 1 && t.lengths[i]! < target) i += 1;
  const a = t.points[i - 1]!;
  const b = t.points[i]!;
  const span = t.lengths[i]! - t.lengths[i - 1]! || 1;
  const k = (target - t.lengths[i - 1]!) / span;
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
}

/** Points along the drawn Skyline line between two distances (either direction). */
function railBetween(path: SVGPathElement | null, fromAlong: number, toAlong: number): XY[] {
  if (!path) return [];
  const scale = path.getTotalLength() / SKYLINE_LENGTH;
  const out: XY[] = [];
  for (let i = 0; i <= 24; i += 1) {
    const at = (fromAlong + ((toAlong - fromAlong) * i) / 24) * scale;
    const p = path.getPointAtLength(at);
    out.push([p.x, p.y]);
  }
  return out;
}

type BusShapes = Record<string, string>;
let busShapesRequest: Promise<BusShapes> | null = null;
/** TheBus route shapes (baked from GTFS), loaded only when a race needs them. */
function loadBusShapes(): Promise<BusShapes> {
  busShapesRequest ??= fetch("/data/bus-shapes-v1.json")
    .then((r) => (r.ok ? (r.json() as Promise<BusShapes>) : {}))
    .catch(() => ({}));
  return busShapesRequest;
}

function nearestIndex(points: XY[], [x, y]: XY) {
  let best = 0;
  let distance = Infinity;
  points.forEach(([px, py], i) => {
    const d = Math.hypot(px - x, py - y);
    if (d < distance) {
      distance = d;
      best = i;
    }
  });
  return { index: best, distance };
}

/** The real route of a bus leg between its two stops, or null when its shape isn't known. */
function busBetween(
  shapes: BusShapes,
  route: string | null,
  headsign: string | null,
  from: XY,
  to: XY,
): XY[] | null {
  const raw =
    route && headsign
      ? shapes[`${route.trim().toUpperCase()}|${headsign.trim().toUpperCase()}`]
      : undefined;
  if (!raw) return null;
  const points = raw.split(" ").map((pair) => pair.split(",").map(Number) as XY);
  const a = nearestIndex(points, from);
  const b = nearestIndex(points, to);
  // Stops more than ~400 m off the shape, or in the wrong order: not this shape.
  if (a.distance > 4 || b.distance > 4 || b.index <= a.index) return null;
  return [from, ...points.slice(a.index + 1, b.index), to];
}

type Entrant = {
  entrant: HomeRaceEntrant;
  segments: RaceSegment[];
  tracks: Track[];
  hops: Track[];
};

const stationById = new Map(SKYLINE_STATIONS.map((s) => [s.id, s]));

function buildEntrants(race: HomeRace, rail: SVGPathElement | null, shapes: BusShapes): Entrant[] {
  const start = projectPoint(race.from.lat, race.from.lon);
  const end = projectPoint(race.to.lat, race.to.lon);
  return race.entrants.map((entrant) => {
    const segments = raceSegments(entrant);
    if (entrant.kind === "drive") {
      const road = race.drivePath?.length ? race.drivePath.map(project) : [start, end];
      return { entrant, segments, tracks: [track(road)], hops: [] };
    }
    const at = (p: { lat: number | null; lon: number | null }, fallback: XY): XY =>
      p.lat !== null && p.lon !== null ? projectPoint(p.lat, p.lon) : fallback;
    const tracks: Track[] = [];
    const hops: Track[] = [];
    entrant.legs.forEach((leg, index) => {
      const from = at(leg.from, index === 0 ? start : end);
      const to = at(leg.to, index === entrant.legs.length - 1 ? end : start);
      if (leg.mode === "walk") {
        hops.push(track([from, to], true));
        return;
      }
      if (!segments.some((s) => s.legIndex === index)) return;
      let points: XY[] | null = null;
      if (leg.mode === "rail") {
        const a = leg.from.stopId ? stationById.get(leg.from.stopId) : undefined;
        const b = leg.to.stopId ? stationById.get(leg.to.stopId) : undefined;
        if (a && b) points = railBetween(rail, a.along, b.along);
      } else if (leg.mode === "bus") {
        points = busBetween(shapes, leg.route, leg.headsign, from, to);
      }
      const known = points && points.length > 1;
      tracks.push(track(known ? points! : [from, to], !known && leg.mode !== "drive"));
    });
    return { entrant, segments, tracks, hops };
  });
}

const LABEL: Record<HomeRaceEntrant["kind"], string> = {
  drive: "Car",
  skyline: "Skyline",
  bus: "Bus",
};
const STROKE: Record<HomeRaceEntrant["kind"], string> = {
  drive: "var(--nh-car)",
  skyline: "var(--nh-rail)",
  bus: "var(--nh-bus)",
};

function lerpView(a: View, b: View, k: number): View {
  return a.map((v, i) => v + (b[i]! - v) * k) as View;
}

/** Glides the map's view between the whole island and the race (instant under reduced motion). */
function useView(target: View) {
  const [view, setView] = useState<View>(target);
  const current = useRef(view);
  useEffect(() => {
    const from = current.current;
    if (prefersReducedMotion()) {
      current.current = target;
      setView(target);
      return;
    }
    let frame = 0;
    const started = performance.now();
    const step = (time: number) => {
      const k = Math.min(1, (time - started) / 900);
      const eased = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
      const next = lerpView(from, target, eased);
      current.current = next;
      setView(next);
      if (k < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target.join(",")]);
  return view;
}

/** Train positions as scheduled, every second (every 30 s, without gliding, under reduced motion). */
function useTrains(): { trains: TrainPosition[]; ready: boolean } {
  const { data } = useHomeLive();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(
      () => setNow(Date.now()),
      prefersReducedMotion() ? 30_000 : 1_000,
    );
    return () => window.clearInterval(timer);
  }, []);
  const trains = useMemo(
    () =>
      data?.skyline
        ? trainPositions(data.skyline, SKYLINE_STATIONS, honoluluNowSeconds(data, now))
        : [],
    [data, now],
  );
  return { trains, ready: Boolean(data?.skyline) };
}

function minutesAgo(fromMs: number) {
  const minutes = Math.floor((Date.now() - fromMs) / 60_000);
  return minutes < 1 ? "checked just now" : `checked ${minutes} min ago`;
}

function checkedLabel(race: HomeRace) {
  const when = new Date(race.checkedAt);
  const day = when.toLocaleDateString("en-US", {
    timeZone: "Pacific/Honolulu",
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  return `${day} at ${clockFromSeconds(race.checkedSeconds)}`;
}

/**
 * The live island: Oʻahu from real coastline data, Skyline trains where the
 * timetable puts them, H-1 tinted by one live traffic check, and the race
 * demo. Loaded only when it scrolls near; static under reduced motion.
 */
export default function LiveIsland() {
  const { data: live } = useHomeLive();
  const { trains, ready: trainsReady } = useTrains();
  const { data: race, isError: raceFailed, isLoading: raceLoading } = useHomeRace(true);
  const railRef = useRef<SVGPathElement | null>(null);
  const [railReady, setRailReady] = useState(false);
  useEffect(() => setRailReady(Boolean(railRef.current)), []);

  const traffic = live ? featuredTraffic(live, honoluluNowSeconds(live)) : null;
  const road = useMemo(() => (traffic ? traffic.path.map(project) : []), [traffic]);
  const slow = useMemo(
    () =>
      traffic
        ? traffic.sections.map((s) => ({ severity: s.severity, points: s.path.map(project) }))
        : [],
    [traffic],
  );
  const onH1 = traffic?.corridor ? /\bH-1\b/.test(traffic.corridor) : false;

  // ---- Race state ----
  const [phase, setPhase] = useState<"idle" | "waiting" | "running" | "done">("idle");
  const [shapes, setShapes] = useState<BusShapes | null>(null);
  const [clock, setClock] = useState(0);
  const entrants = useMemo(
    () => (race && shapes && railReady ? buildEntrants(race, railRef.current, shapes) : []),
    [race, shapes, railReady],
  );
  const span = race ? raceSpan(race.entrants, race.checkedSeconds) : null;

  const startRace = () => {
    setPhase("waiting");
    void loadBusShapes().then(setShapes);
  };
  useEffect(() => {
    if (phase === "waiting" && !race && raceFailed) setPhase("idle");
  }, [phase, race, raceFailed]);
  useEffect(() => {
    if (phase !== "waiting" || !race || !shapes || !span) return;
    if (prefersReducedMotion()) {
      setClock(span.end);
      setPhase("done");
      return;
    }
    setClock(span.start);
    setPhase("running");
  }, [phase, race, shapes, span]);
  useEffect(() => {
    if (phase !== "running" || !span) return;
    let frame = 0;
    const started = performance.now() + 700; // let the map glide in first
    const step = (time: number) => {
      const k = Math.min(1, Math.max(0, (time - started) / RACE_MS));
      setClock(span.start + (span.end - span.start) * k);
      if (k < 1) frame = requestAnimationFrame(step);
      else setPhase("done");
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, span?.start, span?.end]);

  const racing = phase === "running" || phase === "done";
  const view = useView(racing ? RACE_VIEW : FULL_VIEW);
  const zoom = OAHU_VIEW.width / view[2];
  // Keep labels and markers the same size on screen when the view zooms in.
  const size = (units: number) => units / zoom;

  const markers = racing
    ? entrants.map((e) => {
        const progress = raceProgress(e.segments, clock);
        const t = e.tracks[Math.min(progress.segment, e.tracks.length - 1)];
        return {
          kind: e.entrant.kind,
          at: t ? pointOn(t, progress.fraction) : null,
          finished: progress.finished,
        };
      })
    : [];
  // Closed for the night: the timetable was read and no train leaves either end later tonight.
  const liveSeconds = live ? honoluluNowSeconds(live) : 0;
  const skylineClosed = Boolean(
    live?.skyline &&
    liveSeconds >= 20 * 3600 &&
    !live.skyline.eastbound.some((t) => t.departSeconds >= liveSeconds) &&
    !live.skyline.westbound.some((t) => t.departSeconds >= liveSeconds),
  );
  const ordered = race ? [...race.entrants].sort((a, b) => a.finishSeconds - b.finishSeconds) : [];
  const finishXY = race ? projectPoint(race.to.lat, race.to.lon) : null;
  const startXY = race ? projectPoint(race.from.lat, race.from.lon) : null;

  return (
    <div>
      <div className="nh-island-card">
        <svg
          className="nh-island"
          viewBox={view.map((v) => v.toFixed(2)).join(" ")}
          role="img"
          aria-label={
            racing && race
              ? `Map of the race from Kapolei to downtown Honolulu: ${ordered.map((e) => `${LABEL[e.kind]} ${clockFromSeconds(e.finishSeconds)}`).join(", ")}.`
              : `Map of Oʻahu with the Skyline line${trainsReady ? ` and ${trains.length} train${trains.length === 1 ? "" : "s"} on it as scheduled` : ""}${traffic ? ", and live traffic between Kapolei and town" : ""}.`
          }
        >
          <defs>
            <linearGradient id="nh-land-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="var(--nh-land)" />
              <stop offset="1" stopColor="var(--nh-land-2)" />
            </linearGradient>
          </defs>
          <path className="nh-coast-glow" d={COAST_PATH} />
          <path className="nh-land" d={COAST_PATH} />
          {PLACES.map((place) => {
            const [x, y] = projectPoint(place.lat, place.lon);
            return (
              <text
                key={place.name}
                x={x}
                y={y}
                textAnchor={place.anchor ?? "middle"}
                className={place.big ? "nh-place nh-place--big" : "nh-place"}
                style={{ fontSize: size(place.big ? 19 : 17) }}
              >
                {place.name}
              </text>
            );
          })}

          {road.length > 1 && (
            <g aria-hidden="true">
              <polyline
                className="nh-road"
                points={pointsAttr(road)}
                style={{ strokeWidth: size(2.4) }}
              />
              {slow.map((section, i) => (
                <polyline
                  key={i}
                  className={section.severity === "heavy" ? "nh-heavy" : "nh-slow"}
                  points={pointsAttr(section.points)}
                  style={{ strokeWidth: size(3.6) }}
                />
              ))}
            </g>
          )}

          <path className="nh-rail-glow" d={SKYLINE_PATH} style={{ strokeWidth: size(8) }} />
          <path
            ref={railRef}
            className="nh-rail"
            d={SKYLINE_PATH}
            style={{ strokeWidth: size(2.8) }}
          />
          {SKYLINE_STATIONS.map((s) => (
            <circle
              key={s.id}
              className="nh-station"
              cx={s.x}
              cy={s.y}
              r={size(2.6)}
              style={{ strokeWidth: size(1.4) }}
            />
          ))}

          {!racing &&
            railReady &&
            trains.map((train) => {
              const place = trainPlace(railRef.current, train);
              if (!place) return null;
              return (
                <rect
                  key={train.key}
                  className="nh-train nh-moving"
                  x={-5}
                  y={-2.4}
                  width={10}
                  height={4.8}
                  rx={2.4}
                  style={{
                    transform: `translate(${place.x}px, ${place.y}px) rotate(${place.angle}deg)`,
                  }}
                />
              );
            })}

          {racing && (
            <g>
              {entrants.map((e) =>
                [...e.hops, ...e.tracks].map((t, i) => (
                  <polyline
                    key={`${e.entrant.kind}-${i}-${t.hop}`}
                    className={t.hop ? "nh-track nh-track--hop" : "nh-track"}
                    points={pointsAttr(t.points)}
                    stroke={STROKE[e.entrant.kind]}
                    style={{ strokeWidth: size(t.hop ? 1.6 : 2.6) }}
                  />
                )),
              )}
              {startXY && (
                <circle
                  className="nh-end"
                  cx={startXY[0]}
                  cy={startXY[1]}
                  r={size(4)}
                  style={{ strokeWidth: size(2) }}
                />
              )}
              {finishXY && (
                <circle
                  className="nh-end"
                  cx={finishXY[0]}
                  cy={finishXY[1]}
                  r={size(4.5)}
                  style={{ strokeWidth: size(2) }}
                />
              )}
              {markers.map(
                (m) =>
                  m.at && (
                    <circle
                      key={m.kind}
                      className={`nh-marker nh-marker--${m.kind}`}
                      cx={m.at[0]}
                      cy={m.at[1]}
                      r={size(5.5)}
                      style={{ strokeWidth: size(1.6) }}
                    />
                  ),
              )}
            </g>
          )}
        </svg>
      </div>

      <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-2">
          <span
            aria-hidden="true"
            className="inline-block h-2 w-4 rounded-full bg-[var(--nh-rail)]"
          />
          {trainsReady
            ? `Skyline trains, as scheduled${trains.length ? "" : " (none on the line now)"}`
            : "Skyline line"}
        </span>
        {traffic && (
          <span className="inline-flex items-center gap-2">
            <span aria-hidden="true" className="inline-block h-1 w-4 rounded-full bg-white/30" />
            {onH1 ? "Drive via H-1" : "Kapolei ↔ town drive"}, live traffic{" "}
            {minutesAgo(traffic.fetchedAt)}
          </span>
        )}
        {traffic && slow.length > 0 && (
          <span className="inline-flex items-center gap-2">
            <span
              aria-hidden="true"
              className="inline-block h-1 w-4 rounded-full bg-[var(--nh-slow)]"
            />
            Slow stretches
          </span>
        )}
      </p>

      <p className="mt-1 text-xs text-muted-foreground/80">
        Map: US Census Bureau, © OpenStreetMap contributors. Timetable: TheBus. Traffic: TomTom.
      </p>

      <div className="mt-5 nh-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold">
              {race?.lastKnown ? "Kapolei → town" : "Kapolei → town, right now"}
            </h3>
            <p className="text-sm text-muted-foreground">
              {race?.lastKnown
                ? `Car, Skyline and the bus, last checked ${checkedLabel(race)}.`
                : "Car, Skyline and the bus, at today’s real times."}
            </p>
          </div>
          <button
            type="button"
            onClick={startRace}
            disabled={
              phase === "waiting" || phase === "running" || (!race && (raceLoading || raceFailed))
            }
            className="liquid-primary-action inline-flex min-h-12 items-center gap-2 rounded-2xl px-5 text-base font-bold disabled:opacity-60"
          >
            {phase === "done" ? (
              <RotateCcw aria-hidden="true" className="size-5" />
            ) : (
              <Flag aria-hidden="true" className="size-5" />
            )}
            {phase === "done" ? "Race again" : phase === "idle" ? "Race it" : "Racing…"}
          </button>
        </div>

        {!race && raceLoading && (
          <p className="mt-3 text-sm text-muted-foreground" aria-live="polite">
            Checking today’s times…
          </p>
        )}
        {!race && raceFailed && (
          <p className="mt-3 text-sm text-muted-foreground">
            Live times for this trip aren’t available right now. Your own trip still gets checked:
            tap Where to?
          </p>
        )}

        {race && racing && (
          <>
            <ol className="mt-4 grid gap-2" aria-live="polite">
              {ordered.map((entrant) => {
                const done = clock >= entrant.finishSeconds || phase === "done";
                return (
                  <li
                    key={entrant.kind}
                    className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 rounded-2xl border border-white/10 bg-black/20 p-3"
                  >
                    <span
                      aria-hidden="true"
                      className="size-3 rounded-full"
                      style={{ background: STROKE[entrant.kind] }}
                    />
                    <span className="min-w-0">
                      <span className="block font-bold">{LABEL[entrant.kind]}</span>
                      <span className="block text-sm leading-5 text-muted-foreground">
                        {entrant.steps}
                      </span>
                    </span>
                    <span className="text-right tabular-nums">
                      {done ? (
                        <>
                          <span className="block font-bold">
                            {clockFromSeconds(entrant.finishSeconds)}
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            {formatDriveMinutes((entrant.finishSeconds - race.checkedSeconds) / 60)}
                            {entrant.kind === "drive" ? ", door to door" : ", at its last stop"}
                          </span>
                        </>
                      ) : (
                        <span className="text-sm text-muted-foreground">on the way</span>
                      )}
                    </span>
                  </li>
                );
              })}
            </ol>
            <p className="mt-3 text-xs leading-5 text-muted-foreground">
              Car: live traffic, door to door, parking not included. Skyline and bus: when the train
              or bus is scheduled to reach its stop; walking isn’t included.{" "}
              {race.lastKnown
                ? `Last checked ${checkedLabel(race)}; live times aren’t available right now.`
                : `Checked ${clockFromSeconds(race.checkedSeconds)} today.`}
              {!race.entrants.some((e) => e.kind === "skyline") &&
                ` ${skylineEmptyText({
                  failed: race.skylineUnchecked,
                  closedForEvening: skylineClosed,
                  notRunningYet: false,
                  lastTrain: null,
                  firstTrain: null,
                })}.`}
            </p>
          </>
        )}
      </div>
    </div>
  );
}

/** Where a train sits on the drawn line, nudged to its side of the guideway, and which way it faces. */
function trainPlace(path: SVGPathElement | null, train: TrainPosition) {
  if (!path) return null;
  const scale = path.getTotalLength() / SKYLINE_LENGTH;
  const at = Math.min(SKYLINE_LENGTH, Math.max(0, train.along)) * scale;
  const a = path.getPointAtLength(Math.max(0, at - 1));
  const b = path.getPointAtLength(Math.min(path.getTotalLength(), at + 1));
  const p = path.getPointAtLength(at);
  const angle = Math.atan2(b.y - a.y, b.x - a.x);
  const side = train.direction === "eastbound" ? 2.6 : -2.6;
  return {
    x: p.x - Math.sin(angle) * side,
    y: p.y + Math.cos(angle) * side,
    angle: (angle * 180) / Math.PI,
  };
}
