/** Turn-by-turn helpers: which maneuver is next and when to speak it. */
export type Maneuver = {
  lat: number;
  lon: number;
  /** TomTom maneuver code, e.g. TURN_LEFT, MOTORWAY_EXIT_RIGHT, ARRIVE. */
  maneuver: string;
  instruction: string;
  road: string | null;
};

export const FAR_ANNOUNCE_M = 805; // ~0.5 mile
export const NEAR_ANNOUNCE_M = 91; // ~300 ft
export const PASSED_M = 30;

export type RouteMatch = {
  point: { lat: number; lon: number };
  segmentIndex: number;
  distanceM: number;
  bearing: number;
};

export function metersBetween(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const r = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(h));
}

/** Stable across route refreshes: the same physical turn keeps the same key. */
export function maneuverKey(m: Maneuver) {
  return `${m.lat.toFixed(4)},${m.lon.toFixed(4)}:${m.maneuver}`;
}

/**
 * The next maneuver not yet passed. A maneuver counts as passed once the
 * driver came within PASSED_M of it; `passed` persists across refreshes.
 */
export function nextManeuver(
  position: { lat: number; lon: number },
  maneuvers: Maneuver[],
  passed: Set<string>,
): { maneuver: Maneuver; distanceM: number } | null {
  for (const m of maneuvers) {
    if (passed.has(maneuverKey(m))) continue;
    const distanceM = metersBetween(position, m);
    if (distanceM <= PASSED_M && m.maneuver !== "ARRIVE") {
      passed.add(maneuverKey(m));
      continue;
    }
    return { maneuver: m, distanceM };
  }
  return null;
}

/** Returns a phrase to speak once per maneuver per threshold, or null. */
export function announcementFor(
  next: { maneuver: Maneuver; distanceM: number },
  spoken: Set<string>,
): string | null {
  const key = maneuverKey(next.maneuver);
  const instruction = next.maneuver.instruction.replace(/\.$/, "");
  if (next.distanceM <= NEAR_ANNOUNCE_M) {
    if (spoken.has(`${key}:near`)) return null;
    spoken.add(`${key}:near`);
    spoken.add(`${key}:far`);
    return next.maneuver.maneuver === "ARRIVE"
      ? "You have arrived at your destination."
      : `In 300 feet, ${lowerFirst(instruction)}.`;
  }
  if (next.distanceM <= FAR_ANNOUNCE_M && next.distanceM > NEAR_ANNOUNCE_M * 2) {
    if (spoken.has(`${key}:far`)) return null;
    spoken.add(`${key}:far`);
    return `In half a mile, ${lowerFirst(instruction)}.`;
  }
  return null;
}

function lowerFirst(value: string) {
  return value ? value.charAt(0).toLowerCase() + value.slice(1) : value;
}

export type TurnGlyph =
  | "left"
  | "right"
  | "slight-left"
  | "slight-right"
  | "uturn"
  | "straight"
  | "arrive"
  | "roundabout";

export function turnGlyph(code: string): TurnGlyph {
  if (code === "ARRIVE" || code.startsWith("ARRIVE")) return "arrive";
  if (code.includes("ROUNDABOUT")) return "roundabout";
  if (code.includes("U_TURN") || code.includes("UTURN")) return "uturn";
  if (/(KEEP|BEAR|EXIT|SLIGHT)_?.*LEFT|LEFT_.*(EXIT|RAMP)/.test(code) && !code.startsWith("TURN_"))
    return "slight-left";
  if (
    /(KEEP|BEAR|EXIT|SLIGHT)_?.*RIGHT|RIGHT_.*(EXIT|RAMP)/.test(code) &&
    !code.startsWith("TURN_")
  )
    return "slight-right";
  if (code.includes("LEFT")) return "left";
  if (code.includes("RIGHT")) return "right";
  return "straight";
}

/** Heading for a heading-up map that does not spin while stopped. */
export function bearingBetween(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const toRad = Math.PI / 180;
  const y = Math.sin((b.lon - a.lon) * toRad) * Math.cos(b.lat * toRad);
  const x =
    Math.cos(a.lat * toRad) * Math.sin(b.lat * toRad) -
    Math.sin(a.lat * toRad) * Math.cos(b.lat * toRad) * Math.cos((b.lon - a.lon) * toRad);
  return (Math.atan2(y, x) / toRad + 360) % 360;
}

export function angleDifference(a: number, b: number) {
  return Math.abs(((a - b + 540) % 360) - 180);
}

export type RouteDeviation = {
  crossTrackM: number;
  headingDivergence: number | null;
  divergentFixes: number;
  offRoute: boolean;
};

/** ~45 mph: at or above this the rider is on a freeway (H-1, H-2, H-201, H-3). */
export const FREEWAY_SPEED_MPS = 20;

/**
 * Navigation-grade route deviation state.
 * Local streets: >45 m drift, or >60° divergence on 2 fixes.
 * Freeways: lanes, ramps and viaduct multipath drift a lot, so BOTH >80 m
 * drift AND >35° divergence sustained over 3 fixes are required. A gross
 * drift (>250 m) is always off-route.
 */
export function routeDeviation(
  match: RouteMatch | null,
  heading: number | null,
  previousDivergentFixes = 0,
  speedMps: number | null = null,
): RouteDeviation {
  const crossTrackM = match?.distanceM ?? Infinity;
  const freeway = (speedMps ?? 0) >= FREEWAY_SPEED_MPS;
  const headingDivergence =
    match && heading !== null ? angleDifference(match.bearing, heading) : null;
  const limit = freeway ? 35 : 60;
  const divergentFixes =
    headingDivergence !== null && headingDivergence > limit ? previousDivergentFixes + 1 : 0;
  const offRoute = freeway
    ? crossTrackM > 250 || (crossTrackM > 80 && divergentFixes >= 3)
    : crossTrackM > 45 || divergentFixes >= 2;
  return { crossTrackM, headingDivergence, divergentFixes, offRoute };
}

/** Keep the snapped vehicle point and only the route still ahead. */
export function trimRoutePath(path: RouteMatch["point"][], match: RouteMatch | null) {
  if (!match || path.length < 2 || match.segmentIndex < 0 || match.segmentIndex >= path.length - 1)
    return path;
  return [match.point, ...path.slice(match.segmentIndex + 1)];
}

/**
 * Match a GPS fix to a forward section of the route. The small backward
 * allowance handles noisy fixes without jumping to a nearby opposing ramp.
 */
export function matchRoutePoint(
  point: { lat: number; lon: number },
  path: Array<{ lat: number; lon: number }>,
  previousIndex: number | null = null,
  heading: number | null = null,
): RouteMatch | null {
  if (path.length < 2) return null;
  const start = previousIndex === null ? 0 : Math.max(0, previousIndex - 3);
  const end =
    previousIndex === null ? path.length - 1 : Math.min(path.length - 1, previousIndex + 220);
  const latScale = 111_320;
  const lonScale = Math.cos((point.lat * Math.PI) / 180) * latScale;
  let best: RouteMatch | null = null;
  let bestScore = Infinity;

  for (let i = start; i < end; i += 1) {
    const a = path[i];
    const b = path[i + 1];
    if (!a || !b) continue;
    const ax = (a.lon - point.lon) * lonScale;
    const ay = (a.lat - point.lat) * latScale;
    const bx = (b.lon - point.lon) * lonScale;
    const by = (b.lat - point.lat) * latScale;
    const dx = bx - ax;
    const dy = by - ay;
    const lengthSq = dx * dx + dy * dy;
    const t = lengthSq > 0 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / lengthSq)) : 0;
    const x = ax + dx * t;
    const y = ay + dy * t;
    const distanceM = Math.hypot(x, y);
    const segmentBearing = bearingBetween(a, b);
    const headingPenalty =
      heading === null ? 0 : Math.max(0, angleDifference(segmentBearing, heading) - 50) * 1.8;
    const backwardPenalty =
      previousIndex !== null && i < previousIndex ? (previousIndex - i) * 12 : 0;
    const score = distanceM + headingPenalty + backwardPenalty;
    if (score >= bestScore) continue;
    bestScore = score;
    best = {
      point: {
        lat: point.lat + y / latScale,
        lon: point.lon + x / lonScale,
      },
      segmentIndex: i,
      distanceM,
      bearing: segmentBearing,
    };
  }
  return best;
}

/** Ignore very uncertain fixes and impossible jumps before they affect routing. */
export function isUsableNavigationFix(
  previous: { point: { lat: number; lon: number }; timestamp: number } | null,
  next: { point: { lat: number; lon: number }; timestamp: number; accuracy: number },
) {
  if (!Number.isFinite(next.accuracy) || next.accuracy > 55) return false;
  if (!previous) return true;
  const elapsedSeconds = Math.max(1, (next.timestamp - previous.timestamp) / 1000);
  return metersBetween(previous.point, next.point) / elapsedSeconds < 75;
}

export function smoothBearing(
  previous: number | null,
  input: {
    gpsHeading: number | null;
    speedMps: number | null;
    from: { lat: number; lon: number } | null;
    to: { lat: number; lon: number };
  },
): number | null {
  const moved = input.from ? metersBetween(input.from, input.to) : 0;
  const slow = (input.speedMps ?? (moved > 0 ? 2 : 0)) < 1.5;
  // Stopped at a light or crawling: keep the last good bearing.
  if (slow && moved < 8) return previous;
  const raw =
    typeof input.gpsHeading === "number" && !Number.isNaN(input.gpsHeading) && !slow
      ? input.gpsHeading
      : input.from && moved >= 8
        ? bearingBetween(input.from, input.to)
        : null;
  if (raw === null) return previous;
  if (previous === null) return raw;
  const delta = ((raw - previous + 540) % 360) - 180;
  return (previous + delta * 0.4 + 360) % 360;
}

// ---------- Route-versioned voice guidance ----------

export type ManeuverVoiceState = "unannounced" | "far_spoken" | "mid_spoken" | "near_spoken" | "passed";
/** Minimum gap between non-urgent prompts so CarPlay/background audio isn't chopped. */
export const VOICE_COOLDOWN_MS = 12000;
export const VOICE_STABILIZE_MS = 3000;
export const SAFETY_BYPASS_M = 46; // ~150 ft

type Tier = { state: ManeuverVoiceState; atM: number; phrase: string };

export type NavigationRoadType = "freeway" | "local";

export type NavigationManeuverContext = {
  speedMps?: number | null;
  roadType?: NavigationRoadType;
};

/**
 * Keep announcement timing deterministic, but use the context we actually
 * know: road type, current speed and maneuver complexity.
 *
 * Freeway exits/splits need more lead time. Slow freeway traffic gets a
 * shorter window so Nalu does not announce a turn absurdly early while the
 * driver is crawling. Complex local maneuvers get an earlier first cue.
 */
export function navigationRoadType(
  maneuver: Maneuver,
  speedMps: number | null = null,
): NavigationRoadType {
  const text = [maneuver.road ?? "", maneuver.instruction, maneuver.maneuver]
    .join(" ")
    .toLowerCase();
  const freewayName =
    /(^|\b)(h[- ]?1|h[- ]?2|h[- ]?3|h[- ]?201|moanalua freeway|pali highway|likelike highway|kalanianaole highway)(\b|$)/i.test(
      text,
    );
  if (freewayName) return "freeway";
  return (speedMps ?? 0) >= FREEWAY_SPEED_MPS ? "freeway" : "local";
}

function isComplexManeuver(maneuver: Maneuver) {
  return /EXIT|RAMP|ROUNDABOUT|UTURN|U_TURN|FORK|MERGE|KEEP|BEAR|MOTORWAY/i.test(
    maneuver.maneuver,
  );
}

/** Announcement tiers scale with the maneuver context, not speed alone. */
export function announcementTiers(
  speedMps: number | null,
  maneuver?: Maneuver,
  roadType?: NavigationRoadType,
): Tier[] {
  const type = roadType ?? (maneuver ? navigationRoadType(maneuver, speedMps) : "local");
  const slowFreeway = type === "freeway" && (speedMps ?? 0) < 10;
  if (type === "freeway") {
    const complex = maneuver ? isComplexManeuver(maneuver) : true;
    const far = slowFreeway ? 900 : complex ? 1350 : 1200;
    const mid = slowFreeway ? 450 : complex ? 700 : 600;
    const near = slowFreeway ? 220 : complex ? 275 : 250;
    return [
      { state: "far_spoken", atM: far, phrase: far >= 1200 ? "In three quarters of a mile" : "In half a mile" },
      { state: "mid_spoken", atM: mid, phrase: mid >= 600 ? "In a third of a mile" : "In a quarter mile" },
      { state: "near_spoken", atM: near, phrase: near >= 250 ? "In 800 feet" : "In 700 feet" },
    ];
  }
  const complex = maneuver ? isComplexManeuver(maneuver) : false;
  return [
    { state: "far_spoken", atM: complex ? 900 : FAR_ANNOUNCE_M, phrase: complex ? "In a half mile" : "In half a mile" },
    { state: "near_spoken", atM: complex ? 120 : NEAR_ANNOUNCE_M, phrase: complex ? "In 400 feet" : "In 300 feet" },
  ];
}
const ORDER: ManeuverVoiceState[] = ["unannounced", "far_spoken", "mid_spoken", "near_spoken", "passed"];

/**
 * The distance as a driver would say it, from the real distance at the moment
 * Nalu speaks. Tiers decide *when* to speak; this decides *what* distance to
 * say, so a cue that fires late (after a previous turn, at trip start, or once
 * GPS settles) never claims "half a mile" for a turn 300 m away.
 */
export function spokenDistance(distanceM: number): string {
  const feet = distanceM * 3.281;
  if (distanceM < 305) return `In ${Math.max(100, Math.round(feet / 100) * 100)} feet`;
  // Midpoints between a quarter (402 m), half (805 m) and three quarters (1,207 m) of a mile.
  if (distanceM < 600) return "In a quarter mile";
  if (distanceM < 1000) return "In half a mile";
  if (distanceM < 1450) return "In three quarters of a mile";
  const miles = Math.round(distanceM / 1609);
  return miles <= 1 ? "In 1 mile" : `In ${miles} miles`;
}

const PHONETIC: Array<[RegExp, string]> = [
  // Strip technical codes TomTom sometimes appends: "(7110)", "[HI-93A]", "#12".
  [/\s*[([][^)\]]*\d[^)\]]*[)\]]/g, ""],
  [/\s*#\d+\w*/g, ""],
  [/\bH-?201\b/gi, "Moanalua Freeway"],
  [/\bH-?1\b/gi, "H 1"],
  [/\bH-?2\b/gi, "H 2"],
  [/\bH-?3\b/gi, "H 3"],
  [/\bHI-?(\d+)\b/gi, "Hawaii $1"],
  [/\bFt\.?\s/gi, "Fort "],
  [/\bRd\b\.?/gi, "Road"],
  [/\bSt\b\.?/gi, "Street"],
  [/\bAve\b\.?/gi, "Avenue"],
  [/\bBlvd\b\.?/gi, "Boulevard"],
  [/\bHwy\b\.?/gi, "Highway"],
  [/\bFwy\b\.?/gi, "Freeway"],
  [/\bPkwy\b\.?/gi, "Parkway"],
  [/\bDr\b\.?/gi, "Drive"],
  [/\bPl\b\.?/gi, "Place"],
  [/\bLn\b\.?/gi, "Lane"],
  [/\bW\b(?!-)/g, "West"],
  [/\bE\b(?!-)/g, "East"],
  [/\bN\b(?!-)/g, "North"],
  [/\bS\b(?!-)/g, "South"],
  [/\bWB\b/g, "West"],
  [/\bEB\b/g, "East"],
];

/** Make Oʻahu road abbreviations sound right through speech synthesis. */
export function speakableRoad(text: string) {
  let out = text;
  for (const [pattern, replacement] of PHONETIC) out = out.replace(pattern, replacement);
  return out.replace(/\s+([,.])/g, "$1").replace(/\s{2,}/g, " ").trim();
}

/**
 * What Nalu says the moment turn-by-turn starts, like Google and Apple Maps:
 * where it's going and the first direction. Confirms the voice is on.
 */
export function startRoutePhrase(
  destination: string | null | undefined,
  next: { maneuver: Maneuver; distanceM: number } | null,
): string {
  const place = (destination ?? "").split(",")[0]?.trim() ?? "";
  const opening = !place
    ? "Starting route."
    : /^home$/i.test(place)
      ? "Starting route home."
      : `Starting route to ${speakableRoad(place)}.`;
  if (!next || next.maneuver.maneuver.startsWith("ARRIVE")) return opening;
  const instruction = speakableRoad(next.maneuver.instruction.replace(/\.$/, ""));
  if (!instruction) return opening;
  const first = instruction.charAt(0).toUpperCase() + instruction.slice(1);
  // A first step right where you are ("Head east on…") needs no distance.
  return next.distanceM < 60
    ? `${opening} ${first}.`
    : `${opening} ${spokenDistance(next.distanceM)}, ${lowerFirst(instruction)}.`;
}

/** A route's version changes whenever the maneuver list changes (reroute). */
export function routeVersion(maneuvers: Maneuver[]) {
  return maneuvers.map(maneuverKey).join("|");
}

export class VoiceGuide {
  version = "";
  states = new Map<string, ManeuverVoiceState>();
  lastSpokenAt = -Infinity;
  firstSeenAt: number | null = null;
  lastTier: ManeuverVoiceState | null = null;
  constructor(private opts: { stabilizeMs?: number; cooldownMs?: number } = {}) {}

  sync(maneuvers: Maneuver[]) {
    const v = routeVersion(maneuvers);
    if (v === this.version) return false;
    this.version = v;
    this.states = new Map(maneuvers.map((m) => [maneuverKey(m), "unannounced"]));
    return true;
  }

  state(m: Maneuver): ManeuverVoiceState {
    return this.states.get(maneuverKey(m)) ?? "unannounced";
  }

  /**
   * The start announcement already said this maneuver: skip the tiers we're
   * already inside so it isn't repeated seconds later.
   */
  markStartAnnounced(next: { maneuver: Maneuver; distanceM: number }, now = Date.now()) {
    let reached: ManeuverVoiceState | null = null;
    for (const tier of announcementTiers(null, next.maneuver))
      if (next.distanceM <= tier.atM && tier.state !== "near_spoken") reached = tier.state;
    if (reached) this.states.set(maneuverKey(next.maneuver), reached);
    this.lastSpokenAt = now;
  }

  markPassed(m: Maneuver) {
    this.states.set(maneuverKey(m), "passed");
  }

  /**
   * Returns a phrase to speak or null. Each tier is spoken at most once per
   * maneuver; state only advances forward. Silent while rerouting.
   */
  next(
    next: { maneuver: Maneuver; distanceM: number },
    now = Date.now(),
    ctx: {
      speedMps?: number | null;
      rerouting?: boolean;
      gpsAccuracyM?: number | null;
      fixAgeMs?: number | null;
    } = {},
  ): string | null {
    if (this.firstSeenAt === null) this.firstSeenAt = now;
    if (now - this.firstSeenAt < (this.opts.stabilizeMs ?? VOICE_STABILIZE_MS)) return null;
    if (ctx.rerouting) return null;
    // Voice should not become more confident than the navigation fix itself.
    // Keep visual navigation alive, but stay silent when GPS quality is too
    // poor or the accepted fix is stale.
    if (ctx.gpsAccuracyM !== null && ctx.gpsAccuracyM !== undefined && ctx.gpsAccuracyM > 40) return null;
    if (ctx.fixAgeMs !== null && ctx.fixAgeMs !== undefined && ctx.fixAgeMs > 5_000) return null;
    const key = maneuverKey(next.maneuver);
    const current = this.state(next.maneuver);
    if (current === "passed" || current === "near_spoken") return null;
    const speedMps = ctx.speedMps ?? null;
    // Do not spend a turn announcement while stopped. The maneuver remains
    // unspoken and will be evaluated again as soon as the vehicle moves.
    if (speedMps !== null && speedMps < 1.5) return null;
    const tiers = announcementTiers(speedMps, next.maneuver);
    // Deepest tier whose threshold we're inside, but only if it is beyond the current state.
    let tier: Tier | null = null;
    for (const t of tiers) if (next.distanceM <= t.atM) tier = t;
    if (!tier || ORDER.indexOf(tier.state) <= ORDER.indexOf(current)) return null;
    // Skip a stale earlier tier when we're already much closer (e.g. far tier at 300 m).
    const idx = tiers.indexOf(tier);
    const deeper = tiers[idx + 1];
    if (deeper && next.distanceM <= deeper.atM * 1.5 && tier.state !== "near_spoken") return null;
    const instruction = speakableRoad(next.maneuver.instruction.replace(/\.$/, ""));
    const isArrival = next.maneuver.maneuver === "ARRIVE" || next.maneuver.maneuver.startsWith("ARRIVE");
    const phrase =
      tier.state === "near_spoken" && isArrival
        ? "You have arrived at your destination."
        : isArrival
          ? `${spokenDistance(next.distanceM)}, you'll arrive at your destination.`
          : `${spokenDistance(next.distanceM)}, ${lowerFirst(instruction)}.`;
    const safety = tier.state === "near_spoken" && next.distanceM < SAFETY_BYPASS_M;
    if (!safety && now - this.lastSpokenAt < (this.opts.cooldownMs ?? VOICE_COOLDOWN_MS)) return null;
    this.states.set(key, tier.state);
    this.lastSpokenAt = now;
    this.lastTier = tier.state;
    return phrase;
  }
}
