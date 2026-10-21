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
import { sharedIncidents } from "./tomtom-guard";

export const HPD_INCIDENTS_URL = "https://data.honolulu.gov/resource/ykb6-n5th.json?$limit=500";
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
  const date = text(dateValue)?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const time = text(timeValue) ?? (typeof timeValue === "number" ? String(timeValue) : null);
  if (!date || !time) return null;
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

function titleCase(address: string): string {
  return address
    .toLowerCase()
    .replace(/\b([a-z])([a-z]*)/g, (_m, a: string, b: string) => a.toUpperCase() + b)
    .replace(/\b(H)-?(\d)\b/gi, (_m, h: string, n: string) => `${h.toUpperCase()}-${n}`)
    .replace(/\b(Eb|Wb|Nb|Sb)\b/g, (m) => m.toUpperCase())
    .replace(/\s+/g, " ")
    .trim();
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
      const address = normalize(report.address);
      const hit = needles.find(({ needle }) => needle.test(address));
      if (!hit) continue;
      road = hit.road;
    }
    const place = titleCase(report.address);
    out.push({
      id: report.id,
      description: `Reported by HPD: ${report.label} near ${place}, ${hstClock(report.atMs)}`,
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

/** Recent HPD reports, shared by every rider for 5 minutes. Empty (never throws) when unreachable. */
export async function loadHpdReports(
  fetcher: typeof fetch = fetch,
  now = Date.now(),
): Promise<HpdReport[] | null> {
  if (now < failedUntil) return null;
  const reports = await sharedIncidents<HpdReport[]>(
    "hpd",
    HPD_CACHE_MS,
    async () => {
      try {
        const response = await fetcher(HPD_INCIDENTS_URL, {
          signal: AbortSignal.timeout(5000),
          headers: { Accept: "application/json" },
        });
        if (!response.ok) {
          console.warn(`[hpd] incidents feed returned ${response.status}`);
          failedUntil = now + HPD_FAILURE_BACKOFF_MS;
          return null;
        }
        return parseHpdRows(await response.json());
      } catch (error) {
        console.warn("[hpd] incidents feed failed", error);
        failedUntil = now + HPD_FAILURE_BACKOFF_MS;
        return null;
      }
    },
    now,
  );
  return reports;
}

export function resetHpd(): void {
  failedUntil = 0;
}

/** HPD reports on this route, never throwing. `checked` is false when the feed couldn't be read. */
export async function hpdNearRoute(
  route: { path: GeoPoint[]; roads: string[] },
  fetcher: typeof fetch = fetch,
  now = Date.now(),
): Promise<{ incidents: HpdDriveIncident[]; checked: boolean }> {
  try {
    const reports = await loadHpdReports(fetcher, now);
    return reports
      ? { incidents: hpdIncidentsForRoute(reports, route, now), checked: true }
      : { incidents: [], checked: false };
  } catch {
    return { incidents: [], checked: false };
  }
}
