/**
 * In-drive accident alerts: say what happened and where, once per incident,
 * and keep a "reported ahead" notice on the nav HUD. Wording is only what the
 * provider reported; a delay is mentioned only when TomTom gave one.
 */
import type { DriveIncident } from "./drive.functions";
import { routeBearingAfter } from "./local-directions";
import {
  angleDifference,
  bearingBetween,
  matchRoutePoint,
  metersBetween,
} from "./navigation-voice";
import { incidentCategoryLabel, localRoadName } from "./traffic-incidents";

type LatLon = { lat: number; lon: number };
const ALERT_CATEGORIES = new Set(["Accident", "Road closure"]);
/** An incident whose stated direction is more than this off our heading is the other carriageway. */
const OPPOSITE_DEG = 100;

const DIRECTION_BEARING: Record<string, number> = { east: 90, west: 270, north: 0, south: 180 };

/** Stable per incident: TomTom's id, else category + road + place + rounded position. */
export function incidentAlertKey(incident: DriveIncident): string {
  if (incident.id) return `id:${incident.id}`;
  const p = incident.points?.[0];
  const pos = p ? `${p.lat.toFixed(3)},${p.lon.toFixed(3)}` : "";
  return [
    incident.category ?? "",
    incident.road ?? "",
    incident.from ?? "",
    incident.to ?? "",
    pos,
  ].join("|");
}

/** Accidents and full closures are worth interrupting a drive for. */
export function isAlertIncident(incident: DriveIncident): boolean {
  const label = incidentCategoryLabel(incident);
  return label !== null && ALERT_CATEGORIES.has(label);
}

/** "near Aiea" / "between Aiea and Pearl City" from the stretch TomTom named. */
export function incidentWhere(incident: DriveIncident): string | null {
  const from = incident.from?.trim();
  const to = incident.to?.trim();
  if (from && to && from.toLowerCase() !== to.toLowerCase()) return `between ${from} and ${to}`;
  const one = from || to;
  return one ? `near ${one}` : null;
}

function headline(incident: DriveIncident): string {
  const label = incidentCategoryLabel(incident) ?? "Incident";
  const road = localRoadName(incident.road);
  const where = incidentWhere(incident);
  return `${label} on ${road ?? "your route"}${where ? ` ${where}` : ""}`;
}

function delayMinutes(incident: DriveIncident): number {
  return Math.max(0, Math.round(incident.delayMinutes ?? 0));
}

/** HUD line, delay first when known: "+8 min · Accident on H-1 East near Aiea". */
export function incidentHudText(incident: DriveIncident): string {
  const delay = delayMinutes(incident);
  return `${delay > 0 ? `+${delay} min · ` : ""}${headline(incident)}`;
}

/** Spoken line: "Reported accident on H-1 East near Aiea, adding about 8 minutes." */
export function incidentSpeech(incident: DriveIncident): string {
  const delay = delayMinutes(incident);
  const spokenDelay =
    delay > 0 ? `, adding about ${delay} ${delay === 1 ? "minute" : "minutes"}` : "";
  return `Reported ${headline(incident).replace(/^./, (c) => c.toLowerCase())}${spokenDelay}.`;
}

/** Direction the incident's own line runs (TomTom geometry follows the traffic direction). */
export function incidentLineBearing(points: ReadonlyArray<LatLon> | undefined): number | null {
  if (!points || points.length < 2) return null;
  const first = points[0]!;
  const last = points[points.length - 1]!;
  if (metersBetween(first, last) < 30) return null;
  return bearingBetween(first, last);
}

/**
 * True when the incident is on the other carriageway: its own line runs more
 * than 90 degrees against the route there. Falls back to a stated East/West/
 * North/South in the road name only when the geometry is too short to tell.
 */
export function isOppositeDirection(incident: DriveIncident, path: ReadonlyArray<LatLon>): boolean {
  const points = incident.points;
  const point = points?.[0];
  if (!point) return false;
  const middle = points![Math.floor(points!.length / 2)]!;
  const routeBearing = routeBearingAfter(path, middle, 300) ?? routeBearingAfter(path, point, 300);
  if (routeBearing === null) return false;
  const lineBearing = incidentLineBearing(points);
  if (lineBearing !== null) return angleDifference(lineBearing, routeBearing) > OPPOSITE_DEG;
  const word = /\b(East|West|North|South)\b/i.exec(incident.road ?? "")?.[1]?.toLowerCase();
  return word ? angleDifference(DIRECTION_BEARING[word]!, routeBearing) > OPPOSITE_DEG : false;
}

/** Along the route from the rider: the incident is still ahead, already behind, or can't be told. */
export function incidentAlong(
  incident: DriveIncident,
  path: ReadonlyArray<LatLon>,
  rider: LatLon | null | undefined,
): "ahead" | "behind" | "unknown" {
  const point = incident.points?.[0];
  if (!rider || !point || path.length < 2) return "unknown";
  const me = matchRoutePoint(rider, path as LatLon[]);
  const there = matchRoutePoint(point, path as LatLon[]);
  if (!me || !there || me.distanceM > 80) return "unknown";
  if (there.segmentIndex !== me.segmentIndex)
    return there.segmentIndex > me.segmentIndex ? "ahead" : "behind";
  const start = path[me.segmentIndex]!;
  return metersBetween(start, there.point) >= metersBetween(start, me.point) ? "ahead" : "behind";
}

export type IncidentAlertMemory = {
  /** Alert-worthy incidents seen on the route at some point this trip. */
  seenOnRoute: Set<string>;
  /** Incidents already spoken. */
  spoken: Set<string>;
};

export function newIncidentAlertMemory(): IncidentAlertMemory {
  return { seenOnRoute: new Set(), spoken: new Set() };
}

export type IncidentAlertPlan = {
  /** New incidents to say aloud now (each incident only ever once). */
  speak: Array<{ key: string; incident: DriveIncident; text: string }>;
  /** Notice for the nav HUD, or null. `label` is its heading. */
  hud: { key: string; text: string; label: string; offRoute: boolean } | null;
};

/** Incidents the detailed alert would announce, keyed. Shared with the generic-alert check. */
export function alertEligible(input: {
  incidents: DriveIncident[];
  nearby?: DriveIncident[];
  path: ReadonlyArray<LatLon>;
}): { onRoute: Map<string, DriveIncident>; offRoute: Map<string, DriveIncident> } {
  const onRoute = new Map<string, DriveIncident>();
  const offRoute = new Map<string, DriveIncident>();
  for (const incident of input.incidents) {
    if (isAlertIncident(incident) && !isOppositeDirection(incident, input.path))
      onRoute.set(incidentAlertKey(incident), incident);
  }
  for (const incident of input.nearby ?? []) {
    if (!isAlertIncident(incident) || isOppositeDirection(incident, input.path)) continue;
    const key = incidentAlertKey(incident);
    if (incident.onRoute) onRoute.set(key, incident);
    else offRoute.set(key, incident);
  }
  return { onRoute, offRoute };
}

/**
 * True when every freshly reported incident is one the detailed alert covers,
 * so the generic "reported incident" line can stay quiet. If any is not
 * covered, the generic line still speaks: the rider never gets neither.
 */
export function detailedAlertCovers(
  fresh: DriveIncident[],
  input: { incidents: DriveIncident[]; nearby?: DriveIncident[]; path: ReadonlyArray<LatLon> },
): boolean {
  if (fresh.length === 0) return false;
  const { onRoute } = alertEligible(input);
  return fresh.every((incident) => onRoute.has(incidentAlertKey(incident)));
}

/**
 * Decide what to say and show for the latest route.
 * - On the route and not yet passed: spoken once, shown on the HUD.
 * - Seen on the route earlier but now off it (a reroute avoided it): the HUD
 *   keeps an "Avoided" notice as long as TomTom still lists it nearby.
 * - Off-route incidents never seen on the route stay silent; passed ones drop.
 */
export function planIncidentAlerts(
  input: {
    incidents: DriveIncident[];
    nearby?: DriveIncident[];
    path: ReadonlyArray<LatLon>;
    rider?: LatLon | null;
  },
  memory: IncidentAlertMemory,
): IncidentAlertPlan {
  const { onRoute, offRoute } = alertEligible(input);
  const along = new Map<string, "ahead" | "behind" | "unknown">();
  for (const [key, incident] of [...onRoute, ...offRoute])
    along.set(key, incidentAlong(incident, input.path, input.rider));
  const speak: IncidentAlertPlan["speak"] = [];
  for (const [key, incident] of onRoute) {
    if (along.get(key) === "behind") continue;
    memory.seenOnRoute.add(key);
    if (memory.spoken.has(key)) continue;
    memory.spoken.add(key);
    speak.push({ key, incident, text: incidentSpeech(incident) });
  }
  const first = [...onRoute.entries()].find(([key]) => along.get(key) !== "behind");
  if (first) {
    const label = along.get(first[0]) === "ahead" ? "Reported ahead" : "Reported nearby";
    return {
      speak,
      hud: { key: first[0], text: incidentHudText(first[1]), label, offRoute: false },
    };
  }
  const avoided = [...offRoute.entries()].find(
    ([key]) => memory.seenOnRoute.has(key) && along.get(key) !== "behind",
  );
  if (avoided) {
    const label =
      along.get(avoided[0]) === "ahead"
        ? "Avoided — not on your route"
        : "Nearby — not on your route";
    return {
      speak,
      hud: { key: avoided[0], text: incidentHudText(avoided[1]), label, offRoute: true },
    };
  }
  return { speak, hud: null };
}
