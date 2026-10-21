/**
 * Route commitment while driving: once a route is on screen, a refresh may
 * only replace its corridor for a MAIN reason (a big, like-for-like saving),
 * and a driver who declines a proposed exit is left alone on her own road.
 *
 * Why this exists (Oct 19 drive home, H-1 West): every refresh re-ran
 * TomTom's fastest route, which kept sending her off at the Pearlridge exit
 * while she stayed on H-1; the nav card kept pushing it, with no reason, and
 * nothing noticed she had passed it for 13 minutes.
 *
 * Pure TypeScript, no UI. The screens call `resolveLiveRoute` for every live
 * refresh and `ExitDeclineWatcher` for every GPS fix; they never decide
 * between corridors themselves.
 */
import type { DriveIncident, DriveTime } from "./drive.functions";
import { incidentWhere } from "./incident-alerts";
import { formatDriveMinutes } from "./drive/traffic-summary";
import {
  distanceAlongPath,
  isExitManeuver,
  maneuverKey,
  matchRoutePoint,
  metersBetween,
  placeManeuvers,
  speakableRoad,
  trimRoutePath,
  type Maneuver,
  type RouteMatch,
} from "./navigation-voice";
import { incidentCategoryLabel, localRoadName } from "./traffic-incidents";

type LatLon = { lat: number; lon: number };

// ---- Constants (all tuning lives here) --------------------------------------

/** A different corridor must save at least this many minutes... */
export const SWITCH_MIN_SAVING_MIN = 5;
/** ...or this share of the time left on the current route, whichever is more. */
export const SWITCH_MIN_SAVING_FRACTION = 0.15;
/** A declined detour is not proposed again for this long... */
export const REPROPOSE_AFTER_MS = 10 * 60_000;
/** ...unless it now saves this many minutes more than when she declined it. */
export const REPROPOSE_EXTRA_SAVING_MIN = 5;
/** A point within this distance of a route counts as being on that route. */
export const CORRIDOR_NEAR_M = 60;
/** Routes that stay apart for this long (along the new route) are different corridors. */
export const CORRIDOR_DIVERGE_RUN_M = 500;
/** Spacing of the points used to compare two routes. */
const CORRIDOR_SAMPLE_M = 100;
/** The rider must be this close to the route on screen to compare against it. */
export const COMPARE_MAX_RIDER_OFFSET_M = 150;
/** To price staying on her road, the road itself is sent (sampled), so TomTom follows it with live traffic. */
export const STAY_PATH_MIN_SPACING_M = 100;
export const STAY_PATH_MAX_POINTS = 380;
/** How far ahead a declined road is watched for in a fresh route. */
export const DECLINED_ROAD_LOOKAHEAD_M = 3000;
/** A "stay on my road" route may cost at most this many minutes more than the declined one. */
export const STAY_MAX_EXTRA_MIN = 30;
/** Time to show the "Faster via..." / "Staying on..." line on the HUD. */
export const ROUTE_NOTICE_MS = 60_000;

/** Exit-decline detection (freeway ramps keep cross-track small, so look at progress past the exit). */
export const DECLINE_MIN_BEYOND_M = 80;
export const DECLINE_WATCH_BEYOND_M = 700;
/** At speed: this far from the ramp line AND this far off its heading. */
export const DECLINE_APART_M = 40;
export const DECLINE_HEADING_DEG = 35;
/** Crawling (heading unreliable): this far from the ramp line. */
export const DECLINE_APART_SLOW_M = 60;
export const DECLINE_HEADING_MIN_SPEED_MPS = 3;
export const DECLINE_MAX_ACCURACY_M = 25;
export const DECLINE_CONFIRM_FIXES = 3;

/** Background transit re-planning while a drive is being navigated. */
export const NAV_TRANSIT_REPLAN_MS = 5 * 60_000;

/** Minutes the new route must save over staying, for the minutes left on the current one. */
export function requiredSavingMinutes(remainingMin: number): number {
  return Math.max(SWITCH_MIN_SAVING_MIN, SWITCH_MIN_SAVING_FRACTION * Math.max(0, remainingMin));
}

// ---- Geometry ---------------------------------------------------------------

function samplePath(
  path: ReadonlyArray<LatLon>,
  stepM: number,
): Array<{ point: LatLon; along: number }> {
  const out: Array<{ point: LatLon; along: number }> = [];
  if (path.length === 0) return out;
  out.push({ point: path[0]!, along: 0 });
  let total = 0;
  let nextAt = stepM;
  for (let i = 1; i < path.length; i += 1) {
    const a = path[i - 1]!;
    const b = path[i]!;
    const len = metersBetween(a, b);
    while (len > 0 && nextAt <= total + len) {
      const t = (nextAt - total) / len;
      out.push({
        point: { lat: a.lat + (b.lat - a.lat) * t, lon: a.lon + (b.lon - a.lon) * t },
        along: nextAt,
      });
      nextAt += stepM;
    }
    total += len;
  }
  out.push({ point: path[path.length - 1]!, along: total });
  return out;
}

export type PathComparison = {
  /** Longest stretch of `candidate` (meters) that is not on `reference`. */
  longestApartM: number;
  /** Distance along `candidate` where that stretch starts. */
  apartFromAlongM: number | null;
  /** Distance along `candidate` where it ends (null when it never rejoins the reference). */
  apartToAlongM: number | null;
};

/** Where `candidate` leaves `reference` and for how long, measured along `candidate`. */
export function comparePaths(
  reference: ReadonlyArray<LatLon>,
  candidate: ReadonlyArray<LatLon>,
  nearM = CORRIDOR_NEAR_M,
): PathComparison {
  let longest = 0;
  let longestStart: number | null = null;
  let longestEnd: number | null = null;
  let rejoined = false;
  let runStart: number | null = null;
  const samples = samplePath(candidate, CORRIDOR_SAMPLE_M);
  for (const s of samples) {
    const m = matchRoutePoint(s.point, reference as LatLon[]);
    const off = !m || m.distanceM > nearM;
    if (off) {
      runStart ??= s.along;
      const run = s.along - runStart + CORRIDOR_SAMPLE_M;
      if (run > longest) {
        longest = run;
        longestStart = runStart;
        longestEnd = s.along;
        rejoined = false;
      }
    } else {
      if (runStart !== null && runStart === longestStart) rejoined = true;
      runStart = null;
    }
  }
  return {
    longestApartM: longest,
    apartFromAlongM: longestStart,
    apartToAlongM: rejoined ? longestEnd : null,
  };
}

export function differentCorridor(cmp: PathComparison): boolean {
  return cmp.longestApartM >= CORRIDOR_DIVERGE_RUN_M;
}

/** The route point `meters` along the path. */
function pointAtAlong(path: ReadonlyArray<LatLon>, meters: number): LatLon | null {
  let travelled = 0;
  for (let i = 1; i < path.length; i += 1) {
    const a = path[i - 1]!;
    const b = path[i]!;
    const len = metersBetween(a, b);
    if (travelled + len >= meters && len > 0) {
      const t = (meters - travelled) / len;
      return { lat: a.lat + (b.lat - a.lat) * t, lon: a.lon + (b.lon - a.lon) * t };
    }
    travelled += len;
  }
  return null;
}

function pathLength(path: ReadonlyArray<LatLon>): number {
  let total = 0;
  for (let i = 1; i < path.length; i += 1) total += metersBetween(path[i - 1]!, path[i]!);
  return total;
}

// ---- Road names -------------------------------------------------------------

const DIRECTION_TAIL = /\s+(?:North|South|East|West|NB|SB|EB|WB)$/i;

/** "H-1 West" -> "H-1": the road, without the way it runs. */
export function roadWithoutDirection(road: string | null | undefined): string | null {
  const name = localRoadName(road ?? null)?.trim();
  if (!name) return null;
  return name.replace(DIRECTION_TAIL, "") || null;
}

function roadKey(road: string | null | undefined): string | null {
  const name = roadWithoutDirection(road);
  return name ? name.toLowerCase() : null;
}

export function isExitLike(m: Pick<Maneuver, "maneuver">): boolean {
  return isExitManeuver(m.maneuver);
}

/** The road a route named at `point`: the last guidance step at or before it. */
export function roadAtPoint(
  route: Pick<DriveTime, "path" | "maneuvers" | "corridorRoads">,
  point: LatLon,
): string | null {
  const at = distanceAlongPath(route.path, point);
  let road: string | null = null;
  for (const m of route.maneuvers) {
    if (distanceAlongPath(route.path, m) <= at + 50 && m.road) road = m.road;
  }
  return roadWithoutDirection(road ?? route.corridorRoads[0] ?? null);
}

// ---- Memory of what the rider declined --------------------------------------

type Declined = { at: number; savesMin: number };

/** Least time between two "price staying on my road" requests (one per ~2-min refresh). */
export const VIA_MIN_GAP_MS = 100_000;
/** After staying could not be priced for a detour, don't ask again for this long. */
export const NO_ESTIMATE_RETRY_MS = 5 * 60_000;

/** What the rider turned down, and what the server could not price. Lives for one drive. */
export class CommitmentMemory {
  private declined = new Map<string, Declined>();
  private proposed = new Map<string, number>();
  private noEstimate = new Map<string, number>();
  private lastPricedAt = -Infinity;

  /** Remember that this detour was proposed, and what it promised. */
  recordProposal(road: string | null, savesMin: number) {
    const key = roadKey(road);
    if (key) this.proposed.set(key, savesMin);
  }

  recordDecline(road: string | null, now: number) {
    const key = roadKey(road);
    if (!key) return;
    this.declined.set(key, { at: now, savesMin: this.proposed.get(key) ?? 0 });
  }

  /** True while a declined detour must not be proposed again. */
  isSuppressed(road: string | null, savesMin: number, now: number): boolean {
    const key = roadKey(road);
    const d = key ? this.declined.get(key) : undefined;
    if (!d) return false;
    if (now - d.at >= REPROPOSE_AFTER_MS) return false;
    return savesMin < d.savesMin + REPROPOSE_EXTRA_SAVING_MIN;
  }

  quietRoads(now: number): string[] {
    return [...this.declined.entries()]
      .filter(([, d]) => now - d.at < REPROPOSE_AFTER_MS)
      .map(([k]) => k);
  }

  /** "Price staying" requests: at most one per gap, and none for a detour that just failed. */
  priceStatus(signature: string, now: number): "go" | "too-soon" | "failed-recently" {
    const failedAt = this.noEstimate.get(signature);
    if (failedAt !== undefined && now - failedAt < NO_ESTIMATE_RETRY_MS) return "failed-recently";
    if (now - this.lastPricedAt < VIA_MIN_GAP_MS) return "too-soon";
    return "go";
  }

  recordPriceAttempt(now: number) {
    this.lastPricedAt = now;
  }

  recordNoEstimate(signature: string, now: number) {
    this.noEstimate.set(signature, now);
  }
}

/** First exit-like step onto a quiet (declined) road within the lookahead of the route start. */
function declinedExitAhead(
  route: Pick<DriveTime, "path" | "maneuvers">,
  memory: CommitmentMemory,
  now: number,
): Maneuver | null {
  const quiet = new Set(memory.quietRoads(now));
  if (quiet.size === 0) return null;
  for (const m of route.maneuvers) {
    if (!isExitLike(m)) continue;
    const key = roadKey(m.road);
    if (!key || !quiet.has(key)) continue;
    if (distanceAlongPath(route.path, m) <= DECLINED_ROAD_LOOKAHEAD_M) return m;
  }
  return null;
}

// ---- Reason and wording -----------------------------------------------------

const NBSP = " ";
/** "7 min" / "1 hr 1 min", never split across lines. */
export function minutesText(n: number): string {
  return formatDriveMinutes(n).replace(/ /g, NBSP);
}

/** Minutes as a person says them: "7 minutes", "1 hour 1 minute". */
export function spokenMinutes(n: number): string {
  const total = Math.max(0, Math.round(n));
  const plural = (v: number, word: string) => `${v} ${word}${v === 1 ? "" : "s"}`;
  if (total < 60) return plural(total, "minute");
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  return mins === 0 ? plural(hours, "hour") : `${plural(hours, "hour")} ${plural(mins, "minute")}`;
}

function incidentReason(incident: DriveIncident): string {
  const label = incidentCategoryLabel(incident) ?? (incident.description.trim() || "Incident");
  const road = roadWithoutDirection(incident.road);
  const where = incidentWhere(incident);
  return `${label} on ${road ?? "your current route"}${where ? ` ${where}` : ""}`;
}

/**
 * Why the stretch you would leave is worth leaving, from what TomTom reported
 * for that stretch only (`inStretch` says whether a point is on the part of
 * your road the other route avoids; shared road says nothing about the
 * choice). Incident > a big delay on a named stretch > null. Never invented.
 */
export function proposalReason(
  stay: Pick<DriveTime, "incidents" | "trafficSections" | "path" | "maneuvers" | "corridorRoads">,
  inStretch: (point: LatLon) => boolean,
): string | null {
  const incidents = stay.incidents
    .filter((i) => {
      const first = i.points?.[0];
      return first ? inStretch(first) : false;
    })
    .filter((i) => incidentCategoryLabel(i) !== null || (i.delayMinutes ?? 0) >= 2)
    .sort((a, b) => (b.delayMinutes ?? 0) - (a.delayMinutes ?? 0));
  if (incidents[0]) return incidentReason(incidents[0]);
  const section = [...stay.trafficSections]
    .filter((s) => s.delayMinutes >= 3 && s.points.length > 0 && inStretch(s.points[0]!))
    .sort((a, b) => b.delayMinutes - a.delayMinutes)[0];
  if (section) {
    const road = roadAtPoint(stay, section.points[0]!);
    if (road) return `${section.severity === "heavy" ? "Heavy" : "Slow"} traffic on ${road}`;
  }
  return null;
}

/** The label above the HUD line already says "Faster route". */
export function proposalMessage(input: {
  via: string | null;
  savesMin: number;
  reason: string | null;
}) {
  const saves = `saves ${minutesText(input.savesMin)}`;
  const head = input.via ? `Via ${input.via} — ${saves}` : `Saves ${minutesText(input.savesMin)}`;
  const hud = input.reason ? `${head}. ${input.reason}.` : `${head}.`;
  const spokenHead = input.via
    ? `Faster via ${speakableRoad(input.via)}, saves ${spokenMinutes(input.savesMin)}`
    : `Faster route found, saves ${spokenMinutes(input.savesMin)}`;
  const spoken = input.reason ? `${spokenHead}. ${speakableRoad(input.reason)}.` : `${spokenHead}.`;
  return { hud, spoken };
}

export function stayingMessage(road: string | null, plusMin: number | null) {
  const where = road ? `Staying on ${road}` : "Staying on your road";
  const more = plusMin !== null && plusMin >= 1;
  return {
    hud: more ? `${where} — about +${minutesText(plusMin)}.` : `${where}.`,
    spoken: more
      ? `${speakableRoad(where)}. About ${spokenMinutes(plusMin)} longer.`
      : `${speakableRoad(where)}.`,
  };
}

// ---- The decision -----------------------------------------------------------

type RouteLike = DriveTime;

export type CommitMeta =
  | { outcome: "accept"; unpriced?: boolean }
  | {
      outcome: "propose";
      savesMin: number;
      fromVia: string | null;
      toVia: string | null;
      detour: string | null;
      reason: string | null;
      hud: string;
      spoken: string;
    }
  | {
      outcome: "keep";
      savesMin: number | null;
      why: "below-bar" | "declined" | "rate-limited";
    }
  | {
      outcome: "declined-stay";
      road: string | null;
      plusMin: number | null;
      via: string | null;
      hud: string;
      spoken: string;
    }
  | { outcome: "declined-fallback"; road: string | null };

export type ResolveInput = {
  /** The route fresh from TomTom, from `rider`. */
  fresh: RouteLike;
  /** The route on screen right now (null on the first fetch). */
  committed: RouteLike | null;
  /** Recent routes the rider has driven on, newest first (geometry of her road). */
  roadHistory?: ReadonlyArray<ReadonlyArray<LatLon>>;
  rider: LatLon;
  bearing: number | null;
  memory: CommitmentMemory;
  now: number;
  /** Set when the rider declined an exit: switch to her own road. */
  declined: { road: string | null; onRoad?: string | null; remainingMin: number } | null;
  /** Skip all comparison (she really left the road and was rerouted). */
  reroute: boolean;
  /** Price a route that must pass through `via`, with live traffic. Null on any failure. */
  fetchVia: (via: LatLon[]) => Promise<RouteLike | null>;
};

export type ResolveOutput = { route: RouteLike; meta: CommitMeta };

/** The differing stretch, as distances along the road she is on. */
type Stretch = { fromM: number; toM: number };

function stretchOnRemaining(
  remaining: ReadonlyArray<LatLon>,
  fresh: ReadonlyArray<LatLon>,
  cmp: PathComparison,
): Stretch {
  const total = pathLength(remaining);
  const freshTotal = pathLength(fresh);
  const startPoint = pointAtAlong(
    fresh,
    Math.max(0, (cmp.apartFromAlongM ?? 0) - CORRIDOR_SAMPLE_M),
  );
  const endAlong = (cmp.apartToAlongM ?? freshTotal) + CORRIDOR_SAMPLE_M;
  const endPoint = endAlong >= freshTotal ? null : pointAtAlong(fresh, endAlong);
  const fromM = startPoint ? distanceAlongPath(remaining, startPoint) : 0;
  const toM = endPoint ? distanceAlongPath(remaining, endPoint) : total;
  return { fromM, toM: Math.max(toM, fromM) };
}

/**
 * The road she is on, sampled for TomTom: the whole remaining route (not a
 * few waypoints), so the priced route cannot take another road anywhere.
 */
export function stayViaPoints(remaining: ReadonlyArray<LatLon>): LatLon[] {
  const total = pathLength(remaining);
  if (total < 600) return [];
  const step = Math.max(STAY_PATH_MIN_SPACING_M, total / STAY_PATH_MAX_POINTS);
  return samplePath(remaining, step)
    .slice(1, -1)
    .map((s) => ({
      lat: Math.round(s.point.lat * 1e5) / 1e5,
      lon: Math.round(s.point.lon * 1e5) / 1e5,
    }));
}

/** First road `fresh` uses at or after where it leaves the committed road: the detour's name. */
function detourRoad(fresh: RouteLike, cmp: PathComparison): string | null {
  const from = Math.max(0, (cmp.apartFromAlongM ?? 0) - 150);
  for (const m of fresh.maneuvers) {
    if (m.maneuver.startsWith("ARRIVE") || !m.road) continue;
    if (distanceAlongPath(fresh.path, m) >= from) return roadWithoutDirection(m.road);
  }
  return null;
}

function via(route: RouteLike | null): string | null {
  return route?.corridorLabel?.replace(/^Via\s+/i, "") ?? null;
}

/**
 * The road ahead of her taken from a route she has already been given, never
 * guessed from her heading: a recent route that passes where she is, heading
 * the way she heads, and does not go through the exit she turned down.
 */
export function roadAheadFromHistory(
  history: ReadonlyArray<ReadonlyArray<LatLon>>,
  rider: LatLon,
  heading: number | null,
  /** A point on the exit she turned down, beyond the gore: a route through it is not her road. */
  avoid: LatLon | null,
): { reference: LatLon[]; via: LatLon[] } | null {
  for (const path of history) {
    if (path.length < 2) continue;
    if (avoid && matchRoutePoint(avoid, path as LatLon[])!.distanceM <= 40) continue;
    const m = matchRoutePoint(rider, path as LatLon[]);
    if (!m || m.distanceM > 40) continue;
    if (heading !== null && angleDiff(m.bearing, heading) > 35) continue;
    const ahead = trimRoutePath(path as LatLon[], m);
    const via = stayViaPoints(ahead);
    if (pathLength(ahead) < 1500 || via.length === 0) continue;
    return { reference: ahead, via };
  }
  return null;
}

/** A point ~400 m down the exit the fresh route wants: a history route that goes there is not her road. */
function rampPointOf(route: Pick<DriveTime, "path">, exit: Maneuver): LatLon | null {
  return pointAtAlong(route.path, distanceAlongPath(route.path, exit) + 400);
}

/**
 * A route priced by following a path has no honest "usual time" of its own
 * (TomTom prices the path with live traffic only). Carry the baseline of the
 * route she was on, so the delay shown and the rescue advisor's spike check
 * keep meaning the same thing.
 */
export function withCarriedBaseline(stay: RouteLike, committed: RouteLike | null): RouteLike {
  if (!committed) return stay;
  const delay = committed.delayMinutes;
  return {
    ...stay,
    delayMinutes: delay,
    typicalMinutes: stay.trafficMinutes - delay,
    ...(committed.typicalChecked === undefined ? {} : { typicalChecked: committed.typicalChecked }),
  };
}

export async function resolveLiveRoute(input: ResolveInput): Promise<ResolveOutput> {
  const { fresh, committed, rider, memory, now } = input;
  const accept = (unpriced = false): ResolveOutput => ({
    route: fresh,
    meta: unpriced ? { outcome: "accept", unpriced: true } : { outcome: "accept" },
  });

  // She declined an exit: continue on her own road, say so once.
  if (input.declined && !input.reroute) return resolveDeclined(input);
  if (input.reroute || !committed || committed.path.length < 2) return accept();

  const match = matchRoutePoint(rider, committed.path);
  if (!match || match.distanceM > COMPARE_MAX_RIDER_OFFSET_M) return accept();
  const remaining = trimRoutePath(committed.path, match);
  const cmp = comparePaths(remaining, fresh.path);
  const differs = differentCorridor(cmp);
  const quietExit = declinedExitAhead(fresh, memory, now);
  if (!differs && !quietExit) return accept();

  // Anything we cannot price honestly fails toward the fresh route (a closure
  // ahead must reroute her), never toward a stale one.
  let viaPoints: LatLon[] | null = null;
  let reference: LatLon[] | null = null;
  let stretch: Stretch | null = null;
  if (differs) {
    stretch = stretchOnRemaining(remaining, fresh.path, cmp);
    viaPoints = stayViaPoints(remaining);
    reference = remaining;
  } else if (quietExit) {
    const ahead = roadAheadFromHistory(
      input.roadHistory ?? [],
      rider,
      input.bearing ?? match.bearing,
      rampPointOf(fresh, quietExit),
    );
    viaPoints = ahead?.via ?? null;
    reference = ahead?.reference ?? null;
  }
  const detour = quietExit ? roadWithoutDirection(quietExit.road) : detourRoad(fresh, cmp);
  const signature =
    detour?.toLowerCase() ?? `at:${(cmp.apartFromAlongM ?? 0).toFixed(0)}:${via(fresh) ?? ""}`;
  if (!viaPoints || viaPoints.length === 0) return accept(true);
  const status = memory.priceStatus(signature, now);
  if (status === "failed-recently") return accept(true);
  if (status === "too-soon") {
    // A closure on her road must never wait for the next price check.
    if (hasRoadClosure(committed)) return accept(true);
    // Priced a moment ago: leave the route as it is until the next refresh.
    return { route: committed, meta: { outcome: "keep", savesMin: null, why: "rate-limited" } };
  }

  memory.recordPriceAttempt(now);
  const stay = await input.fetchVia(viaPoints);
  if (!stay || !reference || !validStay(stay, reference, memory, now)) {
    memory.recordNoEstimate(signature, now);
    return accept(true);
  }

  const savesMin = Math.round(stay.trafficMinutes - fresh.trafficMinutes);
  const bar = requiredSavingMinutes(stay.trafficMinutes);
  const kept = withCarriedBaseline(stay, committed);
  if (savesMin < bar) return { route: kept, meta: { outcome: "keep", savesMin, why: "below-bar" } };
  if (memory.isSuppressed(detour, savesMin, now))
    return { route: kept, meta: { outcome: "keep", savesMin, why: "declined" } };

  memory.recordProposal(detour, savesMin);
  const inStretch = (p: LatLon) => {
    if (!stretch) return true;
    const m = matchRoutePoint(p, remaining as LatLon[]);
    if (!m || m.distanceM > 100) return false;
    const at = distanceAlongPath(remaining, m.point);
    return at >= stretch.fromM - 200 && at <= stretch.toM + 200;
  };
  const reason = proposalReason(stay, inStretch);
  const msg = proposalMessage({ via: detour ?? via(fresh), savesMin, reason });
  return {
    route: fresh,
    meta: {
      outcome: "propose",
      savesMin,
      fromVia: via(committed),
      toVia: via(fresh),
      detour,
      reason,
      ...msg,
    },
  };
}

/** True when the route carries a reported road closure. */
function hasRoadClosure(route: Pick<RouteLike, "incidents">): boolean {
  return (route.incidents ?? []).some((i) => incidentCategoryLabel(i) === "Road closure");
}

/**
 * A priced "stay" route is only usable if it truly is the road she is on from
 * start to finish, and does not go through an exit she already turned down.
 */
function validStay(
  stay: RouteLike,
  reference: ReadonlyArray<LatLon>,
  memory: CommitmentMemory,
  now: number,
): boolean {
  if (stay.path.length < 2) return false;
  // Never keep her heading into a reported closure, even when TomTom prices it.
  if (hasRoadClosure(stay)) return false;
  if (declinedExitAhead(stay, memory, now) !== null) return false;
  return !differentCorridor(comparePaths(reference, stay.path));
}

async function resolveDeclined(input: ResolveInput): Promise<ResolveOutput> {
  const { fresh, rider, memory, now } = input;
  const declined = input.declined!;
  memory.recordDecline(declined.road, now);
  const road = roadWithoutDirection(declined.road);
  // If the fresh route no longer pushes the declined exit, it already continues on her road.
  let chosen: RouteLike | null = declinedExitAhead(fresh, memory, now) === null ? fresh : null;
  if (!chosen) {
    const exit = declinedExitAhead(fresh, memory, now);
    // Her road ahead comes from routes she was already given, never from her heading.
    const ahead = roadAheadFromHistory(
      input.roadHistory ?? [],
      rider,
      input.bearing,
      exit ? rampPointOf(fresh, exit) : null,
    );
    if (ahead) {
      memory.recordPriceAttempt(now);
      const stay = await input.fetchVia(ahead.via);
      if (
        stay &&
        validStay(stay, ahead.reference, memory, now) &&
        stay.trafficMinutes <= declined.remainingMin + STAY_MAX_EXTRA_MIN
      )
        chosen = stay;
    }
  }
  if (!chosen) return { route: fresh, meta: { outcome: "declined-fallback", road } };
  if (chosen !== fresh) chosen = withCarriedBaseline(chosen, input.committed);
  const plus = Math.round(chosen.trafficMinutes - declined.remainingMin);
  // Name the road she is ON, not the one she turned down.
  const onRoad =
    roadWithoutDirection(declined.onRoad) ?? roadWithoutDirection(chosen.corridorRoads[0] ?? null);
  const msg = stayingMessage(onRoad, Math.max(0, plus));
  return {
    route: chosen,
    meta: {
      outcome: "declined-stay",
      road: onRoad,
      plusMin: Math.max(0, plus),
      via: via(chosen),
      ...msg,
    },
  };
}

// ---- Declined-exit detection ------------------------------------------------

/** Distance along `path` from segment/point `a` to segment/point `b`. */
function alongBetween(path: ReadonlyArray<LatLon>, a: RouteMatch, b: RouteMatch): number {
  if (b.segmentIndex < a.segmentIndex) return -alongBetween(path, b, a);
  if (a.segmentIndex === b.segmentIndex) {
    const start = path[a.segmentIndex]!;
    return metersBetween(start, b.point) - metersBetween(start, a.point);
  }
  let total = metersBetween(a.point, path[a.segmentIndex + 1]!);
  for (let i = a.segmentIndex + 1; i < b.segmentIndex; i += 1)
    total += metersBetween(path[i]!, path[i + 1]!);
  total += metersBetween(path[b.segmentIndex]!, b.point);
  return total;
}

/**
 * Notices that the rider drove past an exit or ramp and stayed on her road.
 * A ramp runs beside the mainline for a long way, so the route line the app
 * draws (300 points) can't tell them apart: each exit carries its own
 * full-resolution `ahead` points. Past the exit point, 3 good fixes in a row
 * that are clearly apart from that ramp line say she did not take it:
 *   at speed:      more than 40 m away AND heading more than 35 degrees off it;
 *   slow/unknown:  more than 60 m away (heading is unreliable when crawling).
 * Taking a ramp slowly, or hugging its inside curve, stays well inside that.
 */
export class ExitDeclineWatcher {
  private streak = new Map<string, number>();
  private done = new Set<string>();

  reset() {
    this.streak.clear();
    this.done.clear();
  }

  observe(input: {
    maneuvers: Maneuver[];
    path: ReadonlyArray<LatLon>;
    match: RouteMatch | null;
    rider: LatLon;
    accuracyM: number | null;
    speedMps: number | null;
    heading: number | null;
  }): Maneuver | null {
    if (input.accuracyM !== null && input.accuracyM > DECLINE_MAX_ACCURACY_M) return null;
    for (const m of input.maneuvers) {
      if (!isExitLike(m)) continue;
      const key = `${m.lat.toFixed(4)},${m.lon.toFixed(4)}:${m.maneuver}`;
      if (this.done.has(key)) continue;
      const geometry = this.rampGeometry(m, input);
      if (!geometry) continue;
      const { beyondM, apartM, rampBearing } = geometry;
      if (beyondM > DECLINE_WATCH_BEYOND_M) {
        this.done.add(key);
        continue;
      }
      if (beyondM < DECLINE_MIN_BEYOND_M) {
        this.streak.delete(key);
        continue;
      }
      const atSpeed =
        input.heading !== null &&
        rampBearing !== null &&
        (input.speedMps ?? 0) >= DECLINE_HEADING_MIN_SPEED_MPS;
      const apart = atSpeed
        ? apartM > DECLINE_APART_M && angleDiff(rampBearing!, input.heading!) > DECLINE_HEADING_DEG
        : apartM > DECLINE_APART_SLOW_M;
      const count = apart ? (this.streak.get(key) ?? 0) + 1 : 0;
      this.streak.set(key, count);
      if (count >= DECLINE_CONFIRM_FIXES) {
        this.done.add(key);
        return m;
      }
    }
    return null;
  }

  /** How far beyond the exit point she is, how far from the ramp line, and the ramp's heading there. */
  private rampGeometry(
    m: Maneuver,
    input: { path: ReadonlyArray<LatLon>; match: RouteMatch | null; rider: LatLon },
  ): { beyondM: number; apartM: number; rampBearing: number | null } | null {
    // She must be past the exit on the route itself first (a loop ramp curls back
    // beside the road before the exit and must not read as "beyond").
    const { match, path } = input;
    const placed =
      match && path.length >= 2 ? placeManeuvers([m], path as LatLon[]).get(maneuverKey(m)) : null;
    if (!match || !placed) return null;
    if (alongBetween(path, placed, match) < 0) return { beyondM: 0, apartM: 0, rampBearing: null };
    if (m.ahead && m.ahead.length >= 2) {
      const line = [{ lat: m.lat, lon: m.lon }, ...m.ahead];
      const at = matchRoutePoint(input.rider, line);
      if (!at) return null;
      let beyond = 0;
      for (let i = 0; i < at.segmentIndex; i += 1) beyond += metersBetween(line[i]!, line[i + 1]!);
      beyond += metersBetween(line[at.segmentIndex]!, at.point);
      // Past the end of the stored ramp points the rider is simply further along.
      const last = line[line.length - 1]!;
      const pastEnd = at.segmentIndex >= line.length - 2 && metersBetween(at.point, last) < 1;
      return {
        beyondM: pastEnd ? DECLINE_WATCH_BEYOND_M + 1 : beyond,
        apartM: at.distanceM,
        rampBearing: at.bearing,
      };
    }
    // Older route without ramp points: fall back to the coarse route line.
    return {
      beyondM: alongBetween(path, placed, match),
      apartM: match.distanceM,
      rampBearing: match.bearing,
    };
  }
}

function angleDiff(a: number, b: number) {
  return Math.abs(((a - b + 540) % 360) - 180);
}

// ---- Background transit re-planning ------------------------------------------

/**
 * With nobody navigating, the planner minute may lag the live minute by at most this much.
 * Kept short on purpose: a longer hold lets a bus that already left look catchable
 * (the screen also drops departed trips against the live clock). 5 minutes applies only while navigating.
 */
export const IDLE_TRANSIT_REPLAN_MS = 60_000;

/**
 * The minute the transit planner searches from. Normally the live minute;
 * while a drive is being navigated it moves at most every 5 minutes, so the
 * planner (database load, fails on weak signal) is not re-run each minute.
 * Drive time and ETA come from their own queries and are unaffected.
 */
export function throttledPlanMinute(
  previous: { value: number; at: number } | null,
  liveSeconds: number,
  nowMs: number,
  navigating: boolean,
  /** Pass to also hold the idle trip screen: no re-plan while the tab is hidden, and at most one per minute. */
  idle?: { hidden: boolean },
): { value: number; at: number } {
  if (!previous || liveSeconds < previous.value) return { value: liveSeconds, at: nowMs };
  if (idle?.hidden) return previous;
  const holdMs = navigating ? NAV_TRANSIT_REPLAN_MS : idle ? IDLE_TRANSIT_REPLAN_MS : 0;
  return nowMs - previous.at >= holdMs ? { value: liveSeconds, at: nowMs } : previous;
}
