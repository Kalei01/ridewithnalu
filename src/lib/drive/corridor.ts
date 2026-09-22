import { localRoadName } from "../traffic-incidents";

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
 * The name to show for one guidance step. Freeways are best identified by their
 * number (H-1), but ordinary surface roads must use the street name the feed
 * reports: route numbers change at junctions (Fort Weaver Rd becomes Kunia Rd
 * north of H-1), so trusting the number alone renames the road a driver is on.
 */
export function stepRoadName(step: GuidanceInstruction): string | null {
  const numbered = localRoadName(step.roadNumbers?.[0] ?? null);
  if (numbered && isFreeway(numbered)) return numbered;
  const street = step.street?.trim();
  if (street) return localRoadName(street);
  return numbered;
}

/** East/West suffix for freeways, derived from the trip's own geometry. */
function freewayDirection(fromLon: number, toLon: number): "East" | "West" {
  return toLon >= fromLon ? "East" : "West";
}

function isFreeway(name: string) {
  return /^H-\d/i.test(name) || /\bFwy\b/i.test(name);
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
  for (let index = 0; index < instructions.length; index += 1) {
    const step = instructions[index]!;
    const raw = step.roadNumbers?.[0] ?? step.street;
    const name = localRoadName(raw ?? null);
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

  const roads = chosen.map((name) =>
    endpoints && isFreeway(name)
      ? `${name} ${freewayDirection(endpoints.fromLon, endpoints.toLon)}`
      : name,
  );
  return { label: `Via ${roads.join(" → ")}`, roads };
}

/**
 * Congested roads near the trip that this route does not use, so the app can
 * say plainly that the drive skips a known backup.
 */
export function bypassedCorridors(
  nearbyCongestedRoads: Array<string | null>,
  corridorRoads: string[],
  limit = 2,
): string[] {
  const onRoute = new Set(corridorRoads.map((road) => road.replace(/\s+(East|West)$/i, "").toLowerCase()));
  const out: string[] = [];
  for (const raw of nearbyCongestedRoads) {
    const name = localRoadName(raw ?? null);
    if (!name) continue;
    const key = name.toLowerCase();
    if (onRoute.has(key) || out.some((item) => item.toLowerCase() === key)) continue;
    out.push(name);
    if (out.length === limit) break;
  }
  return out;
}
