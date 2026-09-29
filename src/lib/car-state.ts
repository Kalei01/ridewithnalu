/**
 * Door-to-door driving is always compared unless a car location recorded
 * TODAY puts the car somewhere else. Callers pass only today's record, so a
 * stale parked state can never suppress Drive.
 */
export function carAvailableForDrive(
  parkedToday: { place: "home" | "station" | "destination" } | null,
  inbound: boolean,
) {
  if (!parkedToday) return true;
  return inbound ? parkedToday.place === "destination" : parkedToday.place === "home";
}
