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

export type TidyClosure = {
  place: string | null;
  what: string;
  lanes: string;
  when: string;
  why: string | null;
  link: string | null;
};

const titleCase = (word: string) => word.charAt(0) + word.slice(1).toLowerCase();

/**
 * HDOT's entries are written for a press release ("HONOLULU (24/7 CLOSURE)
 * Right shoulder closure on the…, For more information, visit…"). Rewrite them
 * for scanning: place, what's closed, when, why, and a link. Nothing is invented;
 * anything we can't read stays as HDOT wrote it.
 */
export function tidyClosure(closure: HdotScheduledClosure): TidyClosure {
  let text = closure.location.trim();
  let place: string | null = null;
  const lead = text.match(/^([A-Z][A-Z' ʻ-]+?)\s*(?:\(([^)]*)\))?\s+(?=[A-Z][a-z])/);
  let roundTheClock = false;
  if (lead) {
    place = lead[1]!.trim().split(/\s+/).map(titleCase).join(" ");
    roundTheClock = /24\s*\/\s*7|24[- ]hour/i.test(lead[2] ?? "");
    text = text.slice(lead[0].length);
  }
  text = text.replace(/[,;:\s]+$/, "");
  const what = text.charAt(0).toUpperCase() + text.slice(1);

  const lanes = /shoulder closure/i.test(what) && closure.laneSummary === "Lane closure" ? "Shoulder closed" : closure.laneSummary;

  const scheduleKnown = closure.schedule && !/^see hdot/i.test(closure.schedule);
  const when = scheduleKnown
    ? closure.schedule.charAt(0).toUpperCase() + closure.schedule.slice(1)
    : roundTheClock
      ? "Around the clock"
      : "See HDOT's schedule";

  const work = closure.work ?? "";
  const link = work.match(/https?:\/\/[^\s)]+/)?.[0]?.replace(/[.,]+$/, "") ?? null;
  let why: string | null = work
    .replace(/https?:\/\/\S+/g, "")
    .replace(/\b(?:for\s+)?more information,?\s*(?:please\s+)?visit(?:\s+the\s+project\s+website)?:?/i, "")
    .replace(/\bSee:?\s*$/i, "")
    .replace(/^the duration of\s+/i, "")
    .replace(/^the\s+/i, "")
    .replace(/[\s.,:;]+$/, "")
    .trim();
  if (!why) why = null;
  else why = why.charAt(0).toUpperCase() + why.slice(1);

  return { place, what, lanes, when, why, link };
}
