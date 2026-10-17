/**
 * Local wording for turn-by-turn text, applied to TomTom's instructionMessage
 * and road labels before they reach the voice or the nav HUD. Wording only:
 * it never changes where a maneuver is or which road the route uses.
 */
import {
  angleDifference,
  bearingBetween,
  matchRoutePoint,
  metersBetween,
} from "./navigation-voice";

type LatLon = { lat: number; lon: number };

const CARDINAL_BEARING: Record<string, number> = {
  n: 0,
  north: 0,
  nb: 0,
  northbound: 0,
  e: 90,
  east: 90,
  eb: 90,
  eastbound: 90,
  s: 180,
  south: 180,
  sb: 180,
  southbound: 180,
  w: 270,
  west: 270,
  wb: 270,
  westbound: 270,
};

/** A stated direction further than this from the real heading is wrong, so it is dropped. */
export const DIRECTION_CONTRADICTION_DEG = 60;
const LOOKAHEAD_M = 400;
/** Heading used to judge a road label: well along the new road, past any loop ramp. */
export const LABEL_LOOKAHEAD_M = 2000;
export const LABEL_MIN_AHEAD_M = 800;

/** Route heading just after `point`, looking ~400 m ahead so a curving ramp reads steadily. */
export function routeBearingAfter(
  path: ReadonlyArray<LatLon>,
  point: LatLon,
  lookAheadM = LOOKAHEAD_M,
  /** Return null unless at least this much route lies ahead (too little is a ramp's curve, not a heading). */
  minAheadM = 0,
): number | null {
  if (path.length < 2) return null;
  const match = matchRoutePoint(point, path as LatLon[]);
  if (!match || match.distanceM > 80) return null;
  let travelled = 0;
  let from: LatLon = match.point;
  let to: LatLon = path[match.segmentIndex + 1]!;
  for (let i = match.segmentIndex + 1; i < path.length; i += 1) {
    const next = path[i]!;
    travelled += metersBetween(from, next);
    to = next;
    from = next;
    if (travelled >= lookAheadM) break;
  }
  if (metersBetween(match.point, to) < 20 || travelled < minAheadM) return null;
  return bearingBetween(match.point, to);
}

const ROAD_WORD =
  "Fwy|Freeway|Hwy|Highway|Expressway|Expy|Pkwy|Parkway|Rd|Road|St|Street|Blvd|Boulevard|Ave|Avenue|H-?\\d{1,3}";
const TRAILING_DIRECTION = new RegExp(
  `\\b(${ROAD_WORD})\\.?\\s+(Eastbound|Westbound|Northbound|Southbound|East|West|North|South|EB|WB|NB|SB|E|W|N|S)\\b(?![-\\w])`,
  "gi",
);

/** Say "H-1", never "I-H1" or "the I-H1". */
export function tidyFreewayName(text: string): string {
  return text
    .replace(/\b(?:the\s+)?(?:Interstate\s+(?:Highway\s+)?)?I-?H-?(\d{1,3})\b/gi, "H-$1")
    .replace(/\b(?:the\s+)?Interstate\s+(?:Highway\s+)?H-?(\d{1,3})\b/gi, "H-$1");
}

/** "North Nimitz Hwy" and "N Nimitz Hwy" are both just Nimitz; same everywhere. */
export function tidyNimitz(text: string): string {
  return text.replace(/\b(?:North|South|East|West|N|S|E|W)\.?\s+(?=Nimitz\b)/gi, "");
}

/**
 * Drops an East/West/North/South after a road name when it contradicts the
 * route's own heading ("Moanalua Fwy West" while driving east). With no
 * heading to check against, the provider's wording stays.
 */
export function dropContradictingDirection(text: string, routeBearing: number | null): string {
  if (routeBearing === null) return text;
  return text
    .replace(TRAILING_DIRECTION, (whole, road: string, dir: string) => {
      const stated = CARDINAL_BEARING[dir.toLowerCase()];
      if (stated === undefined) return whole;
      return angleDifference(stated, routeBearing) > DIRECTION_CONTRADICTION_DEG ? road : whole;
    })
    .replace(/\s{2,}/g, " ");
}

/**
 * Landmark hints for the nav HUD label only (never spoken, never changing the
 * instruction): TomTom already speaks its own "toward ..." and we can't verify
 * which direction of travel each hint holds for. A hint is skipped when its
 * road already appears in the label or instruction. Sources (no other entries):
 *  - Salt Lake Blvd: Skyline park-and-ride guide ("from Salt Lake Boulevard",
 *    Aloha Stadium / Hālawa area) and src/lib/landmarks.ts.
 *  - H-1 exit 18B: TomTom response shape in src/lib/drive/corridor.test.ts
 *    (exitNumber "18B", street "Nimitz Hwy").
 *  Exit 18A was dropped: unverified.
 */
export const LANDMARK_HINTS: Array<{ test: RegExp; toward: string; skipIfMentions: RegExp }> = [
  { test: /\bexit\s+18\s?B\b/i, toward: "Nimitz Highway", skipIfMentions: /Nimitz/i },
  {
    test: /\bSalt Lake (?:Blvd|Boulevard)\b/i,
    toward: "Aloha Stadium and Salt Lake",
    skipIfMentions: /Aloha Stadium/i,
  },
];

export function landmarkTowardFor(...texts: Array<string | null | undefined>): string | null {
  const joined = texts.filter(Boolean).join(" ");
  for (const hint of LANDMARK_HINTS) {
    if (!hint.test.test(joined)) continue;
    if (hint.skipIfMentions.test(joined)) return null;
    return hint.toward;
  }
  return null;
}

/**
 * Spoken/shown instruction in local wording. Direction words (East/West) are
 * never removed here: at a loop ramp "onto H-1 West" is what the driver needs.
 */
export function localizeInstruction(instruction: string): string {
  return tidyNimitz(tidyFreewayName(instruction));
}

/**
 * Road label for the nav HUD. A stated direction is dropped only when it
 * contradicts the heading measured well along the new road (`labelBearing`).
 */
export function localizeRoadLabel(road: string | null, labelBearing: number | null): string | null {
  if (!road) return road;
  return dropContradictingDirection(tidyNimitz(tidyFreewayName(road)), labelBearing);
}

/** HUD lines: the road, and on its own line where it leads when Nalu knows. */
export function hudRoadLabel(maneuver: { road: string | null; instruction: string }): {
  road: string;
  toward: string | null;
} {
  const road = maneuver.road ?? maneuver.instruction;
  return { road, toward: landmarkTowardFor(maneuver.instruction, maneuver.road) };
}
