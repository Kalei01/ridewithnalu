/**
 * The race demo's clock: which leg each entrant is on at a given moment of
 * the real trip, and how far along it. Times are the planner's and TomTom's;
 * walking legs are never timed (Josh, Oct 14, 2026), so a walk between two
 * stops is a hop at the next departure, not a movement with an invented pace.
 */
import type { HomeRaceEntrant } from "./home-types";

/** One timed movement: a car on the road, a bus or train between stops, a drive to a station. */
export type RaceSegment = { legIndex: number; startSeconds: number; endSeconds: number };

export function raceSegments(entrant: HomeRaceEntrant): RaceSegment[] {
  if (entrant.kind === "drive")
    return [
      { legIndex: -1, startSeconds: entrant.startSeconds, endSeconds: entrant.finishSeconds },
    ];
  const segments: RaceSegment[] = [];
  entrant.legs.forEach((leg, legIndex) => {
    if (leg.mode === "walk" || leg.departSeconds === null || leg.arriveSeconds === null) return;
    // Nothing after the finish: a leg after the last bus or train isn't part of the race.
    if (leg.departSeconds >= entrant.finishSeconds) return;
    segments.push({ legIndex, startSeconds: leg.departSeconds, endSeconds: leg.arriveSeconds });
  });
  return segments;
}

/** Where an entrant is at `seconds`: on which segment, and how far along it (0–1). */
export function raceProgress(
  segments: ReadonlyArray<RaceSegment>,
  seconds: number,
): { segment: number; fraction: number; finished: boolean } {
  if (!segments.length) return { segment: 0, fraction: 0, finished: true };
  for (let i = segments.length - 1; i >= 0; i -= 1) {
    const segment = segments[i]!;
    if (seconds < segment.startSeconds) continue;
    const span = Math.max(1, segment.endSeconds - segment.startSeconds);
    const fraction = Math.min(1, (seconds - segment.startSeconds) / span);
    return { segment: i, fraction, finished: i === segments.length - 1 && fraction >= 1 };
  }
  // Not started yet: waiting at the first stop (or in the driveway).
  return { segment: 0, fraction: 0, finished: false };
}

/** The race's real time span: from the check to the last arrival. */
export function raceSpan(entrants: ReadonlyArray<HomeRaceEntrant>, checkedSeconds: number) {
  const end = Math.max(checkedSeconds + 60, ...entrants.map((e) => e.finishSeconds));
  return { start: checkedSeconds, end };
}
