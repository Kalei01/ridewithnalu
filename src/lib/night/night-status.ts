/**
 * Night mode: what matters late at night is whether there's still a bus or
 * train tonight. Reads the trips the planner already found, nothing guessed.
 */

export type NightOption = {
  leave_by_seconds: number | null;
  depart_seconds: number;
  arrive_seconds: number;
};

export type NightStatus =
  | { kind: "day" }
  /** Late, and this is the last trip that leaves tonight. */
  | { kind: "last"; option: NightOption; leaveBy: number }
  /** Nothing leaves until morning; the first trip is shown when known. */
  | { kind: "none_tonight"; first: NightOption | null };

/** 9 PM to 5 AM, Honolulu time, in seconds after midnight. */
export function isNightTime(nowSeconds: number) {
  const s = ((nowSeconds % 86400) + 86400) % 86400;
  return s >= 21 * 3600 || s < 5 * 3600;
}

/** At night, a first trip more than an hour away is a long wait worth saying so. */
const TONIGHT_SECONDS = 60 * 60;
/** The next trip leaving this much later than one means that one was the last. */
const LAST_GAP_SECONDS = 2 * 3600;

export function nightStatus(nowSeconds: number, options: NightOption[], plannerAnswered: boolean): NightStatus {
  if (!isNightTime(nowSeconds) || !plannerAnswered) return { kind: "day" };
  const leaveOf = (option: NightOption) => option.leave_by_seconds ?? option.depart_seconds;
  const upcoming = options
    .filter((option) => leaveOf(option) >= nowSeconds - 60)
    .sort((a, b) => leaveOf(a) - leaveOf(b));
  const first = upcoming[0] ?? null;
  if (!first || leaveOf(first) - nowSeconds > TONIGHT_SECONDS) return { kind: "none_tonight", first };
  const next = upcoming[1];
  // Only call it the last one when the planner's later trips are hours away.
  if (!next || leaveOf(next) - leaveOf(first) > LAST_GAP_SECONDS) {
    return { kind: "last", option: first, leaveBy: leaveOf(first) };
  }
  return { kind: "day" };
}

/** Uber and Lyft links that open their apps with the destination filled in. */
export function rideshareLinks(to: { lat: number; lon: number; name: string }) {
  const lat = to.lat.toFixed(6);
  const lon = to.lon.toFixed(6);
  const uber = new URL("https://m.uber.com/ul/");
  uber.searchParams.set("action", "setPickup");
  uber.searchParams.set("pickup", "my_location");
  uber.searchParams.set("dropoff[latitude]", lat);
  uber.searchParams.set("dropoff[longitude]", lon);
  uber.searchParams.set("dropoff[nickname]", to.name.slice(0, 60));
  const lyft = new URL("https://lyft.com/ride");
  lyft.searchParams.set("id", "lyft");
  lyft.searchParams.set("destination[latitude]", lat);
  lyft.searchParams.set("destination[longitude]", lon);
  return { uber: uber.toString(), lyft: lyft.toString() };
}
