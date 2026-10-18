/**
 * The two things the Browse sheet shows while it is closed (its "peek"): one
 * plain line about H-1 and one line about the next scheduled train. Both come
 * only from data the Browse screen already has (the H-1 check and the nearest
 * Skyline station's schedule); nothing here is estimated or invented.
 */
import { clockFromSeconds, stationLabel, terminusLabel } from "@/lib/commute-formatting";

type RoadCheck =
  { delayMinutes: number; incidents: unknown[]; typicalChecked?: boolean } | undefined;

type Read = { name: string; delay: number; incident: boolean; hasBaseline: boolean };

function read(name: string, check: RoadCheck): Read | null {
  if (!check) return null;
  return {
    name,
    delay: Math.max(0, Math.round(check.delayMinutes)),
    incident: check.incidents.length > 0,
    // Without TomTom's usual-traffic answer there is nothing to compare (same rule as the home page).
    hasBaseline: check.typicalChecked !== false,
  };
}

/**
 * One line about H-1, from the live east and west checks. `failed` means the
 * check could not be made (or its refresh failed): never show an older "clear".
 * Null while the first answer is still on its way.
 */
export function h1PeekLine(east: RoadCheck, west: RoadCheck, failed = false): string | null {
  if (failed) return "Can’t check H-1 right now";
  const roads = [read("eastbound", east), read("westbound", west)].filter(
    (item): item is Read => item !== null,
  );
  if (!roads.length) return null;
  // An incident comes first, then the longest delay.
  const incidents = roads.filter((r) => r.incident);
  if (incidents.length) {
    const worst = incidents.reduce((a, b) => (b.delay > a.delay ? b : a));
    return `H-1 ${worst.name}: incident reported`;
  }
  const compared = roads.filter((r) => r.hasBaseline);
  if (!compared.length) return "H-1: no typical-traffic baseline right now";
  const worst = compared.reduce((a, b) => (b.delay > a.delay ? b : a));
  if (worst.delay > 0) return `H-1 ${worst.name}: +${worst.delay} min over typical`;
  return compared.length === 2 ? "H-1 is clear both ways" : `H-1 ${worst.name} is clear`;
}

export type PeekDeparture = {
  departure_seconds: number;
  trip_headsign?: string | null;
  direction_terminus?: string | null;
};

/** Longest walk (minutes) at which we hold back trains the rider could not reach. */
const WALK_LIMIT_MIN = 30;

/**
 * The next scheduled train at the rider's nearest station, as one line. It is a
 * timetable, not live tracking. When the walk to the station is short enough to
 * matter, trains that leave before the rider could arrive are skipped.
 * Null when nothing is scheduled.
 */
export function nextTrainLine(
  directions: PeekDeparture[][],
  nowSeconds: number,
  stationName: string,
  walkMinutes: number | null,
): string | null {
  const all = directions.flat().filter((d) => d.departure_seconds >= nowSeconds - 30);
  if (!all.length) return null;
  const walk = walkMinutes !== null && walkMinutes <= WALK_LIMIT_MIN ? walkMinutes : 0;
  const soonest = all.reduce((a, b) => (b.departure_seconds < a.departure_seconds ? b : a));
  const catchable = all.filter((d) => d.departure_seconds >= nowSeconds + walk * 60);
  if (!catchable.length) return null;
  const pick = catchable.reduce((a, b) => (b.departure_seconds < a.departure_seconds ? b : a));
  const away = pick.departure_seconds - nowSeconds;
  const when =
    away < 60
      ? "now"
      : Math.ceil(away / 60) <= 20
        ? `in ${Math.ceil(away / 60)} min`
        : clockFromSeconds(pick.departure_seconds);
  const toward = terminusLabel(pick.direction_terminus) || stationLabel(pick.trip_headsign);
  const lead = pick === soonest ? "Next train" : "Next you can make";
  return `${lead} ${when} · ${stationLabel(stationName)}${toward ? ` to ${toward}` : ""}`;
}
