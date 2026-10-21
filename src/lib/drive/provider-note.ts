import type { DriveTime } from "../drive.functions";

/**
 * The one quiet source line when the drive time isn't a normal TomTom answer:
 * what it is, and what is limited as a result. Police reports are mentioned
 * only when some are actually showing. Null for a TomTom answer whose incident
 * feed was read.
 */
export function driveSourceNote(
  drive: Pick<DriveTime, "provider" | "incidentsAvailable" | "nearbyIncidents"> | null | undefined,
): string | null {
  if (!drive) return null;
  const police = (drive.nearbyIncidents ?? []).some((incident) => incident.source === "hpd");
  const alerts = `Crash alerts are limited right now${police ? "; police reports still show." : "."}`;
  if (drive.provider === "mapbox") return `Drive time is estimated. ${alerts}`;
  if (drive.incidentsAvailable === false) return alerts;
  return null;
}
