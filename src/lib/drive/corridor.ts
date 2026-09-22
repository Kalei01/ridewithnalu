import { localRoadName, routeCodeName } from "../traffic-incidents";

export type GuidanceInstruction = {
  routeOffsetInMeters?: number;
  street?: string;
  roadNumbers?: string[];
  maneuver?: string;
  exitNumber?: string;
  signpostText?: string;
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
  const street = step.street?.trim();
  const streetName = localRoadName(street ?? null);
  // TomTom can put roads shown on an upcoming sign in `roadNumbers`. If the
  // instruction itself names an H freeway, that is the road being travelled;
  // do not turn an H-1 segment into H-3 because H-3 appears on the sign.
  if (streetName && /^H-[123](?:\s+(?:East|West|North|South))?$/i.test(streetName)) {
    return streetName;
  }
  for (const code of step.roadNumbers ?? []) {
    const mapped = routeCodeName(code);
    if (mapped) return mapped;
  }
  if (streetName) return streetName;
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
  maxRoads = 4,
): RouteCorridor | null {
  if (!instructions.length) return null;

  const spans = new Map<string, { meters: number; firstOffset: number }>();
  // Direction the feed itself states for each road, preferred over geometry.
  const statedDirections = new Map<string, string>();
  const exitNumbers = new Map<string, string>();
  const names = instructions.map((step) => stepRoadName(step));
  mergeRampNames(instructions, names);
  for (let index = 0; index < instructions.length; index += 1) {
    const step = instructions[index]!;
    const name = names[index];
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
    const exitNumber = step.exitNumber?.trim();
    if (exitNumber && !exitNumbers.has(base)) exitNumbers.set(base, exitNumber);
  }
  if (!spans.size) return null;

  const entries = [...spans.entries()];
  const threshold = Math.max(400, totalMeters * 0.06);
  const significant = entries.filter(([, span]) => span.meters >= threshold);

  // A commute summary is orientation, not every turn. Keep each freeway the
  // route genuinely travels, in order, and finish with the last named cutoff.
  // Tiny freeway references are commonly destination shields, not a travelled
  // segment, so only the dominant freeway may fall below the transition floor.
  const freewayEntries = entries
    .filter(([name]) => isFreeway(withoutDirection(name)))
    .sort((a, b) => a[1].firstOffset - b[1].firstOffset);
  const primaryFreeway = [...freewayEntries].sort((a, b) => b[1].meters - a[1].meters)[0];
  let chosen: string[];
  if (primaryFreeway) {
    const [, freewaySpan] = primaryFreeway;
    const freewayFloor = Math.max(800, totalMeters * 0.025);
    const travelledFreeways = freewayEntries.filter(
      (entry) => entry === primaryFreeway || entry[1].meters >= freewayFloor,
    );
    const firstFreewayOffset = travelledFreeways[0]?.[1].firstOffset ?? freewaySpan.firstOffset;
    const lastFreewayOffset = travelledFreeways.at(-1)?.[1].firstOffset ?? freewaySpan.firstOffset;
    const surfaceEntries = entries.filter(
      ([name, span]) => !isFreeway(withoutDirection(name)) && span.meters >= threshold,
    );
    const approach = surfaceEntries
      .filter(([, span]) => span.firstOffset < firstFreewayOffset)
      .sort((a, b) => b[1].meters - a[1].meters)[0];
    const exitCandidates = entries.filter(
      ([name, span]) => !isFreeway(withoutDirection(name)) && span.firstOffset > lastFreewayOffset,
    );
    // Prefer the last substantial surface road. A final driveway or tiny local
    // street is not the useful freeway cutoff a commuter is looking for.
    const substantialExits = exitCandidates.filter(([, span]) => span.meters >= threshold);
    const exit = (substantialExits.length ? substantialExits : exitCandidates)
      .sort((a, b) => b[1].firstOffset - a[1].firstOffset)[0];
    const core = [...travelledFreeways.map(([name]) => name), exit?.[0]].filter(
      (name): name is string => Boolean(name),
    );
    chosen = approach && core.length < maxRoads ? [approach[0], ...core] : core;
  } else {
    chosen = (significant.length ? significant : entries)
      .sort((a, b) => b[1].meters - a[1].meters)
      .slice(0, maxRoads)
      .sort((a, b) => a[1].firstOffset - b[1].firstOffset)
      .map(([name]) => name);
  }
  chosen = chosen.slice(0, maxRoads);
  if (!chosen.length) return null;

  const roads = chosen.map((name) => {
    const baseName = withoutDirection(name);
    if (!isFreeway(baseName)) {
      const exitNumber = exitNumbers.get(baseName);
      return exitNumber ? `Exit ${exitNumber} · ${name}` : name;
    }
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
