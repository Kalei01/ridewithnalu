/**
 * Weekly cost and limit guard (proposal P-3). Read-only. Prints one line per
 * service: usage, the plan limit, % used and OK / WATCH (>= 70%) / ALERT (>= 90%
 * or an unusual jump). Never prints secret values; only reports which
 * environment variable NAMES are missing.
 *
 *   bun scripts/usage-check.mts
 *
 * Uses: SUPABASE_ACCESS_TOKEN (database size, API requests, accounts, push
 * counts). Optional, for fuller coverage: CLOUDFLARE_API_TOKEN +
 * CLOUDFLARE_ACCOUNT_ID (Workers requests). Limits below are the documented
 * free-plan numbers; set NALU_PLAN_SUPABASE=pro (etc.) if Nalu is on a paid plan.
 * Sources are listed in docs/maintenance/service-limits.md.
 */
const REF = "nsoameosqsnumjivkmyv";
const WATCH = 0.7;
const ALERT = 0.9;

type Row = { service: string; metric: string; used: number | null; limit: number | null; note: string };
const rows: Row[] = [];
const missing: string[] = [];

async function sql<T>(query: string): Promise<T[] | null> {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!token) {
    missing.push("SUPABASE_ACCESS_TOKEN");
    return null;
  }
  const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query/read-only`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  return res.ok ? ((await res.json()) as T[]) : null;
}

async function supabaseApi(endpoint: string, interval: string) {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!token) return null;
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${REF}/analytics/endpoints/${endpoint}?interval=${interval}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  return res.ok ? ((await res.json()) as { result?: Record<string, number | string>[] }) : null;
}

const pro = process.env.NALU_PLAN_SUPABASE === "pro";

// Supabase: database size (free 500 MB, Pro 8 GB), accounts (free/Pro MAU 50k/100k).
const db = await sql<{ bytes: number; users: number; pushes: number }>(
  "select pg_database_size(current_database())::bigint as bytes, (select count(*) from auth.users)::int as users, (select count(*) from push_deliveries)::int as pushes",
);
if (db?.[0]) {
  rows.push({ service: "Supabase", metric: "database size (MB)", used: Math.round(Number(db[0].bytes) / 1048576), limit: pro ? 8192 : 500, note: "free 500 MB / Pro 8 GB" });
  rows.push({ service: "Supabase", metric: "accounts (monthly active users)", used: Number(db[0].users), limit: pro ? 100000 : 50000, note: "accounts is an upper bound for MAU" });
  rows.push({ service: "Firebase messaging", metric: "push sends kept (last 7 days)", used: Number(db[0].pushes), limit: null, note: "Nalu's own count; no per-message charge documented, quota unknown" });
} else rows.push({ service: "Supabase", metric: "database", used: null, limit: null, note: "could not read (token missing or refused)" });

// Supabase API requests: compare the latest day with the average of the days before it.
const api = await supabaseApi("usage.api-counts", "7day");
const days = api?.result ?? [];
if (days.length >= 3) {
  const totals = days.map((d) => Number(d.total_rest_requests ?? 0) + Number(d.total_auth_requests ?? 0) + Number(d.total_storage_requests ?? 0) + Number(d.total_realtime_requests ?? 0));
  const latestComplete = totals[totals.length - 2] ?? 0; // last row is the day in progress
  const before = totals.slice(0, -2);
  const avg = before.reduce((a, b) => a + b, 0) / Math.max(before.length, 1);
  rows.push({ service: "Supabase", metric: "API requests, last full day", used: latestComplete, limit: null, note: `previous average ${Math.round(avg)}/day${avg > 0 && latestComplete >= 1000 && latestComplete > avg * 2 ? " — JUMP (over 2x)" : ""}` });
  rows.push({ service: "Supabase", metric: "API requests, last 7 days", used: totals.reduce((a, b) => a + b, 0), limit: null, note: "Supabase does not cap request counts on the plans; egress is the cap (see below)" });
}
rows.push({ service: "Supabase", metric: "egress (GB / month)", used: null, limit: pro ? 250 : 5, note: "not exposed by the read-only token; check Dashboard > Settings > Usage" });

// Cloudflare Workers requests (optional token).
const cfToken = process.env.CLOUDFLARE_API_TOKEN;
const cfAccount = process.env.CLOUDFLARE_ACCOUNT_ID;
if (cfToken && cfAccount) {
  const since = new Date(Date.now() - 7 * 86400_000).toISOString();
  const until = new Date().toISOString();
  const res = await fetch("https://api.cloudflare.com/client/v4/graphql", {
    method: "POST",
    headers: { Authorization: `Bearer ${cfToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      query: `query($a:String!,$s:Time!,$u:Time!){viewer{accounts(filter:{accountTag:$a}){workersInvocationsAdaptive(limit:1000,filter:{datetime_geq:$s,datetime_leq:$u}){sum{requests}dimensions{datetimeHour}}}}}`,
      variables: { a: cfAccount, s: since, u: until },
    }),
  });
  const json = (await res.json().catch(() => null)) as { data?: { viewer?: { accounts?: { workersInvocationsAdaptive?: { sum: { requests: number }; dimensions: { datetimeHour: string } }[] }[] } } } | null;
  const hourly = json?.data?.viewer?.accounts?.[0]?.workersInvocationsAdaptive;
  if (hourly) {
    const perDay = new Map<string, number>();
    for (const h of hourly) perDay.set(h.dimensions.datetimeHour.slice(0, 10), (perDay.get(h.dimensions.datetimeHour.slice(0, 10)) ?? 0) + h.sum.requests);
    const busiest = Math.max(0, ...perDay.values());
    rows.push({ service: "Cloudflare Workers", metric: "requests, busiest day of last 7", used: busiest, limit: 100000, note: "Free plan 100,000/day (resets 00:00 UTC); no limit on Workers Paid" });
  } else rows.push({ service: "Cloudflare Workers", metric: "requests", used: null, limit: 100000, note: "token present but the query was refused" });
} else {
  missing.push("CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID");
  rows.push({ service: "Cloudflare Workers", metric: "requests per day", used: null, limit: 100000, note: "needs CLOUDFLARE_API_TOKEN (Account Analytics: Read) + CLOUDFLARE_ACCOUNT_ID" });
}

// Services with no usage API reachable from here.
rows.push({ service: "TomTom", metric: "requests per day", used: null, limit: 2500, note: "free 2,500 non-tile/day + 50,000 tile/day; usage only in the TomTom developer dashboard (no key-level usage API); Nalu keeps no call counter" });
rows.push({ service: "Mapbox", metric: "map loads per month", used: null, limit: 50000, note: "free 50,000 web map loads/month; check the Mapbox account usage page" });
rows.push({ service: "Resend", metric: "emails per month", used: null, limit: 3000, note: "free 3,000/month and 100/day; the sending key cannot read usage" });

console.log("NALU COST AND LIMIT CHECK", new Date().toISOString().slice(0, 10));
let flagged = 0;
for (const r of rows) {
  const pct = r.used !== null && r.limit ? r.used / r.limit : null;
  const jump = r.note.includes("JUMP");
  const status = pct === null && !jump ? "unknown" : jump || (pct !== null && pct >= ALERT) ? "ALERT" : pct !== null && pct >= WATCH ? "WATCH" : "OK";
  if (status === "ALERT" || status === "WATCH") flagged++;
  const use = r.used === null ? "n/a" : String(r.used);
  const lim = r.limit === null ? "no cap" : String(r.limit);
  console.log(`${status.padEnd(8)} ${r.service} · ${r.metric}: ${use} of ${lim}${pct !== null ? ` (${Math.round(pct * 100)}%)` : ""} — ${r.note}`);
}
const need = [...new Set(missing)];
if (need.length) console.log(`MISSING ENV NAMES: ${need.join(", ")}`);
console.log(`FLAGGED: ${flagged}`);
