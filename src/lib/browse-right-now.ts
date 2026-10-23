/**
 * "Right now" on the Browse sheet: what a rider wants before anything else when
 * they open Nalu, the roads they depend on, today. It only restates what the
 * live checks and the state's roadwork list say; nothing is estimated.
 *
 * - One calm line when everything checked is clear, otherwise up to 3 ranked items.
 * - Live traffic leads at every hour: serious incidents (accident, closed road, 10+ min
 *   delay) first, then other crashes and slowdowns near the rider or on their usual roads.
 *   The state's weekly lane closures stay out of the way (a separate `closures` list), except
 *   one closure confirmed on the rider's own route that is in effect right now.
 * - Roads follow the rider (browse-corridors.ts): closures are listed only on
 *   the roads of the corridors being checked.
 */
import type { DriveIncident, DriveTime } from "./drive.functions";
import type { HdotScheduledClosure } from "./hdot-lane-closures.functions";
import { incidentCategoryLabel, localRoadName } from "./traffic-incidents";
import { tidyClosure } from "./roadwork";
import { honoluluSeconds } from "./commute-formatting";
import { simplifyPath } from "./home/simplify-path";

type LatLon = { lat: number; lon: number };

export type RoadCheck = {
  id: string;
  /** Plain area label used until the live route names its roads. */
  area: string;
  forward: DriveTime | undefined;
  back: DriveTime | undefined;
  loading: boolean;
  failed: boolean;
};

export type MapFocus = { kind: "point"; point: LatLon } | { kind: "path"; points: LatLon[] };

export type RightNowItem = {
  id: string;
  kind: "incident" | "closure" | "slowdown";
  tone: "bad" | "warn" | "info";
  title: string;
  detail: string;
  /** Who said so: shown on the item's card. */
  source: string;
  focus: MapFocus | null;
};

export type RightNow = {
  status: "loading" | "failed" | "calm" | "items";
  /** The one line for the closed sheet. */
  line: string;
  /** Live traffic first (crashes, slowdowns near the rider), at most one closure confirmed on the route and active now. */
  items: RightNowItem[];
  /** The weekly HDOT closures on the rider's roads (in effect, tonight or later today): a quiet list lower in the sheet. */
  closures: RightNowItem[];
};

const MAX_ITEMS = 3;
const SLOWDOWN_MIN = 5;
const SERIOUS_DELAY_MIN = 10;

// ---- Roads --------------------------------------------------------------

const DIRECTION_WORDS = /\b(?:east|west|north|south)(?:bound)?\b/gi;
const SUFFIX_WORDS =
  /\b(?:fwy|freeway|hwy|highway|rd|road|blvd|boulevard|pkwy|parkway|st|street|ave|avenue)\b/gi;

/** "Moanalua Fwy East" and "Moanalua Freeway" are the same road. */
export function roadKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/‑/g, "-")
    .replace(DIRECTION_WORDS, "")
    .replace(SUFFIX_WORDS, "")
    .replace(/[.,]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const roadSetCache = new WeakMap<DriveTime, string[]>();
/** The major roads of a live route, without direction ("H-1", "Kamehameha Hwy"), in drive order. */
export function routeRoadNames(drive: DriveTime | undefined): string[] {
  if (!drive) return [];
  const cached = roadSetCache.get(drive);
  if (cached) return cached;
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of drive.corridorRoads ?? []) {
    const name = raw.replace(DIRECTION_WORDS, "").replace(/\s+/g, " ").trim();
    const key = roadKey(name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  roadSetCache.set(drive, out);
  return out;
}

/** Roads of a check for the rider: the route's own names, else the area. */
export function checkRoadNames(check: RoadCheck): string[] {
  const live = routeRoadNames(check.forward ?? check.back);
  // Surface streets at the ends of a trip are not "the road"; keep freeways and highways first.
  const main = live.filter((name) =>
    /^H-\d|hwy|highway|fwy|freeway|pali|likelike|kalaniana|nimitz/i.test(name),
  );
  return (main.length ? main : live).slice(0, 2);
}

function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/** Net direction of a route, "eastbound" / "northbound" …, from its first and last point. */
export function netDirection(path: LatLon[] | undefined): string | null {
  if (!path || path.length < 2) return null;
  const a = path[0]!;
  const b = path[path.length - 1]!;
  const dLat = (b.lat - a.lat) * 111;
  const dLon = (b.lon - a.lon) * 111 * Math.cos((a.lat * Math.PI) / 180);
  if (Math.abs(dLat) < 1 && Math.abs(dLon) < 1) return null;
  return Math.abs(dLon) >= Math.abs(dLat)
    ? dLon >= 0
      ? "eastbound"
      : "westbound"
    : dLat >= 0
      ? "northbound"
      : "southbound";
}

const WORD_TO_BOUND: Record<string, string> = {
  east: "eastbound",
  west: "westbound",
  north: "northbound",
  south: "southbound",
};

/**
 * The way a route travels on one of its roads, from the route's own road name
 * ("H-1 East" → "eastbound"). Null when the route does not say: no direction is shown
 * rather than a guess from the trip's overall bearing.
 */
export function routeDirectionOn(drive: DriveTime | undefined, road: string): string | null {
  if (!drive) return null;
  const key = roadKey(road);
  for (const raw of drive.corridorRoads ?? []) {
    if (roadKey(raw) !== key) continue;
    const word = raw.match(/\b(east|west|north|south)(?:bound)?\b/i)?.[1];
    if (word) return WORD_TO_BOUND[word.toLowerCase()] ?? null;
  }
  return null;
}

/** Provider and HDOT place names with the ʻokina and kahakō locals expect. */
const PLACE_SPELLINGS: Array<[RegExp, string]> = [
  [/\bAiea\b/g, "ʻAiea"],
  [/\bEwa\b/g, "ʻEwa"],
  [/\bWaianae\b/g, "Waiʻanae"],
  [/\bKaneohe\b/g, "Kāneʻohe"],
  [/\bWahiawa\b/g, "Wahiawā"],
  [/\bWaikiki\b/g, "Waikīkī"],
  [/\bHalawa\b/g, "Hālawa"],
  [/\bKaimuki\b/g, "Kaimukī"],
  [/\bKahala\b/g, "Kāhala"],
  [/\bMoiliili\b/g, "Moʻiliʻili"],
  [/\bHawaii Kai\b/g, "Hawaiʻi Kai"],
  [/\bKalanianaole\b/g, "Kalanianaʻole"],
  [/\bKapiolani\b/g, "Kapiʻolani"],
];
export function localPlace(text: string): string {
  return PLACE_SPELLINGS.reduce(
    (out, [pattern, replacement]) => out.replace(pattern, replacement),
    text,
  );
}

// ---- Incidents ----------------------------------------------------------

const INCIDENT_SCORE: Record<string, number> = {
  Accident: 100,
  "Road closure": 95,
  "Lane closure": 70,
  "Traffic jam": 60,
  "Hazardous conditions": 50,
  "Disabled vehicle": 40,
  Roadwork: 30,
};

const FRESH_REPORT_MS = 90 * 60_000;

export function ageText(sinceMs: number, nowMs: number): string {
  const minutes = Math.max(0, Math.round((nowMs - sinceMs) / 60_000));
  if (minutes < 2) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours} hr ago`;
}

function incidentLabel(incident: DriveIncident): string | null {
  return incidentCategoryLabel(incident);
}

function incidentFocus(incident: DriveIncident): MapFocus | null {
  const points = incident.points;
  if (!points?.length) return null;
  return { kind: "point", point: points[Math.floor(points.length / 2)]! };
}

function incidentWhereText(incident: DriveIncident): string | null {
  const from = incident.from?.trim();
  const to = incident.to?.trim();
  if (from && to && from.toLowerCase() !== to.toLowerCase())
    return `${localPlace(from)} to ${localPlace(to)}`;
  const one = from || to;
  return one ? `near ${localPlace(one)}` : null;
}

function incidentKey(incident: DriveIncident): string {
  if (incident.id) return `id:${incident.id}`;
  const p = incident.points?.[0];
  return [
    incident.category,
    incident.road,
    incident.from,
    p ? `${p.lat.toFixed(3)},${p.lon.toFixed(3)}` : "",
  ].join("|");
}

/** Every incident the checks returned, each once, with its own coordinates when it has them. */
export function collectIncidents(checks: RoadCheck[]): DriveIncident[] {
  const seen = new Set<string>();
  const out: DriveIncident[] = [];
  for (const check of checks)
    for (const drive of [check.forward, check.back]) {
      if (!drive) continue;
      for (const incident of [...drive.incidents, ...(drive.nearbyIncidents ?? [])]) {
        const key = incidentKey(incident);
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(incident);
      }
    }
  return out;
}

function incidentSource(incident: DriveIncident): string {
  return incident.source === "hpd" ? "Honolulu Police Department" : "TomTom";
}

function incidentItem(incident: DriveIncident, nowMs: number): RightNowItem | null {
  const label = incidentLabel(incident);
  if (!label) return null;
  const road = localRoadName(incident.road);
  const delay = Math.max(0, Math.round(incident.delayMinutes ?? 0));
  let reportedMs: number | null = null;
  if (incident.reportedAt) {
    const parsed = Date.parse(incident.reportedAt);
    if (Number.isFinite(parsed)) reportedMs = parsed;
  }
  // Police reports older than 90 minutes are history, not "right now".
  if (reportedMs !== null && nowMs - reportedMs > FRESH_REPORT_MS) return null;
  const bits = [
    incidentWhereText(incident),
    reportedMs !== null ? ageText(reportedMs, nowMs) : "live",
    delay > 0 ? `+${delay} min` : null,
  ].filter((bit): bit is string => Boolean(bit));
  const serious = (INCIDENT_SCORE[label] ?? 0) >= 95 || delay >= SERIOUS_DELAY_MIN;
  return {
    id: `incident:${incidentKey(incident)}`,
    kind: "incident",
    tone: serious ? "bad" : "warn",
    title: road ? `${label} on ${road}` : label,
    detail: bits.join(" · "),
    source: incidentSource(incident),
    focus: incidentFocus(incident),
  };
}

/** Every fresh incident as an item (the map pins and the sheet's cards share these ids). */
export function incidentItems(checks: RoadCheck[], nowMs: number): RightNowItem[] {
  return collectIncidents(checks).flatMap((incident) => {
    const item = incidentItem(incident, nowMs);
    return item ? [item] : [];
  });
}

// ---- Closures -----------------------------------------------------------

type Window = { startMin: number; endMin: number } | "all-day";

const TIME_RANGE =
  /(\d{1,2})(?::(\d{2}))?\s*([ap])\.?m\.?\s*(?:to|until|-|–|—)\s*(\d{1,2})(?::(\d{2}))?\s*([ap])\.?m\b/i;

function toMinutes(hour: string, minute: string | undefined, meridiem: string): number {
  const h = Number(hour) % 12;
  return (h + (meridiem.toLowerCase() === "p" ? 12 : 0)) * 60 + Number(minute ?? 0);
}

/** The daily window a closure runs ("nightly from 8 p.m. to 5 a.m."), or all day, or null when not stated. */
export function closureWindow(closure: HdotScheduledClosure): Window | null {
  const text = `${closure.schedule} ${closure.location}`;
  if (/24\s*\/\s*7|24[- ]hours?|around the clock/i.test(text)) return "all-day";
  const m = closure.schedule.match(TIME_RANGE);
  if (!m) return null;
  return {
    startMin: toMinutes(m[1]!, m[2], m[3]!),
    endMin: toMinutes(m[4]!, m[5], m[6]!),
  };
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/** HDOT dates have no year; place each in the year nearest today. Returns UTC-midnight stamps. */
function scheduleDates(text: string, todayUtc: number): { at: number; end: boolean }[] {
  const out: { at: number; end: boolean }[] = [];
  const re =
    /\b(?:(through|until|thru)\s+)?(?:[A-Za-z]+day,?\s+)?(Jan|Feb|Mar|Apr|May|June?|July?|Aug|Sept?|Oct|Nov|Dec)[a-z]*\.?\s+(\d{1,2})\b/gi;
  for (const m of text.matchAll(re)) {
    const month = MONTHS.indexOf(m[2]!.slice(0, 3).toLowerCase());
    const year = new Date(todayUtc).getUTCFullYear();
    const at = [year - 1, year, year + 1]
      .map((y) => Date.UTC(y, month, Number(m[3])))
      .reduce((best, v) => (Math.abs(v - todayUtc) < Math.abs(best - todayUtc) ? v : best));
    out.push({ at, end: Boolean(m[1]) });
  }
  return out;
}

function honoluluTodayUtc(nowMs: number): number {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Pacific/Honolulu",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(nowMs));
  const read = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return Date.UTC(read("year"), read("month") - 1, read("day"));
}

/** now: in effect. tonight: starts later tonight. today: a daytime window that starts later today. */
export type ClosureState = "now" | "tonight" | "today" | "later" | "unknown";

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

/**
 * Days of the week a schedule names ("Sunday night through Thursday night",
 * "Monday through Friday", "weekdays"), as 0=Sunday…6; null when it names none.
 * A "night" belongs to the day it starts on.
 */
export function scheduleWeekdays(text: string): Set<number> | null {
  const lower = text.toLowerCase();
  const found: { day: number; at: number }[] = [];
  for (const m of lower.matchAll(
    /\b(sun|mon|tues?|wed(?:nes)?|thu(?:rs?)?|fri|sat(?:ur)?)(?:day)\b/g,
  )) {
    const day = WEEKDAYS.findIndex((name) => name.startsWith(m[1]!.slice(0, 3)));
    if (day >= 0) found.push({ day, at: m.index ?? 0 });
  }
  if (!found.length) {
    if (/\bweekdays?\b/.test(lower)) return new Set([1, 2, 3, 4, 5]);
    if (/\bweekends?\b/.test(lower)) return new Set([0, 6]);
    return null;
  }
  const days = new Set<number>();
  for (let i = 0; i < found.length; i += 1) {
    const here = found[i]!;
    days.add(here.day);
    const next = found[i + 1];
    if (next && /\b(?:through|thru|to)\b/.test(lower.slice(here.at, next.at))) {
      for (let d = here.day; ; d = (d + 1) % 7) {
        days.add(d);
        if (d === next.day) break;
      }
    }
  }
  return days;
}

export function closureState(closure: HdotScheduledClosure, nowMs: number): ClosureState {
  const today = honoluluTodayUtc(nowMs);
  const window = closureWindow(closure);
  if (!window) return "unknown";
  const minutes = Math.floor(honoluluSeconds(new Date(nowMs)) / 60);
  const overnight = window !== "all-day" && window.endMin <= window.startMin;
  // The early-morning end of a night shift still belongs to the day it started on.
  const inEarlyHours = window !== "all-day" && overnight && minutes < window.endMin;
  const shiftDay = inEarlyHours ? today - 86_400_000 : today;

  const dates = scheduleDates(closure.schedule, today);
  const start = dates.length >= 2 ? dates[0] : dates.find((d) => !d.end);
  const end = dates.length >= 2 ? dates[dates.length - 1] : dates.find((d) => d.end);
  if (start && !start.end && start.at > shiftDay) return "later";
  if (end && end.at < shiftDay) return "later";
  // A named run of weekdays decides which days it applies to. Day names that only
  // label a date ("Monday, Oct. 26") are dropped so the date range alone rules.
  const dayText = `${closure.schedule} ${closure.location}`.replace(
    /\b[a-z]+day,?\s+(?=(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+\d)/gi,
    "",
  );
  const days = scheduleWeekdays(dayText);
  if (days && !days.has(new Date(shiftDay).getUTCDay())) return "later";

  if (window === "all-day") return "now";
  const { startMin, endMin } = window;
  const active = overnight
    ? minutes >= startMin || minutes < endMin
    : minutes >= startMin && minutes < endMin;
  if (active) return "now";
  if (startMin > minutes) return overnight || startMin >= 17 * 60 ? "tonight" : "today";
  return "later";
}

export function clock12(totalMinutes: number): string {
  const minutes = ((totalMinutes % 1440) + 1440) % 1440;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h % 12 === 0 ? 12 : h % 12}${m ? `:${String(m).padStart(2, "0")}` : ""} ${h < 12 ? "AM" : "PM"}`;
}

const PLACE = "[A-Z][A-Za-zʻ'’-]+(?:\\s+[A-Z][A-Za-zʻ'’-]+){0,2}";
/** "near Kunia" or "Kalaeloa to Kunia" from HDOT's wording; null when it names no place. */
export function closureWhere(location: string): string | null {
  const near = location.match(new RegExp(`\\b(?:near|at|in the vicinity of)\\s+(${PLACE})`));
  if (near) return `near ${localPlace(near[1]!)}`;
  const range = location.match(
    new RegExp(`\\b(?:(?:East|West|North|South)bound\\s+)?(${PLACE})\\s+to\\s+(${PLACE})`),
  );
  if (range && !/^(?:Exit|Lane|Lanes)\b/.test(range[1]!))
    return `${localPlace(range[1]!)} to ${localPlace(range[2]!)}`;
  return null;
}

function closureRoadLabel(route: string): string {
  return route.replace(/^H-201$/i, "Moanalua Fwy");
}

function closureItem(
  closure: HdotScheduledClosure,
  state: ClosureState,
  onRoute: boolean,
): RightNowItem {
  const window = closureWindow(closure);
  const lanes = tidyClosure(closure).lanes;
  const direction = closure.direction ?? null;
  let when = "";
  if (window === "all-day") when = "Around the clock";
  else if (window) {
    const span = `${clock12(window.startMin)}–${clock12(window.endMin)}`;
    if (state === "now") when = `Now, until ${clock12(window.endMin)}`;
    else if (state === "tonight") when = `Heads-up: tonight ${span}`;
    else when = `Heads-up: later today ${span}`;
  }
  const where = closureWhere(closure.location);
  return {
    id: `closure:${closure.route}:${direction}:${closure.location.slice(0, 60)}`,
    kind: "closure",
    // Not confirmed on this rider's stretch: information only.
    tone: !onRoute ? "info" : /full closure/i.test(lanes) ? "bad" : "warn",
    title: `${closureRoadLabel(closure.route)}${direction ? ` ${direction}` : ""} · ${lanes.charAt(0).toLowerCase()}${lanes.slice(1)}`,
    detail: [when, where, onRoute ? null : "Not confirmed on your route"]
      .filter(Boolean)
      .join(" · "),
    source: "Hawaiʻi DOT weekly list",
    focus: null,
  };
}

// ---- Ranking ------------------------------------------------------------

/** Does a closure's road match one of the roads being checked? */
export function closureOnRoads(closure: HdotScheduledClosure, roads: string[]): boolean {
  const key = roadKey(closure.route);
  const named = roadKey(closureRoadLabel(closure.route));
  return roads.some((road) => {
    const k = roadKey(road);
    return k && (k === key || k === named);
  });
}

function slowdownItems(checks: RoadCheck[]): RightNowItem[] {
  const out: RightNowItem[] = [];
  for (const check of checks) {
    const names = joinNames(checkRoadNames(check)) || check.area;
    for (const drive of [check.forward, check.back]) {
      if (!drive || drive.typicalChecked === false) continue;
      const delay = Math.round(drive.delayMinutes);
      if (delay < SLOWDOWN_MIN) continue;
      // An incident that already states its delay is the item; don't say the same minutes twice.
      if (drive.incidents.some((i) => (i.delayMinutes ?? 0) > 0)) continue;
      const mainRoad = checkRoadNames(check)[0] ?? "";
      const direction = routeDirectionOn(drive, mainRoad);
      const worst = [...drive.trafficSections].sort((a, b) => b.delayMinutes - a.delayMinutes)[0];
      out.push({
        id: `slowdown:${check.id}:${drive === check.forward ? "f" : "b"}`,
        kind: "slowdown",
        tone: delay >= SERIOUS_DELAY_MIN ? "bad" : "warn",
        title: `${mainRoad || names}${direction ? ` ${direction}` : ""}: +${delay} min over typical`,
        detail: drive.provider === "mapbox" ? "Live estimate" : "Live",
        source: drive.provider === "mapbox" ? "Mapbox" : "TomTom",
        focus: worst?.points?.length
          ? { kind: "path", points: worst.points }
          : drive.path?.length
            ? { kind: "path", points: drive.path }
            : null,
      });
    }
  }
  return out;
}

function isSerious(item: RightNowItem): boolean {
  return item.tone === "bad" && item.kind !== "closure";
}

export function buildRightNow(input: {
  checks: RoadCheck[];
  closures: HdotScheduledClosure[] | null;
  now: Date;
}): RightNow {
  const { checks, closures } = input;
  const nowMs = input.now.getTime();

  const anyData = checks.some((c) => c.forward || c.back);
  const stillLoading = checks.length > 0 && !anyData && checks.some((c) => c.loading);
  const allFailed = checks.length === 0 || (!anyData && checks.every((c) => c.failed));

  const incidentRows = collectIncidents(checks)
    .map((incident) => ({ incident, item: incidentItem(incident, nowMs) }))
    .filter((row): row is { incident: DriveIncident; item: RightNowItem } => row.item !== null)
    .sort((a, b) => {
      const score = (i: DriveIncident) =>
        (INCIDENT_SCORE[incidentLabel(i) ?? ""] ?? 20) +
        Math.min(60, i.delayMinutes ?? 0) +
        (i.onRoute === false ? 0 : 10);
      return score(b.incident) - score(a.incident);
    })
    .map((row) => row.item);
  const slowdowns = slowdownItems(checks);

  const roads = checks.flatMap((c) => [
    ...routeRoadNames(c.forward),
    ...(c.back === c.forward ? [] : routeRoadNames(c.back)),
  ]);
  // The server's own spatial check says which listed closures sit on a checked route.
  const confirmed = new Set(
    checks.flatMap((c) =>
      [c.forward, c.back].flatMap((d) =>
        (d?.hdotScheduledClosures ?? []).map((x) => `${x.route}|${x.location}`),
      ),
    ),
  );
  const closureItems: {
    item: RightNowItem;
    state: ClosureState;
    severe: boolean;
    onRoute: boolean;
  }[] = [];
  for (const closure of closures ?? []) {
    if (!closureOnRoads(closure, roads)) continue;
    const state = closureState(closure, nowMs);
    if (state !== "now" && state !== "tonight" && state !== "today") continue;
    const onRoute = confirmed.has(`${closure.route}|${closure.location}`);
    const item = closureItem(closure, state, onRoute);
    if (onRoute) {
      // Attach the closure to its road on the map: the corridor that carries it.
      const carrier = checks.find((c) =>
        closureOnRoads(closure, routeRoadNames(c.forward ?? c.back)),
      );
      const path = (carrier?.forward ?? carrier?.back)?.path;
      if (path?.length) item.focus = { kind: "path", points: path };
    }
    closureItems.push({ item, state, severe: item.tone === "bad", onRoute });
  }
  // On your stretch before elsewhere; in effect before upcoming; full closures before lane closures.
  closureItems.sort(
    (a, b) =>
      Number(b.onRoute) - Number(a.onRoute) ||
      Number(b.state === "now") - Number(a.state === "now") ||
      Number(b.severe) - Number(a.severe),
  );

  const live = [...incidentRows, ...slowdowns];
  const serious = live.filter(isSerious);
  const restLive = live.filter((item) => !isSerious(item));
  const closureList = closureItems.map((c) => c.item);
  // The one closure that may stay up top: confirmed on the rider's route and in effect now.
  const activeOnRoute = closureItems.find((c) => c.onRoute && c.state === "now");

  const ranked = [...serious, ...restLive, ...(activeOnRoute ? [activeOnRoute.item] : [])];
  const items = ranked.slice(0, MAX_ITEMS);

  if (items.length) {
    return { status: "items", line: items[0]!.title, items, closures: closureList };
  }
  if (stillLoading)
    return { status: "loading", line: "Checking the roads…", items: [], closures: closureList };
  if (allFailed)
    return {
      status: "failed",
      line: "Can’t check traffic right now",
      items: [],
      closures: closureList,
    };
  return { status: "calm", line: calmLine(checks), items: [], closures: closureList };
}

/** One honest line for "nothing to report": only roads that were actually checked. */
export function calmLine(checks: RoadCheck[]): string {
  const answered = checks.filter((c) => c.forward || c.back);
  if (!answered.length) return "Can’t check traffic right now";
  const compared = (d: DriveTime | undefined) => d !== undefined && d.typicalChecked !== false;
  const withBaseline = answered.filter((c) => compared(c.forward) || compared(c.back));
  const names = joinNames(
    [...new Set(answered.flatMap((c) => checkRoadNames(c)).map((n) => n))].slice(0, 3),
  );
  const label = names || joinNames(answered.map((c) => c.area));
  if (!withBaseline.length) return `${label}: no usual-time comparison right now`;
  // Without the incident feed "nothing reported" proves nothing: never say clear.
  const incidentsBlind = answered.some((c) =>
    [c.forward, c.back].some((d) => d !== undefined && d.incidentsAvailable === false),
  );
  if (incidentsBlind) return `${label}: traffic looks normal; crash data limited right now`;
  const bothWays = withBaseline.every((c) => compared(c.forward) && compared(c.back));
  return bothWays ? `${label} clear both ways` : `${label} clear`;
}

// ---- Map data -----------------------------------------------------------

/** What a map pin looks like: each kind has its own colour and glyph. */
export type IncidentKind = "crash" | "police" | "closure" | "roadwork" | "other";

export type IncidentPin = {
  id: string;
  lat: number;
  lon: number;
  label: string;
  tone: RightNowItem["tone"];
  kind: IncidentKind;
};

/** Police (HPD) reports first, then the provider's own category. */
export function incidentKind(incident: DriveIncident): IncidentKind {
  if (incident.source === "hpd") return "police";
  const label = incidentLabel(incident);
  if (label === "Accident") return "crash";
  if (label === "Road closure" || label === "Lane closure") return "closure";
  if (label === "Roadwork") return "roadwork";
  return "other";
}

/** One pin per reported incident that carries its own coordinates (TomTom, and police reports that have them). */
export function incidentPins(checks: RoadCheck[], nowMs: number): IncidentPin[] {
  const pins: IncidentPin[] = [];
  for (const incident of collectIncidents(checks)) {
    const item = incidentItem(incident, nowMs);
    const points = incident.points;
    if (!item || !points?.length) continue;
    const mid = points[Math.floor(points.length / 2)]!;
    pins.push({
      id: item.id,
      lat: mid.lat,
      lon: mid.lon,
      label: item.title,
      tone: item.tone,
      kind: incidentKind(incident),
    });
  }
  return pins;
}

export type RoadLine = {
  id: string;
  path: LatLon[];
  /** "clear" only when the live check had a usual-time comparison; otherwise "unknown" (grey). */
  state: "clear" | "unknown";
  sections: {
    severity: "moderate" | "heavy";
    points: LatLon[];
    /** Which way's check reported it ("f" forward, "b" back) and its own delay. */
    way: "f" | "b";
    delayMinutes: number;
  }[];
  key: string;
};

/** The checked roads as lines to draw (simplified so the map stays light). Roads with no answer are left out. */
export function roadLines(checks: RoadCheck[]): RoadLine[] {
  const lines: RoadLine[] = [];
  const toLL = (pts: Array<[number, number]>): LatLon[] => pts.map(([lat, lon]) => ({ lat, lon }));
  for (const check of checks) {
    const drives = [check.back, check.forward].filter((d): d is DriveTime => d !== undefined);
    if (!drives.length) continue;
    // Both ways share one road: draw its base once, then each way's slow stretches on top.
    const primary = check.forward ?? check.back!;
    if (!primary.path?.length) continue;
    const known = drives.every((d) => d.typicalChecked !== false);
    const sections = drives.flatMap((d) =>
      d.trafficSections
        .filter((s) => s.points.length >= 2)
        .map((s) => ({
          severity: s.severity,
          points: toLL(simplifyPath(s.points, 15)),
          way: d === check.forward ? ("f" as const) : ("b" as const),
          delayMinutes: Math.round(s.delayMinutes),
        })),
    );
    lines.push({
      id: check.id,
      path: toLL(simplifyPath(primary.path, 25)),
      state: known ? "clear" : "unknown",
      sections,
      key: `${known ? "c" : "u"}:${sections.length}:${drives.map((d) => d.fetchedAt).join("/")}`,
    });
  }
  return lines;
}

/** Who answered, for the Layers menu: "TomTom, live", "Mapbox estimate", or null. */
export function trafficSourceLabel(checks: RoadCheck[]): string | null {
  const drives = checks
    .flatMap((c) => [c.forward, c.back])
    .filter((d): d is DriveTime => d !== undefined);
  if (!drives.length) return null;
  return drives.some((d) => d.provider === "mapbox") ? "Mapbox estimate" : "TomTom, live";
}

// ---- Traffic card -------------------------------------------------------

export type TrafficCardData = {
  /** "H-1 westbound" (road and way only as far as the data says). */
  title: string;
  /** "ʻAiea → Pearl City" when a reported incident names the stretch; otherwise null. */
  between: string | null;
  /** "Heavy traffic", "Slow traffic", "No slowdown reported here", or null when unknown. */
  level: string | null;
  tone: "bad" | "warn" | "info";
  /** Lines that restate the provider's own numbers. Absent data is absent here. */
  facts: string[];
  /** "TomTom · live · updated 3 min ago". */
  source: string;
};

function nearPoint(a: LatLon, b: LatLon, meters: number): boolean {
  const dLat = (a.lat - b.lat) * 111_000;
  const dLon = (a.lon - b.lon) * 111_000 * Math.cos((a.lat * Math.PI) / 180);
  return Math.hypot(dLat, dLon) <= meters;
}

/**
 * The card for a tapped road segment. `sectionIndex` is the index into the road line's
 * `sections` (a slow stretch), or null for the road itself. Only the provider's own
 * numbers are stated; nothing is estimated.
 */
export function trafficCard(
  checks: RoadCheck[],
  line: RoadLine,
  sectionIndex: number | null,
  nowMs: number,
): TrafficCardData | null {
  const check = checks.find((c) => c.id === line.id);
  if (!check) return null;
  const section = sectionIndex === null ? null : (line.sections[sectionIndex] ?? null);
  const drive = section
    ? section.way === "f"
      ? check.forward
      : check.back
    : (check.forward ?? check.back);
  if (!drive) return null;

  const road = checkRoadNames(check)[0] ?? "";
  const direction = road ? routeDirectionOn(drive, road) : null;
  const title = road ? `${road}${direction ? ` ${direction}` : ""}` : check.area;

  // A reported stretch ("Aiea to Pearl City") only when an incident on this drive sits on this segment.
  let between: string | null = null;
  if (section) {
    const hit = drive.incidents.find(
      (i) =>
        i.from?.trim() &&
        i.to?.trim() &&
        i.from.trim().toLowerCase() !== i.to.trim().toLowerCase() &&
        i.points?.some((p) => section.points.some((q) => nearPoint(p, q, 400))),
    );
    if (hit) between = `${localPlace(hit.from!.trim())} → ${localPlace(hit.to!.trim())}`;
  }

  const compared = drive.typicalChecked !== false;
  const facts: string[] = [];
  if (section && section.delayMinutes >= 1)
    facts.push(`+${section.delayMinutes} min on this stretch`);
  if (compared) {
    const delay = Math.round(drive.delayMinutes);
    if (delay >= 1) facts.push(`+${delay} min over usual on the whole route`);
    else if (!section) facts.push("Running about as usual");
  }

  const level = section
    ? section.severity === "heavy"
      ? "Heavy traffic"
      : "Slow traffic"
    : line.state === "clear"
      ? "No slowdown reported here"
      : null;
  const tone: TrafficCardData["tone"] = section
    ? section.severity === "heavy"
      ? "bad"
      : "warn"
    : "info";

  const provider = drive.provider === "mapbox" ? "Mapbox" : "TomTom";
  const age = drive.fetchedAt ? ageText(drive.fetchedAt, nowMs) : null;
  const source = [
    provider,
    drive.provider === "mapbox" && !compared ? "live, no usual-time comparison" : "live",
    age ? `updated ${age}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return { title, between, level, tone, facts, source };
}
