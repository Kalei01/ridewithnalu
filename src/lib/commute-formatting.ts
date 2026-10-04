/**
 * Shared display formatting for Nalu: Honolulu time, Oʻahu place names,
 * distances, and transit stop labels. Pure functions only — no React, no
 * network, no storage — so the main screen and extracted components can
 * import them freely.
 */

import { regionTimeZone } from "@/lib/region";

export type Coords = { lat: number; lon: number };

/** Structural shape of a trip leg needed for stop naming; matches the app's Leg type. */
export type TransitLegNameSource = {
  mode: "walk" | "drive" | "bus" | "rail";
  from: string | null;
  to: string | null;
};

/** Straight-line metros between two points; good enough to tell "am I there yet". */
export function distanceM(a: Coords, b: Coords) {
  const toRad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * toRad;
  const dLon = (b.lon - a.lon) * toRad;
  const mid = ((a.lat + b.lat) / 2) * toRad;
  const x = dLon * Math.cos(mid);
  return Math.sqrt(dLat * dLat + x * x) * 6371000;
}

export function honoluluParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: regionTimeZone(),
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })
    .format(date)
    .split(":")
    .map(Number);
  return { hour: parts[0] ?? 0, minute: parts[1] ?? 0, second: parts[2] ?? 0 };
}

export function honoluluSeconds(date: Date) {
  const { hour, minute, second } = honoluluParts(date);
  return hour * 3600 + minute * 60 + second;
}

export function honoluluIsoDow(date: Date) {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: regionTimeZone(),
    weekday: "short",
  }).format(date);
  const order = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  return order.indexOf(weekday) + 1;
}

export function honoluluDateKey(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: regionTimeZone(),
    dateStyle: "short",
  }).format(date);
}

export function clockFromSeconds(seconds: number | null | undefined) {
  if (seconds === null || seconds === undefined) return "—";
  const total = ((seconds % 86400) + 86400) % 86400;
  const hour24 = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const suffix = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${hour12}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

export function alohaGreeting(_date: Date, name?: string) {
  return name ? `Aloha, ${name}` : "Aloha";
}

/**
 * Title case that respects the 'okina: a letter after ' or ʻ stays lowercase,
 * so KUALAKA'I reads Kualaka'i and never Kualaka'I.
 */
export function titleCase(value: string | null | undefined) {
  if (!value) return "";
  return expandName(value)
    .toLowerCase()
    .replace(
      /(^|[\s\-/&(.])([a-z\u02bb\u2018'])/g,
      (_match, lead: string, letter: string) => lead + letter.toUpperCase(),
    )
    .replace(
      /([\u02bb\u2018'])([A-Z])/g,
      (_match, mark: string, letter: string) => mark + letter.toLowerCase(),
    );
}

/** GTFS ships abbreviations; spell them out for reading, database untouched. */
const ABBREVIATIONS: Array<[RegExp, string]> = [
  [/\bTRN\s+CTR\b/gi, "Transit Center"],
  [/\bTRANSIT\s+CTR\b/gi, "Transit Center"],
  [/\bCOMM\s+COLL\b/gi, "Community College"],
  [/\bHWY\b/gi, "Highway"],
  [/\bSTN\b/gi, "Station"],
  [/\bINTL\b/gi, "International"],
  [/\bOPP\b/gi, "Opposite"],
  [/\bJCT\b/gi, "Junction"],
  [/\bCTR\b/gi, "Center"],
  [/\bPK\b/gi, "Park"],
];

export function expandName(value: string | null | undefined) {
  if (!value) return "";
  let out = value;
  for (const [pattern, replacement] of ABBREVIATIONS) out = out.replace(pattern, replacement);
  return out;
}

/** Rail names on the Skyline screen: expanded, with the redundant suffix gone. */
export function stationLabel(value: string | null | undefined) {
  const expanded = expandName(value)
    .replace(/\s*\bSkyline\b\s*(Station)?\s*$/i, "")
    .replace(/\s*\bStation\b\s*$/i, "");
  return titleCase(expanded.trim() || expandName(value));
}

/** Full line endpoint: remove the redundant brand while retaining useful place type. */
export function terminusLabel(value: string | null | undefined) {
  const expanded = expandName(value)
    .replace(/\bSkyline\b\s*/gi, "")
    .replace(/\bTransit Center Station\b/gi, "Transit Center");
  return titleCase(expanded.trim());
}

/** US customary distance: feet under 0.1 miles, otherwise miles to one decimal. */
export function formatDistance(meters: number) {
  const miles = meters / 1609.344;
  if (miles < 0.1) return `${Math.round((meters * 3.28084) / 10) * 10} ft`;
  return `${miles.toFixed(1)} miles`;
}

/** Walking estimate at 3 mph, matching the trip planner's access-leg pace. */
export function walkingEstimate(from: Coords, to: Coords) {
  const meters = distanceM(from, to);
  return { meters, minutes: Math.max(1, Math.ceil(meters / 80.47)) };
}

export function directionLabel(value: string | null) {
  if (!value) return "";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function transitStopName(leg: TransitLegNameSource, endpoint: "from" | "to") {
  const value = leg[endpoint];
  if (leg.mode === "rail") {
    const station = stationLabel(value);
    return station ? `${station} Station` : "the station";
  }
  return titleCase(value) || "the stop";
}
