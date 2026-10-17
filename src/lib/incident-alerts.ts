/**
 * In-drive accident alerts: say what happened and where, once per incident,
 * and keep a "reported ahead" notice on the nav HUD. Wording is only what the
 * provider reported; a delay is mentioned only when TomTom gave one.
 */
import type { DriveIncident } from "./drive.functions";
import { routeBearingAfter } from "./local-directions";
import { angleDifference } from "./navigation-voice";
import { incidentCategoryLabel, localRoadName } from "./traffic-incidents";

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

/** HUD line: "Accident on H-1 East near Aiea · about +8 min". */
export function incidentHudText(incident: DriveIncident, offRoute = false): string {
  const delay = delayMinutes(incident);
  return `${headline(incident)}${delay > 0 ? ` · about +${delay} min` : ""}${offRoute ? " · reported ahead, not on your route" : ""}`;
}

/** Spoken line: "Reported accident on H-1 East near Aiea, adding about 8 minutes." */
export function incidentSpeech(incident: DriveIncident): string {
  const delay = delayMinutes(incident);
  const spokenDelay =
    delay > 0 ? `, adding about ${delay} ${delay === 1 ? "minute" : "minutes"}` : "";
  return `Reported ${headline(incident).replace(/^./, (c) => c.toLowerCase())}${spokenDelay}.`;
}

/** True when the incident's stated direction runs against the route's heading there. */
export function isOppositeDirection(
  incident: DriveIncident,
  path: ReadonlyArray<{ lat: number; lon: number }>,
): boolean {
  const word = /\b(East|West|North|South)\b/i.exec(incident.road ?? "")?.[1]?.toLowerCase();
  const point = incident.points?.[0];
  if (!word || !point) return false;
  const bearing = routeBearingAfter(path, point, 300);
  if (bearing === null) return false;
  return angleDifference(DIRECTION_BEARING[word]!, bearing) > OPPOSITE_DEG;
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
  /** Notice for the nav HUD, or null. */
  hud: { key: string; text: string; reportedAhead: boolean } | null;
};

/**
 * Decide what to say and show for the latest route.
 * - On the route: spoken once, shown on the HUD.
 * - Seen on the route earlier but now off it (a reroute avoided it): the HUD
 *   keeps a "reported ahead" notice as long as TomTom still lists it nearby.
 * - Off-route incidents never seen on the route stay silent.
 */
export function planIncidentAlerts(
  input: {
    incidents: DriveIncident[];
    nearby?: DriveIncident[];
    path: ReadonlyArray<{ lat: number; lon: number }>;
  },
  memory: IncidentAlertMemory,
): IncidentAlertPlan {
  const onRoute = new Map<string, DriveIncident>();
  for (const incident of input.incidents) {
    if (isAlertIncident(incident) && !isOppositeDirection(incident, input.path))
      onRoute.set(incidentAlertKey(incident), incident);
  }
  const ahead = new Map<string, DriveIncident>();
  for (const incident of input.nearby ?? []) {
    if (!isAlertIncident(incident) || isOppositeDirection(incident, input.path)) continue;
    const key = incidentAlertKey(incident);
    if (incident.onRoute) onRoute.set(key, incident);
    else if (memory.seenOnRoute.has(key)) ahead.set(key, incident);
  }
  const speak: IncidentAlertPlan["speak"] = [];
  for (const [key, incident] of onRoute) {
    memory.seenOnRoute.add(key);
    if (memory.spoken.has(key)) continue;
    memory.spoken.add(key);
    speak.push({ key, incident, text: incidentSpeech(incident) });
  }
  const first = [...onRoute.entries()][0];
  if (first)
    return { speak, hud: { key: first[0], text: incidentHudText(first[1]), reportedAhead: false } };
  const avoided = [...ahead.entries()][0];
  if (avoided)
    return {
      speak,
      hud: { key: avoided[0], text: incidentHudText(avoided[1], true), reportedAhead: true },
    };
  return { speak, hud: null };
}
