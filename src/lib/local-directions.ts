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

/** Route heading just after `point`, looking ~400 m ahead so a curving ramp reads steadily. */
export function routeBearingAfter(
  path: ReadonlyArray<LatLon>,
  point: LatLon,
  lookAheadM = LOOKAHEAD_M,
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
  if (metersBetween(match.point, to) < 20) return null;
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
 * Landmark wording for exits and streets riders know by where they lead.
 * Sources (no entries beyond these):
 *  - Salt Lake Blvd: Skyline park-and-ride guide ("from Salt Lake Boulevard",
 *    Aloha Stadium / Hālawa area) and src/lib/landmarks.ts (Hālawa -> Aloha Stadium).
 *  - H-1 exit 18A: named by Josh/NALU MAIN after the Oct 16 commute. Not yet
 *    confirmed against a recorded TomTom response.
 *  - H-1 exit 18B: TomTom response shape in src/lib/drive/corridor.test.ts
 *    (exitNumber "18B", street "Nimitz Hwy").
 */
export const LANDMARK_HINTS: Array<{ test: RegExp; toward: string }> = [
  { test: /\bexit\s+18\s?A\b/i, toward: "Nimitz Highway and Waikīkī" },
  { test: /\bexit\s+18\s?B\b/i, toward: "Nimitz Highway" },
  { test: /\bSalt Lake (?:Blvd|Boulevard)\b/i, toward: "Aloha Stadium and Salt Lake" },
];

export function landmarkTowardFor(...texts: Array<string | null | undefined>): string | null {
  const joined = texts.filter(Boolean).join(" ");
  for (const hint of LANDMARK_HINTS) if (hint.test.test(joined)) return hint.toward;
  return null;
}

/** Spoken/shown instruction in local wording. `routeBearing` is the heading after the maneuver. */
export function localizeInstruction(
  instruction: string,
  routeBearing: number | null,
  road: string | null = null,
): string {
  let out = dropContradictingDirection(tidyNimitz(tidyFreewayName(instruction)), routeBearing);
  const toward = landmarkTowardFor(out, road);
  if (toward && !/\btoward\b/i.test(out) && !/\bAloha Stadium\b/i.test(out)) {
    const trimmed = out.replace(/[.\s]+$/, "");
    out = `${trimmed} toward ${toward}`;
  }
  return out;
}

/** Road label for the nav HUD, in the same wording as the voice. */
export function localizeRoadLabel(road: string | null, routeBearing: number | null): string | null {
  if (!road) return road;
  return dropContradictingDirection(tidyNimitz(tidyFreewayName(road)), routeBearing);
}

/** HUD second line: the road, plus "toward ..." when Nalu knows where it leads. */
export function hudRoadLabel(maneuver: { road: string | null; instruction: string }): string {
  const base = maneuver.road ?? maneuver.instruction;
  const toward = landmarkTowardFor(maneuver.instruction, maneuver.road);
  if (!toward || /\btoward\b/i.test(base)) return base;
  return `${base} · toward ${toward}`;
}
