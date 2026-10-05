// Read-only Google Search Console report for ridenalu.com, used by the
// twice-weekly search review. Run with `bun scripts/gsc-report.mts`.
// Needs GSC_PRIVATE_KEY (and GSC_CLIENT_EMAIL as a fallback) in the
// environment. Uses the webmasters.readonly scope only; never prints secrets.
//
// Options (env): DAYS=28 window length, ROWS=250 rows per table,
// INSPECT=1 also runs URL Inspection on every URL in public/sitemap.xml.
import { readFileSync } from "node:fs";
import { sign } from "node:crypto";

const SITE = "sc-domain:ridenalu.com";
const rawKey = (process.env.GSC_PRIVATE_KEY ?? "").replace(/\\n/g, "\n");

// The stored key may carry stray JSON around the PEM block; the client_email
// that travelled with it is preferred over GSC_CLIENT_EMAIL.
const pem = rawKey.match(/-----BEGIN PRIVATE KEY-----[\s\S]+?-----END PRIVATE KEY-----/)?.[0];
const email =
  rawKey.match(/"client_email":\s*"([^"]+)"/)?.[1] ?? (process.env.GSC_CLIENT_EMAIL ?? "").trim();
if (!pem || !email) throw new Error("GSC_PRIVATE_KEY (with a PEM block) and a client email are required");

const b64 = (v: unknown) => Buffer.from(typeof v === "string" ? v : JSON.stringify(v)).toString("base64url");

async function accessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${b64({ alg: "RS256", typ: "JWT" })}.${b64({
    iss: email,
    scope: "https://www.googleapis.com/auth/webmasters.readonly",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  })}`;
  const signature = sign("RSA-SHA256", Buffer.from(unsigned), `${pem}\n`).toString("base64url");
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${unsigned}.${signature}`,
    }),
  });
  const json = (await res.json()) as { access_token?: string; error?: string; error_description?: string };
  if (!json.access_token) throw new Error(`Google token error ${res.status}: ${json.error} ${json.error_description}`);
  return json.access_token;
}

const token = await accessToken();
async function call(url: string, body?: unknown) {
  const res = await fetch(url, {
    method: body ? "POST" : "GET",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: res.status, json: (await res.json()) as Record<string, any> };
}
const webmasters = "https://www.googleapis.com/webmasters/v3";
const site = encodeURIComponent(SITE);

const days = Number(process.env.DAYS ?? 28);
const rowLimit = Number(process.env.ROWS ?? 250);
// Include the freshest (not yet final) days; Search Console lags 2 to 3 days.
const end = new Date();
const start = new Date(end.getTime() - (days - 1) * 86_400_000);
const day = (d: Date) => d.toISOString().slice(0, 10);

console.log("Sites visible:", JSON.stringify((await call(`${webmasters}/sites`)).json.siteEntry ?? []));
console.log(`Window: ${day(start)} to ${day(end)} (${days} days, includes fresh data)`);

for (const dimensions of [[], ["query"], ["page"], ["date"], ["query", "page"]]) {
  const { status, json } = await call(`${webmasters}/sites/${site}/searchAnalytics/query`, {
    startDate: day(start),
    endDate: day(end),
    dimensions,
    rowLimit,
    dataState: "all",
  });
  const rows = (json.rows ?? []) as { keys?: string[]; clicks: number; impressions: number; ctr: number; position: number }[];
  console.log(`\n== ${dimensions.join(" + ") || "totals"} (HTTP ${status}, ${rows.length} rows) ==`);
  if (json.error) console.log(JSON.stringify(json.error));
  for (const r of rows) {
    console.log(
      `${(r.keys ?? []).join(" | ")}  clicks=${r.clicks} impr=${r.impressions} ctr=${(r.ctr * 100).toFixed(1)}% pos=${r.position.toFixed(1)}`,
    );
  }
}

const sitemaps = (await call(`${webmasters}/sites/${site}/sitemaps`)).json.sitemap ?? [];
console.log("\n== sitemaps ==");
for (const s of sitemaps) {
  console.log(`${s.path} lastDownloaded=${s.lastDownloaded} errors=${s.errors} warnings=${s.warnings} contents=${JSON.stringify(s.contents)}`);
}

if (process.env.INSPECT === "1") {
  const urls = [...readFileSync(new URL("../public/sitemap.xml", import.meta.url), "utf8").matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  console.log("\n== URL inspection ==");
  for (const url of urls) {
    const { status, json } = await call("https://searchconsole.googleapis.com/v1/urlInspection/index:inspect", {
      inspectionUrl: url,
      siteUrl: SITE,
    });
    const r = json.inspectionResult?.indexStatusResult;
    console.log(r ? `${url}  ${r.coverageState}  lastCrawl=${r.lastCrawlTime ?? "-"}` : `${url}  HTTP ${status} ${JSON.stringify(json.error ?? json)}`);
  }
}
