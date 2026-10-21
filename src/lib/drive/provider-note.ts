import type { DriveTime } from "../drive.functions";

/**
 * One quiet line telling the rider where the drive time came from when it is
 * not the usual provider, and what is missing as a result. Null for TomTom
 * answers whose incident feed was read.
 */
export function driveSourceNote(
  drive: Pick<DriveTime, "provider" | "incidentsAvailable"> | null | undefined,
): string | null {
  if (!drive) return null;
  if (drive.provider === "mapbox")
    return "Live time from Mapbox (estimate). TomTom accident alerts are paused.";
  if (drive.incidentsAvailable === false) return "Accident alerts are paused right now.";
  return null;
}
