// Old vs new planner functions, side by side (migrations 0063 and 0064).
//
// Runs every case against the live function and its temporary _v2 copy
// (scripts/db-speed/side-by-side.sql), one query at a time with a pause
// between queries, and checks that both return the same rows in the same
// order. Exit code 1 if any case differs.
//
//   bun scripts/db-speed/compare.mts --psql "host=... dbname=..."   (local rehearsal)
//   SUPABASE_ACCESS_TOKEN=... bun scripts/db-speed/compare.mts --api  (production)
//
// Options: --gap-ms 2000 (pause between queries), --report path.json
import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const args = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const psqlConn = flag("--psql");
const useApi = args.includes("--api");
const gapMs = Number(flag("--gap-ms") ?? 2000);
const reportPath = flag("--report");
const projectRef = process.env.SUPABASE_PROJECT_REF ?? "nsoameosqsnumjivkmyv";
if (!psqlConn && !useApi) {
  console.error("Pass --psql <conninfo> or --api");
  process.exit(2);
}

async function run(sql: string): Promise<{ rows: unknown; ms: number }> {
  if (psqlConn) {
    const out = spawnSync("psql", [psqlConn, "-X", "-At", "-v", "ON_ERROR_STOP=1", "-c", sql], {
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    });
    if (out.status !== 0) throw new Error(out.stderr.trim());
    return JSON.parse(out.stdout.trim());
  }
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!token) throw new Error("SUPABASE_ACCESS_TOKEN is not set");
  const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql }),
  });
  if (!res.ok) throw new Error(`Management API ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const body = (await res.json()) as Array<{ result: { rows: unknown; ms: number } }>;
  return body[0]!.result;
}

// One query: the function's rows in output order, plus server-side time.
const call = (fn: string, argList: string) => `
  SELECT json_build_object(
    'rows', coalesce((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.ordinality) FROM ${fn}(${argList}) WITH ORDINALITY x), '[]'::jsonb),
    'ms', round(extract(epoch FROM clock_timestamp() - statement_timestamp()) * 1000)
  ) AS result`;

const places: Record<string, [number, number]> = {
  Kapolei: [21.335, -158.079],
  "ʻEwa Beach": [21.3156, -158.0072],
  Waipahu: [21.3867, -158.0092],
  "Pearl City": [21.3972, -157.9752],
  Mililani: [21.4513, -158.0153],
  Airport: [21.3245, -157.9251],
  Downtown: [21.3069, -157.8583],
  Kalihi: [21.329, -157.867],
  Waikīkī: [21.2793, -157.8292],
  UH: [21.2969, -157.8171],
  Kāneʻohe: [21.4022, -157.7984],
  "Ala Moana": [21.2911, -157.8433],
  "Hawaiʻi Kai": [21.2925, -157.7036],
  Kailua: [21.3972, -157.7394],
};

// [label, p_after_seconds, p_service_day_offset]
const times: Array<[string, number, number]> = [
  ["7:00 AM", 7 * 3600, 0],
  ["4:30 PM", 16.5 * 3600, 0],
  ["11:00 PM", 23 * 3600, 0],
  ["1:00 AM late night", 3600, -1],
  ["1:00 AM today", 3600, 0],
];

const trips: Array<[string, string]> = [
  ["Kapolei", "Downtown"],
  ["ʻEwa Beach", "Downtown"],
  ["Waipahu", "UH"],
  ["Pearl City", "Waikīkī"],
  ["Mililani", "Downtown"],
  ["Airport", "Waikīkī"],
  ["Kalihi", "Ala Moana"],
  ["Kāneʻohe", "Downtown"],
  ["Downtown", "Kapolei"],
  ["UH", "Pearl City"],
  ["Hawaiʻi Kai", "Downtown"],
  ["Kailua", "Kāneʻohe"],
];

type Case = { kind: string; label: string; oldSql: string; newSql: string };
const cases: Case[] = [];
for (const [name, [lat, lon]] of Object.entries(places)) {
  for (const [t, sec] of [times[0]!, times[1]!, times[2]!]) {
    const a = `${lat}, ${lon}, ${sec}, 2, 5`;
    cases.push({
      kind: "nearby_transit_stops",
      label: `${name} @ ${t}`,
      oldSql: call("public.nearby_transit_stops", a),
      newSql: call("public.nearby_transit_stops_v2", a),
    });
  }
}
for (const [from, to] of trips) {
  const [olat, olon] = places[from]!;
  const [dlat, dlon] = places[to]!;
  for (const [t, sec, offset] of times) {
    // The app's own arguments (1.6 km walk, 6 options) ...
    const app = `${olat}, ${olon}, ${dlat}, ${dlon}, ${sec}, 6, 1600, 1600, 800, ${offset}`;
    cases.push({
      kind: "plan_transit_general",
      label: `${from} → ${to} @ ${t}`,
      oldSql: call("public.plan_transit_general", app),
      newSql: call("public.plan_transit_general_v2", app),
    });
  }
  // ... and the defaults (4 km / 3 km, used by Nalu AI and leave alerts), at 7 AM, 8 options.
  const def = `${olat}, ${olon}, ${dlat}, ${dlon}, ${7 * 3600}, 8`;
  cases.push({
    kind: "plan_transit_general",
    label: `${from} → ${to} @ 7:00 AM (default radii, 8 options)`,
    oldSql: call("public.plan_transit_general", def),
    newSql: call("public.plan_transit_general_v2", def),
  });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const results: Array<{
  kind: string;
  label: string;
  same: boolean;
  rows: number;
  oldMs: number;
  newMs: number;
}> = [];
const diffs: Array<{ label: string; old: unknown; new: unknown }> = [];

for (const [i, c] of cases.entries()) {
  // Alternate which runs first so neither side always gets the warm cache.
  const oldFirst = i % 2 === 0;
  const first = await run(oldFirst ? c.oldSql : c.newSql);
  await sleep(gapMs);
  const second = await run(oldFirst ? c.newSql : c.oldSql);
  await sleep(gapMs);
  const [o, n] = oldFirst ? [first, second] : [second, first];
  const same = JSON.stringify(o.rows) === JSON.stringify(n.rows);
  const rows = Array.isArray(o.rows) ? o.rows.length : -1;
  results.push({ kind: c.kind, label: c.label, same, rows, oldMs: o.ms, newMs: n.ms });
  if (!same) diffs.push({ label: c.label, old: o.rows, new: n.rows });
  console.log(
    `${same ? "same" : "DIFFERENT"}  ${c.kind.padEnd(21)} ${c.label.padEnd(52)} rows=${String(rows).padStart(2)}  old ${String(o.ms).padStart(5)} ms  new ${String(n.ms).padStart(5)} ms`,
  );
}

const summary = (kind: string) => {
  const r = results.filter((x) => x.kind === kind);
  const avg = (k: "oldMs" | "newMs") => Math.round(r.reduce((s, x) => s + x[k], 0) / r.length);
  const max = (k: "oldMs" | "newMs") => Math.max(...r.map((x) => x[k]));
  return `${kind}: ${r.filter((x) => x.same).length}/${r.length} identical; old avg ${avg("oldMs")} ms (max ${max("oldMs")}), new avg ${avg("newMs")} ms (max ${max("newMs")})`;
};
console.log("\n" + summary("nearby_transit_stops"));
console.log(summary("plan_transit_general"));
if (reportPath) writeFileSync(reportPath, JSON.stringify({ results, diffs }, null, 2));
process.exit(diffs.length ? 1 : 0);
