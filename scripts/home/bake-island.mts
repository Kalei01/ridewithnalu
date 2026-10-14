// Bakes the home page's Oʻahu map from real data (run by hand when the data changes):
//   - coastline: US Census 1:500k outline with Pearl Harbor cut from OpenStreetMap land (see coast-hybrid.mjs)
//   - Skyline line, stations and scheduled run times: TheBus GTFS (route 181, shapes.txt, stops.txt, stop_times.txt)
//   - bus route shapes (for the race demo): TheBus GTFS shapes, one per route + headsign
// Usage: bun scripts/home/bake-island.mts <gtfs-dir> <coast.geo.json from coast-hybrid.mjs>
// Writes src/components/home/island-data.ts and public/data/bus-shapes-v1.json.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { OAHU_VIEW, projectPoint } from "../../src/components/home/island-projection";

const [gtfsDir, landsPath] = process.argv.slice(2);
if (!gtfsDir || !landsPath)
  throw new Error("usage: bun scripts/home/bake-island.mts <gtfs-dir> <lands.geo.json>");

type XY = [number, number];

function csv(name: string): Array<Record<string, string>> {
  const text = readFileSync(`${gtfsDir}/${name}`, "utf8").replace(/^﻿/, "");
  const lines = text.split(/\r?\n/).filter(Boolean);
  const header = lines[0]!.split(",");
  return lines.slice(1).map((line) => {
    const cells = line.split(",");
    return Object.fromEntries(header.map((key, i) => [key, cells[i] ?? ""]));
  });
}

/** Douglas–Peucker on projected points. */
function simplify(points: XY[], tolerance: number): XY[] {
  if (points.length < 3) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack: Array<[number, number]> = [[0, points.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    const [ax, ay] = points[a]!;
    const [bx, by] = points[b]!;
    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.hypot(dx, dy) || 1;
    let worst = -1;
    let worstDistance = 0;
    for (let i = a + 1; i < b; i += 1) {
      const [px, py] = points[i]!;
      const distance = Math.abs(dy * px - dx * py + bx * ay - by * ax) / len;
      if (distance > worstDistance) {
        worstDistance = distance;
        worst = i;
      }
    }
    if (worst > 0 && worstDistance > tolerance) {
      keep[worst] = 1;
      stack.push([a, worst], [worst, b]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

/** A closed ring: simplified as two open halves, split at the point farthest from the first. */
function simplifyRing(points: XY[], tolerance: number): XY[] {
  const open = points.slice(0, -1);
  const [x0, y0] = open[0]!;
  let far = 1;
  for (let i = 1; i < open.length; i += 1)
    if (
      Math.hypot(open[i]![0] - x0, open[i]![1] - y0) >
      Math.hypot(open[far]![0] - x0, open[far]![1] - y0)
    )
      far = i;
  const first = simplify(open.slice(0, far + 1), tolerance);
  const second = simplify([...open.slice(far), open[0]!], tolerance);
  return [...first, ...second.slice(1)];
}

const r1 = (n: number) => Math.round(n * 10) / 10;
const pathOf = (points: XY[], close = false) =>
  points.map(([x, y], i) => `${i ? "L" : "M"}${r1(x)} ${r1(y)}`).join("") + (close ? "Z" : "");

/** A closed ring as gentle cubic curves through its points (Catmull–Rom, softened), so the coast reads as a coast. */
function smoothRing(points: XY[], tension = 0.75): string {
  const n = points.length;
  if (n < 4) return pathOf(points, true);
  const at = (i: number) => points[(i + n) % n]!;
  let d = `M${r1(at(0)[0])} ${r1(at(0)[1])}`;
  for (let i = 0; i < n; i += 1) {
    const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
    const k = tension / 6;
    const c1: XY = [p1[0] + (p2[0] - p0[0]) * k, p1[1] + (p2[1] - p0[1]) * k];
    const c2: XY = [p2[0] - (p3[0] - p1[0]) * k, p2[1] - (p3[1] - p1[1]) * k];
    d += `C${r1(c1[0])} ${r1(c1[1])} ${r1(c2[0])} ${r1(c2[1])} ${r1(p2[0])} ${r1(p2[1])}`;
  }
  return d + "Z";
}

function ringArea(points: XY[]) {
  let area = 0;
  for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1)
    area += (points[j]![0] + points[i]![0]) * (points[j]![1] - points[i]![1]);
  return Math.abs(area / 2);
}

// ---- Coastline -------------------------------------------------------------
const lands = JSON.parse(readFileSync(landsPath, "utf8"));
const geometry =
  lands.type === "FeatureCollection" ? lands.features[0].geometry : lands.geometries[0];
const coastRings: XY[][] = [];
for (const polygon of geometry.coordinates as number[][][][]) {
  // Outer rings only: the few holes are data artifacts (Pearl Harbor itself is open to the sea).
  for (const ring of polygon.slice(0, 1)) {
    if (!ring.every(([lon, lat]) => lon! > -158.4 && lon! < -157.5 && lat! > 21.1 && lat! < 21.8))
      continue;
    const projected = ring.map(([lon, lat]) => projectPoint(lat!, lon!));
    if (ringArea(projected) < 2) continue; // islets smaller than ~0.02 km²
    coastRings.push(simplifyRing(projected, 0.35));
  }
}
coastRings.sort((a, b) => ringArea(b) - ringArea(a));
const coastPath = coastRings.map((ring) => smoothRing(ring)).join("");

// ---- GTFS --------------------------------------------------------------------
const routes = new Map(csv("routes.txt").map((r) => [r.route_id!, r]));
const trips = csv("trips.txt");
const stops = new Map(csv("stops.txt").map((s) => [s.stop_id!, s]));
const shapes = new Map<string, Array<{ seq: number; lat: number; lon: number }>>();
for (const row of csv("shapes.txt")) {
  let list = shapes.get(row.shape_id!);
  if (!list) shapes.set(row.shape_id!, (list = []));
  list.push({
    seq: Number(row.shape_pt_sequence),
    lat: Number(row.shape_pt_lat),
    lon: Number(row.shape_pt_lon),
  });
}
const shapeXY = (id: string): XY[] =>
  (shapes.get(id) ?? []).sort((a, b) => a.seq - b.seq).map((p) => projectPoint(p.lat, p.lon));

// Skyline: the full-line eastbound shape (most trips) and its stations in line order.
const SKYLINE_ROUTE = "181";
const skylineTrips = trips.filter((t) => t.route_id === SKYLINE_ROUTE);
const count = <T,>(values: T[]) => {
  const tally = new Map<T, number>();
  for (const v of values) tally.set(v, (tally.get(v) ?? 0) + 1);
  return [...tally.entries()].sort((a, b) => b[1] - a[1]);
};
const eastShape = count(
  skylineTrips.filter((t) => t.direction_id === "1").map((t) => t.shape_id!),
)[0]![0];
const lineRaw = shapeXY(eastShape);
const line = simplify(lineRaw, 0.25);

// Scheduled run times from the first stop, per direction: the most common pattern.
const skylineTripIds = new Set(skylineTrips.map((t) => t.trip_id!));
const tripDirection = new Map(skylineTrips.map((t) => [t.trip_id!, t.direction_id!]));
const times = new Map<string, Array<{ seq: number; stop: string; arr: number; dep: number }>>();
const seconds = (value: string) => {
  const [h, m, s] = value.split(":").map(Number);
  return h! * 3600 + m! * 60 + s!;
};
for (const row of csv("stop_times.txt")) {
  if (!skylineTripIds.has(row.trip_id!)) continue;
  let list = times.get(row.trip_id!);
  if (!list) times.set(row.trip_id!, (list = []));
  list.push({
    seq: Number(row.stop_sequence),
    stop: row.stop_id!,
    arr: seconds(row.arrival_time!),
    dep: seconds(row.departure_time!),
  });
}
const patterns: Record<string, Array<{ stop: string; arr: number; dep: number }>> = {};
for (const direction of ["0", "1"]) {
  const keyed = count(
    [...times.entries()]
      .filter(([id]) => tripDirection.get(id) === direction)
      .map(([, rows]) => {
        rows.sort((a, b) => a.seq - b.seq);
        const t0 = rows[0]!.dep;
        return JSON.stringify(
          rows.map((r) => ({ stop: r.stop, arr: r.arr - t0, dep: r.dep - t0 })),
        );
      }),
  );
  patterns[direction] = JSON.parse(keyed[0]![0]);
}
const eastPattern = patterns["1"]!; // East Kapolei → Kalihi Transit Center

// Distance along the drawn line for each station (nearest vertex of the simplified line).
const cumulative: number[] = [0];
for (let i = 1; i < line.length; i += 1)
  cumulative.push(
    cumulative[i - 1]! + Math.hypot(line[i]![0] - line[i - 1]![0], line[i]![1] - line[i - 1]![1]),
  );
function along([x, y]: XY): number {
  let best = Infinity;
  let at = 0;
  for (let i = 1; i < line.length; i += 1) {
    const [ax, ay] = line[i - 1]!;
    const [bx, by] = line[i]!;
    const dx = bx - ax;
    const dy = by - ay;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
    const d = Math.hypot(ax + dx * t - x, ay + dy * t - y);
    if (d < best) {
      best = d;
      at = cumulative[i - 1]! + Math.hypot(dx, dy) * t;
    }
  }
  return at;
}
const stations = eastPattern.map((row, index) => {
  const stop = stops.get(row.stop)!;
  const xy = projectPoint(Number(stop.stop_lat), Number(stop.stop_lon));
  const west = patterns["0"]!.find((r) => r.stop === row.stop)!;
  const westEnd = patterns["0"]!.at(-1)!.dep;
  return {
    id: row.stop,
    x: r1(xy[0]),
    y: r1(xy[1]),
    along: r1(along(xy)),
    // Seconds after leaving East Kapolei (eastbound) / Kalihi TC (westbound), as scheduled.
    east: [row.arr, row.dep],
    west: [west.arr, west.dep],
    order: index + 1,
    westEnd,
  };
});

// ---- Bus shapes (race demo) --------------------------------------------------
const busShapes: Record<string, string> = {};
const byRouteHeadsign = new Map<string, string[]>();
for (const trip of trips) {
  const route = routes.get(trip.route_id!);
  if (!route || route.route_type !== "3") continue;
  const key = `${route.route_short_name!.trim().toUpperCase()}|${trip.trip_headsign!.trim().toUpperCase()}`;
  let list = byRouteHeadsign.get(key);
  if (!list) byRouteHeadsign.set(key, (list = []));
  list.push(trip.shape_id!);
}
for (const [key, shapeIds] of byRouteHeadsign) {
  const shapeId = count(shapeIds)[0]![0];
  const points = simplify(shapeXY(shapeId), 0.4);
  busShapes[key] = points.map(([x, y]) => `${r1(x)},${r1(y)}`).join(" ");
}

// ---- Write -------------------------------------------------------------------
const feed = csv("feed_info.txt")[0] ?? {};
const header = `// Generated by scripts/home/bake-island.mts — do not edit by hand.
// Coastline: US Census Bureau cartographic boundary (1:500k, 2019); Pearl Harbor © OpenStreetMap contributors (ODbL).
// Skyline line, stations and run times: TheBus GTFS ${feed.feed_version ?? ""} (${feed.feed_start_date ?? ""}–${feed.feed_end_date ?? ""}).
`;
const body = `${header}
/** Oʻahu's coastline (main island, Ford Island and islets), in OAHU_VIEW coordinates. */
export const COAST_PATH = ${JSON.stringify(coastPath)};

/** The Skyline guideway, East Kapolei → Kalihi Transit Center (GTFS shape ${eastShape}). */
export const SKYLINE_PATH = ${JSON.stringify(pathOf(line))};
/** Length of SKYLINE_PATH in view units. */
export const SKYLINE_LENGTH = ${r1(cumulative.at(-1)!)};

export type IslandStation = {
  /** GTFS stop_id (see the station table in docs/product/direction.md). */
  id: string;
  x: number;
  y: number;
  /** Distance along SKYLINE_PATH. */
  along: number;
  /** Scheduled [arrive, depart] seconds after the train leaves East Kapolei (eastbound). */
  east: [number, number];
  /** Scheduled [arrive, depart] seconds after the train leaves Kalihi Transit Center (westbound). */
  west: [number, number];
};

/** Skyline stations in line order, west end first. */
export const SKYLINE_STATIONS: IslandStation[] = ${JSON.stringify(
  stations.map(({ id, x, y, along: a, east, west }) => ({ id, x, y, along: a, east, west })),
)};

/** Scheduled minutes end to end, as the timetable gives them. */
export const SKYLINE_RUN_SECONDS = { east: ${eastPattern.at(-1)!.arr}, west: ${patterns["0"]!.at(-1)!.arr} };
`;
writeFileSync("src/components/home/island-data.ts", body);
mkdirSync("public/data", { recursive: true });
writeFileSync("public/data/bus-shapes-v1.json", JSON.stringify(busShapes));
console.log(
  `coast ${coastRings.length} rings / ${coastRings.reduce((n, r) => n + r.length, 0)} pts; line ${line.length} pts; stations ${stations.length}; bus shapes ${Object.keys(busShapes).length}`,
);
