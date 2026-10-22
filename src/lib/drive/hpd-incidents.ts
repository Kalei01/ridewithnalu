/**
 * Honolulu Police Department "Traffic Incidents" (Honolulu Open Data, Socrata
 * dataset ykb6-n5th): a free, key-less list of recent police-reported traffic
 * incidents. Used when TomTom's incident feed is unavailable, and as a
 * supplement. Fields reported: Date, Time, Type, Address, Location, Area. No
 * lanes, no severity, no delay: Nalu never invents one.
 *
 * Source: Honolulu Police Department via Honolulu Open Data. The portal says
 * its data "may be incorrect or not current"; the app shows the source and the
 * report time with every item. Written against the documented Socrata shape
 * (an array of row objects keyed by lower-case field names); live field names
 * and the Location format are unverified, so the reader accepts the usual
 * variants and drops any row it cannot place in time.
 *
 * Reports are matched to a route by their Location coordinates when present,
 * otherwise by road names in the Address text only (no geocoding of any kind).
 */
import { incidentTouchesRoute, type GeoPoint } from "./incident-correlation";
import { titleCase } from "../commute-formatting";
import { sharedIncidents } from "./tomtom-guard";

const HPD_BASE = "https://data.honolulu.gov/resource/ykb6-n5th.json";
export const HPD_INCIDENTS_URL = `${HPD_BASE}?$limit=500`;

/**
 * Newest first, only rows from yesterday (Hawaii time) on, so the 500-row limit
 * can never hide today's reports behind old ones. `date` is the documented
 * "Date" column; if the portal rejects the query (a different field name) the
 * plain URL is used and the code sorts by the timestamps it parses itself.
 */
export function hpdQueryUrl(nowMs: number): string {
  const yesterday = new Date(nowMs + HST_OFFSET_MS - 24 * 3600_000).toISOString().slice(0, 10);
  const params = new URLSearchParams({
    $limit: "500",
    $order: "date DESC",
    $where: `date >= '${yesterday}T00:00:00'`,
  });
  return `${HPD_BASE}?${params.toString()}`;
}
export const HPD_ATTRIBUTION = "Honolulu Police Department via Honolulu Open Data";
/** Reports older than this are not "ahead of you" news any more. */
export const HPD_MAX_AGE_MS = 90 * 60_000;
const HPD_CACHE_MS = 5 * 60_000;
const HPD_FAILURE_BACKOFF_MS = 2 * 60_000;
const HST_OFFSET_MS = -10 * 3600_000;
/** A coordinate report counts as on the route within this distance. */
const ON_ROUTE_M = 300;

export type HpdReport = {
  id: string;
  /** TomTom-style category code so existing incident wording and alerts understand it. */
  category: "1" | "8" | "14" | "3";
  /** Plain label: Collision, Road closure, Stalled vehicle, Road hazard. */
  label: string;
  address: string;
  area: string | null;
  point: GeoPoint | null;
  atMs: number;
};

type Row = Record<string, unknown>;

function field(row: Row, name: string): unknown {
  const lower = name.toLowerCase();
  for (const key of Object.keys(row)) if (key.toLowerCase() === lower) return row[key];
  return undefined;
}

const text = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null;

/** "2026-10-21T00:00:00.000" + "13:45" / "1:45 PM" / "134500" in Hawaii time → epoch ms. */
export function hpdTimestamp(dateValue: unknown, timeValue: unknown): number | null {
  const dateText = text(dateValue);
  const iso = dateText?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  // Text columns often hold "10/21/2026" (US month/day/year), optionally followed by a time.
  const us = dateText?.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  const date = iso ? [iso[0], iso[1], iso[2], iso[3]] : us ? [us[0], us[3], us[1], us[2]] : null;
  const time = text(timeValue) ?? (typeof timeValue === "number" ? String(timeValue) : null);
  if (!date || !time) return null;
  if (Number(date[2]) < 1 || Number(date[2]) > 12 || Number(date[3]) < 1 || Number(date[3]) > 31)
    return null;
  let hour: number;
  let minute: number;
  const clock = time.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*([AaPp][Mm])?$/);
  const packed = time.match(/^(\d{1,2})(\d{2})(?:\d{2})?$/);
  if (clock) {
    hour = Number(clock[1]);
    minute = Number(clock[2]);
    const half = clock[3]?.toLowerCase();
    if (half === "pm" && hour < 12) hour += 12;
    if (half === "am" && hour === 12) hour = 0;
  } else if (packed) {
    hour = Number(packed[1]);
    minute = Number(packed[2]);
  } else return null;
  if (hour > 23 || minute > 59) return null;
  return (
    Date.UTC(Number(date[1]), Number(date[2]) - 1, Number(date[3]), hour, minute) - HST_OFFSET_MS
  );
}

const inHawaii = (lat: number, lon: number) =>
  lat > 18.5 && lat < 22.5 && lon > -160.5 && lon < -154.5;

/** Socrata "Location" in any of its usual forms. */
export function hpdPoint(value: unknown): GeoPoint | null {
  const accept = (lat: number, lon: number) =>
    Number.isFinite(lat) && Number.isFinite(lon) && inHawaii(lat, lon) ? { lat, lon } : null;
  if (typeof value === "string") {
    const point = value.match(/POINT\s*\(\s*(-?\d+\.?\d*)\s+(-?\d+\.?\d*)\s*\)/i);
    if (point) return accept(Number(point[2]), Number(point[1]));
    const pair = value.match(/(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/);
    return pair ? accept(Number(pair[1]), Number(pair[2])) : null;
  }
  if (!value || typeof value !== "object") return null;
  const o = value as Record<string, unknown>;
  if (Array.isArray(o["coordinates"]) && o["coordinates"].length >= 2) {
    return accept(Number(o["coordinates"][1]), Number(o["coordinates"][0]));
  }
  const lat = Number(o["latitude"] ?? o["lat"]);
  const lon = Number(o["longitude"] ?? o["lon"] ?? o["lng"]);
  return accept(lat, lon);
}

function classify(type: string): Pick<HpdReport, "category" | "label"> | null {
  const t = type.toUpperCase();
  if (/COLLISION|ACCIDENT|CRASH|MVA|\bMVC\b/.test(t)) return { category: "1", label: "Collision" };
  if (/CLOSURE|CLOSED/.test(t)) return { category: "8", label: "Road closure" };
  if (/STALL|DISABLED|BROKEN/.test(t)) return { category: "14", label: "Stalled vehicle" };
  if (/HAZARD|DEBRIS|OBSTRUCT/.test(t)) return { category: "3", label: "Road hazard" };
  return null;
}

/** The newest timestamp among ALL rows (including kinds we don't show): proof the feed is current. */
export function newestHpdRow(rows: unknown): number | null {
  if (!Array.isArray(rows)) return null;
  let newest: number | null = null;
  for (const raw of rows) {
    if (!raw || typeof raw !== "object") continue;
    const at = hpdTimestamp(field(raw as Row, "date"), field(raw as Row, "time"));
    if (at !== null && (newest === null || at > newest)) newest = at;
  }
  return newest;
}

/** Reads Socrata rows into reports we can place in time and kind. Anything else is dropped. */
export function parseHpdRows(rows: unknown): HpdReport[] {
  if (!Array.isArray(rows)) return [];
  const out: HpdReport[] = [];
  for (const raw of rows) {
    if (!raw || typeof raw !== "object") continue;
    const row = raw as Row;
    const type = text(field(row, "type"));
    const address = text(field(row, "address"));
    const atMs = hpdTimestamp(field(row, "date"), field(row, "time"));
    if (!type || !address || atMs === null) continue;
    const kind = classify(type);
    if (!kind) continue;
    const point = hpdPoint(field(row, "location") ?? field(row, "location_1"));
    out.push({
      id: `hpd:${text(field(row, ":id")) ?? text(field(row, "incident_id")) ?? `${atMs}|${type}|${address}`}`,
      ...kind,
      address,
      area: text(field(row, "area")),
      point,
      atMs,
    });
  }
  return out;
}

// ---- matching ---------------------------------------------------------------

const ABBREVIATIONS: Array<[RegExp, string]> = [
  [/\bHIGHWAY\b/g, "HWY"],
  [/\bFREEWAY\b/g, "FWY"],
  [/\bBOULEVARD\b/g, "BLVD"],
  [/\bROAD\b/g, "RD"],
  [/\bSTREET\b/g, "ST"],
  [/\bAVENUE\b/g, "AVE"],
  [/\bPARKWAY\b/g, "PKWY"],
  [/\bDRIVE\b/g, "DR"],
];

function normalize(value: string): string {
  let t = value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[ʻ'’`.]/g, "")
    .replace(/[^A-Z0-9/ -]/g, " ");
  for (const [pattern, replacement] of ABBREVIATIONS) t = t.replace(pattern, replacement);
  return t.replace(/\s+/g, " ").trim();
}

/** A pattern that finds this road in an HPD address, or null for roads too vague to match by text. */
export function roadNeedle(road: string): RegExp | null {
  const name = normalize(road).replace(/\s+(EAST|WEST|NORTH|SOUTH|EB|WB|NB|SB)$/, "");
  const freeway = name.match(/^(?:I-?)?H-?\s?(\d)$/);
  if (freeway) return new RegExp(`\\b(?:I-?)?H-?\\s?${freeway[1]}(?![0-9])`);
  const words = name.split(" ").filter(Boolean);
  if (words.length < 2 || name.replace(/[^A-Z]/g, "").length < 6) return null;
  const escaped = name.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
  return new RegExp(`(?:^|[^A-Z0-9])${escaped}(?![A-Z0-9])`);
}

const OKINA_SPELLINGS: Array<[RegExp, string]> = [
  [/\bKalanianaole\b/gi, "Kalanianaʻole"],
  [/\bKapiolani\b/gi, "Kapiʻolani"],
  [/\bKaahumanu\b/gi, "Kaʻahumanu"],
  [/\bOahu\b/gi, "Oʻahu"],
];

const HEADING: Record<string, string> = {
  EB: "eastbound",
  WB: "westbound",
  NB: "northbound",
  SB: "southbound",
};

/** One street of an HPD address in local style: "H-1 eastbound", "Kamehameha Highway". */
function localStreet(part: string): { text: string; freeway: boolean } {
  const cleaned = normalize(part);
  const heading = cleaned.match(/\s(EB|WB|NB|SB)$/)?.[1];
  const base = heading ? cleaned.slice(0, -3).trim() : cleaned;
  const freeway = base.match(/^(?:I-?)?H-?\s?(\d)(?:\s+FWY)?$/);
  if (freeway)
    return { text: `H-${freeway[1]}${heading ? ` ${HEADING[heading]}` : ""}`, freeway: true };
  const spelled = base
    .replace(/\bBLVD\b/g, "BOULEVARD")
    .replace(/\bRD\b/g, "ROAD")
    .replace(/\bST\b/g, "STREET")
    .replace(/\bAVE\b/g, "AVENUE")
    .replace(/\bPKWY\b/g, "PARKWAY")
    .replace(/\bDR\b/g, "DRIVE");
  let text = titleCase(spelled);
  for (const [pattern, replacement] of OKINA_SPELLINGS) text = text.replace(pattern, replacement);
  return { text: text.replace(/\s+/g, " ").trim(), freeway: false };
}

/** Splits "KAMEHAMEHA HWY / KAIAHUA ST" into its streets. */
function addressParts(address: string): string[] {
  return address
    .split(/\s*(?:\/|&|\bAT\b|@|\bAND\b)\s*/i)
    .map((p) => p.trim())
    .filter(Boolean);
}

/** "Collision on H-1 eastbound near Moanalua Road" / "Collision near Kamehameha Highway at Kaiahua Street". */
export function hpdPlaceText(label: string, address: string): string {
  const [first, ...rest] = addressParts(address).map(localStreet);
  if (!first) return `${label} near ${titleCase(address)}`;
  const others = rest.map((r) => r.text).join(" and ");
  return first.freeway
    ? `${label} on ${first.text}${others ? ` near ${others}` : ""}`
    : `${label} near ${first.text}${others ? ` at ${others}` : ""}`;
}

function hstClock(atMs: number): string {
  const d = new Date(atMs + HST_OFFSET_MS);
  const h = d.getUTCHours();
  const m = d.getUTCMinutes();
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

export type HpdDriveIncident = {
  id: string;
  description: string;
  road: string | null;
  delayMinutes: null;
  category: string;
  from: string;
  to: null;
  endTime: null;
  points: GeoPoint[];
  source: "hpd";
  reportedAt: string;
  /** True only when the report's own coordinates sit on the route; a road-name match is shown but never alerts. */
  onRoute: boolean;
};

/**
 * Reports that belong to this route, as incident records with `source: "hpd"`.
 * `roads` are the route's own road names (corridorRoads). Reports from the last
 * 90 minutes only. No delay is ever attached.
 */
export function hpdIncidentsForRoute(
  reports: HpdReport[],
  route: { path: GeoPoint[]; roads: string[] },
  nowMs: number,
): HpdDriveIncident[] {
  const needles = route.roads
    .map((road) => ({ road, needle: roadNeedle(road) }))
    .filter((r): r is { road: string; needle: RegExp } => r.needle !== null);
  const out: HpdDriveIncident[] = [];
  for (const report of reports) {
    const age = nowMs - report.atMs;
    if (age < -5 * 60_000 || age > HPD_MAX_AGE_MS) continue;
    let road: string | null = null;
    if (report.point) {
      if (!incidentTouchesRoute([report.point], route.path, ON_ROUTE_M)) continue;
    } else {
      // No coordinates: the route must pass the named place, i.e. at least two
      // of the streets in the address (the road and its cross street) are roads
      // this route uses. One road alone could be anywhere along it.
      const parts = addressParts(report.address).map(normalize);
      const matched = new Set<string>();
      let firstRoad: string | null = null;
      for (const part of parts) {
        const hit = needles.find(({ needle }) => needle.test(part));
        if (hit) {
          matched.add(hit.road);
          firstRoad ??= hit.road;
        }
      }
      if (parts.length < 2 || matched.size < 2) continue;
      road = firstRoad;
    }
    const place = localStreet(addressParts(report.address)[0] ?? report.address).text;
    out.push({
      id: report.id,
      description: `Police report: ${hpdPlaceText(report.label, report.address)}, ${hstClock(report.atMs)}`,
      road,
      delayMinutes: null,
      category: report.category,
      from: place,
      to: null,
      endTime: null,
      points: report.point ? [report.point] : [],
      source: "hpd",
      reportedAt: new Date(report.atMs).toISOString(),
      onRoute: report.point !== null,
    });
  }
  return out.sort((a, b) => b.reportedAt.localeCompare(a.reportedAt)).slice(0, 5);
}

// ---- fetching ---------------------------------------------------------------

let failedUntil = 0;

/** The feed must show something this recent before we claim to cover the road. */
const HPD_CURRENT_WITHIN_MS = 6 * 3600_000;

export type HpdFeed = { reports: HpdReport[]; newestMs: number | null };

async function getRows(fetcher: typeof fetch, url: string): Promise<Response> {
  // Socrata throttles anonymous callers hard; an optional app token (a public, non-secret
  // identifier, never logged) lifts that. Absent, the request is anonymous as before.
  const appToken = typeof process !== "undefined" ? process.env?.["SOCRATA_APP_TOKEN"] : undefined;
  return fetcher(url, {
    signal: AbortSignal.timeout(5000),
    headers: { Accept: "application/json", ...(appToken ? { "X-App-Token": appToken } : {}) },
  });
}

export type HpdProbe = {
  ok: boolean;
  /** One plain line for the health page. No secrets, no row contents beyond field names and date/time samples. */
  detail: string;
};

export type HpdRowsResult = {
  rows: unknown[] | null;
  /** Which request produced the rows: the filtered "query" or the "plain" URL. */
  variant: "query" | "plain" | null;
  /** Short per-attempt notes (status, non-JSON, empty) for the health page. */
  attempts: string[];
  /** True when the last non-OK/non-JSON answer was a hard failure (not just empty). */
  failed: boolean;
};

/**
 * Fetches rows: the filtered query first; if it errors, is not JSON, or returns
 * zero rows (a valid but non-matching $where, e.g. Date stored as text), retries
 * the plain URL and lets the client-side date parsing do the filtering.
 */
export async function fetchHpdRows(fetcher: typeof fetch, now: number): Promise<HpdRowsResult> {
  const attempts: string[] = [];
  let failed = false;
  for (const [label, url] of [
    ["query", hpdQueryUrl(now)],
    ["plain", HPD_INCIDENTS_URL],
  ] as const) {
    try {
      const response = await getRows(fetcher, url);
      const server = response.headers?.get?.("server") ?? "";
      const cf = response.headers?.get?.("cf-mitigated") ? " cf-mitigated" : "";
      attempts.push(`${label}: HTTP ${response.status}${cf}${server ? ` (${server})` : ""}`);
      const body = await response.text().catch(() => "");
      if (!response.ok) {
        failed = true;
        const snippet = body.replace(/\s+/g, " ").slice(0, 80);
        if (snippet) attempts.push(`body: ${snippet}`);
        continue;
      }
      const type = response.headers?.get?.("content-type") ?? "";
      let parsed: unknown;
      try {
        if (body.trimStart().startsWith("<")) throw new Error("html");
        parsed = JSON.parse(body);
      } catch {
        failed = true;
        attempts.push(
          `${label}: non-JSON response (likely a bot challenge)${type ? ` [${type.slice(0, 30)}]` : ""}`,
        );
        continue;
      }
      if (!Array.isArray(parsed)) {
        failed = true;
        attempts.push(`${label}: JSON but not a row list`);
        continue;
      }
      if (parsed.length === 0) {
        attempts.push(`${label}: 0 rows`);
        continue;
      }
      return { rows: parsed, variant: label, attempts, failed: false };
    } catch (error) {
      failed = true;
      attempts.push(`${label}: ${error instanceof Error ? error.name : "error"}`);
    }
  }
  return { rows: null, variant: null, attempts, failed };
}

/**
 * Health probe for the police feed: runs the same fetch as production (filtered
 * query, then the plain URL), and reports which variant worked, HTTP status, row
 * counts, how many rows parse into a timestamp, the newest row's age, the field
 * names and a sample of the date/time values.
 */
export async function probeHpd(fetcher: typeof fetch = fetch, now = Date.now()): Promise<HpdProbe> {
  const result = await fetchHpdRows(fetcher, now);
  const rows = result.rows;
  if (!rows) return { ok: false, detail: result.attempts.join("; ").slice(0, 400) };
  const first = (rows[0] ?? {}) as Row;
  const fields = Object.keys(first).slice(0, 12).join(",");
  const stamped = rows.filter(
    (r) =>
      r &&
      typeof r === "object" &&
      hpdTimestamp(field(r as Row, "date"), field(r as Row, "time")) !== null,
  ).length;
  const newest = newestHpdRow(rows);
  const ageMin = newest === null ? null : Math.round((now - newest) / 60_000);
  const shown = parseHpdRows(rows).length;
  const samples = rows
    .slice(0, 3)
    .map(
      (r) =>
        `${JSON.stringify(field((r ?? {}) as Row, "date") ?? null)} ${JSON.stringify(field((r ?? {}) as Row, "time") ?? null)}`,
    )
    .join(" | ");
  const sample = `date/time samples ${samples}`.slice(0, 140);
  const current = ageMin !== null && ageMin * 60_000 <= HPD_CURRENT_WITHIN_MS;
  const detail = `${result.attempts.join("; ")}; used ${result.variant}; ${rows.length} rows, ${stamped} with a readable date+time, ${shown} usable kinds, newest ${
    ageMin === null ? "none readable" : `${ageMin} min old`
  }${current ? "" : " (feed not counted as current)"}; fields: ${fields || "none"}; ${sample}`;
  return { ok: current, detail: detail.slice(0, 700) };
}

/** Recent HPD reports, shared by every rider for 5 minutes. Null (never throws) when unreachable. */
export async function loadHpdReports(
  fetcher: typeof fetch = fetch,
  now = Date.now(),
): Promise<HpdFeed | null> {
  if (now < failedUntil) return null;
  return sharedIncidents<HpdFeed>(
    "hpd",
    HPD_CACHE_MS,
    async () => {
      try {
        const result = await fetchHpdRows(fetcher, now);
        if (!result.rows) {
          if (result.failed) {
            console.warn(
              `[hpd] incidents feed unusable: ${result.attempts.join("; ").slice(0, 200)}`,
            );
            failedUntil = now + HPD_FAILURE_BACKOFF_MS;
          }
          return null;
        }
        return { reports: parseHpdRows(result.rows), newestMs: newestHpdRow(result.rows) };
      } catch (error) {
        console.warn("[hpd] incidents feed failed", error instanceof Error ? error.name : "error");
        failedUntil = now + HPD_FAILURE_BACKOFF_MS;
        return null;
      }
    },
    now,
  );
}

export function resetHpd(): void {
  failedUntil = 0;
}

/**
 * HPD reports on this route, never throwing. `checked` is true only when the feed
 * answered AND holds something recent: an empty or stale answer never claims coverage.
 */
export async function hpdNearRoute(
  route: { path: GeoPoint[]; roads: string[] },
  fetcher: typeof fetch = fetch,
  now = Date.now(),
): Promise<{ incidents: HpdDriveIncident[]; checked: boolean }> {
  try {
    const feed = await loadHpdReports(fetcher, now);
    if (!feed || feed.newestMs === null || now - feed.newestMs > HPD_CURRENT_WITHIN_MS)
      return { incidents: [], checked: false };
    return { incidents: hpdIncidentsForRoute(feed.reports, route, now), checked: true };
  } catch {
    return { incidents: [], checked: false };
  }
}
