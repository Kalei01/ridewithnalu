import { localRoadName, routeCodeName } from "../traffic-incidents";

export type GuidanceInstruction = {
  routeOffsetInMeters?: number;
  street?: string;
  roadNumbers?: string[];
  maneuver?: string;
};

export type RouteCorridor = {
  /** Short, bold headline: "Via Kualakaʻi Pkwy → H-1 East". */
  label: string;
  /** Ordered road names that carry most of the drive. */
  roads: string[];
  /** Every road the route touches, however briefly. */
  allRoads: string[];
};

/**
 * The name to show for one guidance step. The route codes are the trustworthy
 * signal: the feed's street text mislabels the Ewa side of H-1 exit 5A as
 * "Kunia Rd" even though its codes say HI-76, which every local knows as Fort
 * Weaver Rd. So when a step carries a code we recognise, that name wins; the
 * street name is used only for roads with no known code.
 */
export function stepRoadName(step: GuidanceInstruction): string | null {
  for (const code of step.roadNumbers ?? []) {
    const mapped = routeCodeName(code);
    if (mapped) return mapped;
  }
  const street = step.street?.trim();
  if (street) return localRoadName(street);
  return localRoadName(step.roadNumbers?.[0] ?? null);
}

/** Route codes of a step, normalised so two steps can be compared. */
function stepCodes(step: GuidanceInstruction): Set<string> {
  const out = new Set<string>();
  for (const code of step.roadNumbers ?? []) {
    const normalised = code.replace(/[^a-z0-9]/gi, "").toLowerCase();
    if (normalised) out.add(normalised);
  }
  return out;
}

/**
 * Exit ramps often arrive under one code and continue under another. When a step
 * shares a code with the step after it, treat them as the same road so a short
 * ramp never gets announced as its own corridor.
 */
function mergeRampNames(instructions: GuidanceInstruction[], names: Array<string | null>) {
  for (let index = names.length - 2; index >= 0; index -= 1) {
    const current = names[index];
    const next = names[index + 1];
    if (!current || !next || current === next) continue;
    const codes = stepCodes(instructions[index]!);
    if (!codes.size) continue;
    const nextCodes = stepCodes(instructions[index + 1]!);
    if ([...codes].some((code) => nextCodes.has(code))) names[index] = next;
  }
}

/** East/West suffix for freeways, derived from the trip's own geometry. */
function freewayDirection(fromLon: number, toLon: number): "East" | "West" {
  return toLon >= fromLon ? "East" : "West";
}

/**
 * The direction the routing feed itself states, when it states one. TomTom often
 * labels the carriageway ("H-1 East"), which is more trustworthy than inferring
 * a heading from where the trip starts and ends.
 */
export function guidanceDirection(step: GuidanceInstruction): string | null {
  const text = [step.roadNumbers?.[0], step.street].filter(Boolean).join(" ");
  const match = /\b(East|West|North|South)(?:bound)?\b/i.exec(text);
  if (match?.[1]) return capitalise(match[1]);
  const abbreviated = /\b(?:H-?\d+|Hwy|Fwy)\s+(E|W|N|S)\b/i.exec(text);
  if (abbreviated?.[1]) {
    return { E: "East", W: "West", N: "North", S: "South" }[abbreviated[1].toUpperCase() as "E" | "W" | "N" | "S"];
  }
  return null;
}

function capitalise(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

function isFreeway(name: string) {
  return /^H-\d/i.test(name) || /\bFwy\b/i.test(name);
}

function withoutDirection(name: string) {
  return name.replace(/\s+(?:East|West|North|South|Eastbound|Westbound|Northbound|Southbound)$/i, "");
}


/**
 * Pick the handful of roads a driver actually needs to know, from TomTom's
 * turn-by-turn guidance. Nothing is hardcoded: names come from the feed and are
 * only translated into the local name Oahu drivers use.
 */
export function extractCorridor(
  instructions: GuidanceInstruction[],
  totalMeters: number,
  endpoints?: { fromLon: number; toLon: number },
  maxRoads = 3,
): RouteCorridor | null {
  if (!instructions.length) return null;

  const spans = new Map<string, { meters: number; firstOffset: number }>();
  // Direction the feed itself states for each road, preferred over geometry.
  const statedDirections = new Map<string, string>();
  for (let index = 0; index < instructions.length; index += 1) {
    const step = instructions[index]!;
    const name = stepRoadName(step);
    if (!name) continue;
    const offset = step.routeOffsetInMeters ?? 0;
    const nextOffset = instructions[index + 1]?.routeOffsetInMeters ?? totalMeters;
    const meters = Math.max(0, nextOffset - offset);
    const existing = spans.get(name);
    if (existing) {
      existing.meters += meters;
      existing.firstOffset = Math.min(existing.firstOffset, offset);
    } else {
      spans.set(name, { meters, firstOffset: offset });
    }
    const base = withoutDirection(name);
    const stated = guidanceDirection(step);
    if (stated && !statedDirections.has(base)) statedDirections.set(base, stated);
  }
  if (!spans.size) return null;

  const threshold = Math.max(400, totalMeters * 0.06);
  const significant = [...spans.entries()].filter(([, span]) => span.meters >= threshold);
  const chosen = (significant.length ? significant : [...spans.entries()])
    .sort((a, b) => b[1].meters - a[1].meters)
    .slice(0, maxRoads)
    .sort((a, b) => a[1].firstOffset - b[1].firstOffset)
    .map(([name]) => name);
  if (!chosen.length) return null;

  const roads = chosen.map((name) => {
    const baseName = withoutDirection(name);
    if (!isFreeway(baseName)) return name;
    const stated = statedDirections.get(baseName);
    if (stated) return `${baseName} ${stated}`;
    return endpoints ? `${baseName} ${freewayDirection(endpoints.fromLon, endpoints.toLon)}` : name;
  });

  return { label: `Via ${roads.join(" → ")}`, roads, allRoads: [...spans.keys()] };
}

/**
 * Congested roads near the trip that this route does not use, so the app can
 * say plainly that the drive skips a known backup.
 */
function roadKey(road: string) {
  return road
    .replace(/\s+(East|West|North|South|Eastbound|Westbound)$/i, "")
    .replace(/\b(Road|Rd|Highway|Hwy|Parkway|Pkwy|Freeway|Fwy|Street|St|Avenue|Ave|Boulevard|Blvd)\b\.?/gi, "")
    .replace(/[^a-z0-9]+/gi, "")
    .toLowerCase();
}

export function bypassedCorridors(
  nearbyCongestedRoads: Array<string | null>,
  /** Every road the route travels on, not just the headline corridor. */
  routeRoads: string[],
  limit = 2,
): string[] {
  const onRoute = new Set(routeRoads.map(roadKey));
  const out: string[] = [];
  for (const raw of nearbyCongestedRoads) {
    const name = localRoadName(raw ?? null);
    if (!name) continue;
    const key = roadKey(name);
    if (!key || onRoute.has(key) || out.some((item) => roadKey(item) === key)) continue;
    out.push(name);
    if (out.length === limit) break;
  }
  return out;
}
