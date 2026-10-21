import type { DriveTime } from "../drive.functions";

/**
 * One quiet line telling the rider where the drive time came from when it is
 * not the usual provider, and what is missing as a result. Null for TomTom
 * answers whose incident feed was read.
 */
export function driveSourceNote(
  drive: Pick<DriveTime, "provider" | "incidentsAvailable" | "hpdChecked"> | null | undefined,
): string | null {
  if (!drive) return null;
  const police = drive.hpdChecked ? " Police reports (HPD) are still shown." : "";
  if (drive.provider === "mapbox")
    return `Live time from Mapbox (estimate). TomTom accident alerts are paused.${police}`;
  if (drive.incidentsAvailable === false)
    return `TomTom accident alerts are paused right now.${police}`;
  return null;
}
