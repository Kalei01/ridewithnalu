// Separate plan_outbound searches vs one plan_outbound_multi search (migration 0065).
//
// For each case it builds the station list exactly as the trip screen does
// (src/lib/rail/outbound-stations.ts), runs plan_outbound once per station and
// the combined function once, and checks that every station gets the same rows
// in the same order. Exit code 1 if any case differs.
//
//   bun scripts/db-speed/compare-outbound.mts --psql "dbname=nalu" --fn plan_outbound_multi   (local)
//   SUPABASE_ACCESS_TOKEN=... bun scripts/db-speed/compare-outbound.mts --api                   (production,
//     against plan_outbound_multi_preview from outbound-multi-side-by-side.sql)
//
// Options: --gap-ms 2000 (pause between queries), --report path.json, --fn name,
//   --extended (90 more cases: Kalihi, UH, Waikīkī at five more times of day)
import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { dropOffCandidates } from "../../src/lib/rail/drop-off.ts";
import { outboundStations } from "../../src/lib/rail/outbound-stations.ts";

const args = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const psqlConn = flag("--psql");
const useApi = args.includes("--api");
const gapMs = Number(flag("--gap-ms") ?? 2000);
const reportPath = flag("--report");
const multiFn = flag("--fn") ?? "plan_outbound_multi_preview";
if (!/^[a-z_]+$/.test(multiFn)) throw new Error("--fn must be a plain function name");
const projectRef = process.env.SUPABASE_PROJECT_REF ?? "nsoameosqsnumjivkmyv";
if (!psqlConn && !useApi) {
  console.error("Pass --psql <conninfo> or --api");
  process.exit(2);
}

async function run<T>(sql: string): Promise<T> {
  if (psqlConn) {
    const out = spawnSync("psql", [psqlConn, "-X", "-At", "-v", "ON_ERROR_STOP=1", "-c", sql], {
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    });
    if (out.status !== 0) throw new Error(out.stderr.trim());
    return JSON.parse(out.stdout.trim()) as T;
  }
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!token) throw new Error("SUPABASE_ACCESS_TOKEN is not set");
  const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql }),
  });
  if (!res.ok) throw new Error(`Management API ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const body = (await res.json()) as Array<{ result: T }>;
  return body[0]!.result;
}

const lit = (s: string) => `'${s.replace(/'/g, "''")}'`;
const timed = (inner: string) => `
  SELECT json_build_object(
    'rows', coalesce((${inner}), '[]'::jsonb),
    'ms', round(extract(epoch FROM clock_timestamp() - statement_timestamp()) * 1000)
  ) AS result`;

// Rider ties (two bus stops with the same departure) follow the old function's
// plan, which depends on these settings; print them with the result.
console.log(
  "database:",
  JSON.stringify(
    await run(
      `SELECT json_build_object('version', current_setting('server_version'), 'random_page_cost', current_setting('random_page_cost')) AS result`,
    ),
  ),
);

type RailStation = { stop_id: string; stop_name: string; stop_lat: number; stop_lon: number };
const stations = await run<RailStation[]>(
  `SELECT coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) AS result FROM public.rail_stations() r`,
);
const lookup = async (sql: string) =>
  (
    await run<Array<{ stop_id: string }> | null>(
      `SELECT jsonb_agg(to_jsonb(x)) AS result FROM (${sql}) x`,
    )
  )?.[0]?.stop_id ?? "";

const origins: Record<string, [number, number]> = {
  Kapolei: [21.335, -158.079],
  "ʻEwa Beach": [21.3156, -158.0072],
  Mililani: [21.4513, -158.0153],
  "Pearl City": [21.3972, -157.9752],
  Waipahu: [21.3867, -158.0092],
  Aiea: [21.3826, -157.9336],
};
const destinations: Record<string, [number, number]> = {
  Downtown: [21.3069, -157.8583],
  "Ala Moana": [21.2911, -157.8433],
};
// [label, p_after_seconds, plan mode]
const cursors: Array<[string, number, "leave-now" | "arrive-by"]> = [
  ["Leave now 7:00 AM", 7 * 3600, "leave-now"],
  ["Leave now 4:30 PM", 16.5 * 3600, "leave-now"],
  ["Leave now 11:00 PM", 23 * 3600, "leave-now"],
  ["Arrive by 8 AM, page 1 (4:00 AM)", 4 * 3600, "arrive-by"],
  ["Arrive by 8 AM, page 2 (6:30 AM)", 6.5 * 3600, "arrive-by"],
  ["Arrive by 5:30 PM, page 1 (1:30 PM)", 13.5 * 3600, "arrive-by"],
];

const extended = args.includes("--extended");
if (extended) {
  Object.assign(destinations, {
    Kalihi: [21.329, -157.867],
    UH: [21.2969, -157.8171],
    Waikīkī: [21.2793, -157.8292],
  });
  for (const h of [5.5, 9, 12, 15, 18])
    cursors.push([`Leave now ${h}h`, Math.round(h * 3600), "leave-now"]);
}
const core = (destName: string, sec: number) =>
  destName === "Downtown"
    ? !extended || sec === 7 * 3600
    : destName === "Ala Moana"
      ? sec === 7 * 3600 && !extended
      : [5.5, 9, 12, 15, 18].some((h) => Math.round(h * 3600) === sec);

type Case = { label: string; separateSql: string; multiSql: string; stations: number };
const cases: Case[] = [];
for (const [destName, [dLat, dLon]] of Object.entries(destinations)) {
  const destStop = await lookup(
    `SELECT stop_id FROM public.directional_dest_stop(${dLat}, ${dLon}, true)`,
  );
  for (const [name, [lat, lon]] of Object.entries(origins)) {
    const home = await lookup(`SELECT stop_id FROM public.nearest_stop(${lat}, ${lon}, true)`);
    // Ala Moana (and the extended set): with a car only, to keep the run short.
    const vehicles = destName === "Downtown" && !extended ? [true, false] : [true];
    for (const vehicle of vehicles) {
      for (const [t, sec, mode] of cursors) {
        if (!core(destName, sec)) continue;
        if (!vehicle && mode === "arrive-by") continue;
        const origin = { lat, lon };
        const dropOffs = vehicle
          ? dropOffCandidates(
              origin,
              { lat: dLat, lon: dLon },
              stations,
              mode === "arrive-by" ? 2 : 3,
            )
          : [];
        const list = outboundStations({
          homeStopId: home,
          vehicle,
          origin,
          browseStations: stations,
          dropOffStations: dropOffs,
        });
        const limit = mode === "arrive-by" ? 8 : 4;
        const st = `ARRAY[${list.map((s) => lit(s.stopId)).join(",")}]::text[]`;
        const dr = `ARRAY[${list.map((s) => s.allowDrive).join(",")}]::boolean[]`;
        const lim = `ARRAY[${list.map(() => limit).join(",")}]::integer[]`;
        const separate = `SELECT jsonb_agg(to_jsonb(x) ORDER BY x.station_index, x.ord) FROM (
            SELECT s.i::int AS station_index, s.st AS station, p.*
            FROM unnest(${st}, ${dr}) WITH ORDINALITY s(st, drv, i)
            CROSS JOIN LATERAL public.plan_outbound(${lat}, ${lon}, s.st, ${lit(destStop)}, s.drv, ${sec}, ${limit},
              NULL, 240, 1207, ${dLat}, ${dLon})
              WITH ORDINALITY p(leave_by_seconds, depart_seconds, arrive_seconds, total_minutes, rail_trip_id, legs, ord)) x`;
        const multi = `SELECT jsonb_agg(to_jsonb(x) ORDER BY x.ord) FROM public.${multiFn}(${lat}, ${lon},
            ${st}, ${dr}, ${lim}, ${lit(destStop)}, ${sec}, NULL, 240, 1207, ${dLat}, ${dLon})
            WITH ORDINALITY x(station_index, station, leave_by_seconds, depart_seconds, arrive_seconds, total_minutes, rail_trip_id, legs, ord)`;
        cases.push({
          label: `${name} → ${destName}, ${vehicle ? "car" : "no car"}, ${t}`,
          separateSql: timed(separate),
          multiSql: timed(multi),
          stations: list.length,
        });
      }
    }
  }
}

// Compare what riders get: per station, the same rows in the same order.
type Row = Record<string, unknown>;
const comparable = (rows: Row[]) =>
  JSON.stringify(
    rows
      .map(({ ord: _ord, ...rest }) => rest)
      .map((r) => Object.fromEntries(Object.entries(r).sort(([a], [b]) => a.localeCompare(b)))),
  );

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const results: Array<{
  label: string;
  same: boolean;
  rows: number;
  stations: number;
  separateMs: number;
  multiMs: number;
}> = [];
const diffs: Array<{ label: string; separate: unknown; multi: unknown }> = [];
for (const [i, c] of cases.entries()) {
  // Alternate which runs first so neither side always gets the warm cache.
  const sepFirst = i % 2 === 0;
  type Answer = { rows: Row[]; ms: number };
  const first = await run<Answer>(sepFirst ? c.separateSql : c.multiSql);
  await sleep(gapMs);
  const second = await run<Answer>(sepFirst ? c.multiSql : c.separateSql);
  await sleep(gapMs);
  const [s, m] = sepFirst ? [first, second] : [second, first];
  const same = comparable(s.rows) === comparable(m.rows);
  results.push({
    label: c.label,
    same,
    rows: s.rows.length,
    stations: c.stations,
    separateMs: s.ms,
    multiMs: m.ms,
  });
  if (!same) diffs.push({ label: c.label, separate: s.rows, multi: m.rows });
  console.log(
    `${same ? "same" : "DIFFERENT"}  ${c.label.padEnd(66)} stations=${c.stations} rows=${String(s.rows.length).padStart(2)}  separate ${String(s.ms).padStart(5)} ms  one call ${String(m.ms).padStart(5)} ms`,
  );
}

const avg = (k: "separateMs" | "multiMs") =>
  Math.round(results.reduce((t, x) => t + x[k], 0) / results.length);
const max = (k: "separateMs" | "multiMs") => Math.max(...results.map((x) => x[k]));
console.log(
  `\nplan_outbound_multi: ${results.filter((x) => x.same).length}/${results.length} identical; ` +
    `separate searches (sum) avg ${avg("separateMs")} ms (max ${max("separateMs")}), one call avg ${avg("multiMs")} ms (max ${max("multiMs")})`,
);
if (reportPath) writeFileSync(reportPath, JSON.stringify({ results, diffs }, null, 2));
process.exit(diffs.length ? 1 : 0);
