/**
 * Door-to-door driving stays available when the recorded car location is
 * compatible with the current leg. A destination record means the commuter
 * is driving there now and parking there, and also has the car available for
 * the later return trip from that destination.
 */
export function carAvailableForDrive(
  parkedToday: { place?: "home" | "station" | "destination" | undefined } | null,
  inbound: boolean,
) {
  if (!parkedToday) return true;
  if (parkedToday.place === "destination") return true;
  return inbound ? false : parkedToday.place === "home" || parkedToday.place === "station";
}
