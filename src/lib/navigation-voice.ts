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

export type TurnGlyph = "left" | "right" | "slight-left" | "slight-right" | "uturn" | "straight" | "arrive" | "roundabout";

export function turnGlyph(code: string): TurnGlyph {
  if (code === "ARRIVE" || code.startsWith("ARRIVE")) return "arrive";
  if (code.includes("ROUNDABOUT")) return "roundabout";
  if (code.includes("U_TURN") || code.includes("UTURN")) return "uturn";
  if (/(KEEP|BEAR|EXIT|SLIGHT)_?.*LEFT|LEFT_.*(EXIT|RAMP)/.test(code) && !code.startsWith("TURN_"))
    return "slight-left";
  if (/(KEEP|BEAR|EXIT|SLIGHT)_?.*RIGHT|RIGHT_.*(EXIT|RAMP)/.test(code) && !code.startsWith("TURN_"))
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
