import type { HdotScheduledClosure } from "./hdot-lane-closures.functions";
import { hdotRoadName } from "./hdot-road-names";

export type RoadGroup = { route: string; name: string; code: string | null; closures: HdotScheduledClosure[] };

const FREEWAY_ORDER = ["H-1", "H-2", "H-3", "H-201"];

/** Group the state's list by road, freeways first, so people can scan for theirs. */
export function groupRoadwork(closures: HdotScheduledClosure[]): RoadGroup[] {
  const groups = new Map<string, RoadGroup>();
  for (const closure of closures) {
    const existing = groups.get(closure.route);
    if (existing) existing.closures.push(closure);
    else groups.set(closure.route, { route: closure.route, ...hdotRoadName(closure.route), closures: [closure] });
  }
  const rank = (route: string) => {
    const index = FREEWAY_ORDER.indexOf(route.toUpperCase());
    return index === -1 ? FREEWAY_ORDER.length : index;
  };
  return [...groups.values()].sort((a, b) => rank(a.route) - rank(b.route) || a.name.localeCompare(b.name));
}

/** "eastbound" → "Eastbound"; null stays null. */
export function directionLabel(direction: string | null): string | null {
  return direction ? direction.charAt(0).toUpperCase() + direction.slice(1) : null;
}
