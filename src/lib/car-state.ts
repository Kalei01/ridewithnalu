/**
 * Door-to-door driving is available unless a same-day station parking record
 * means the car is physically parked somewhere else for the current leg.
 *
 * Destination parking is no longer tracked by Nalu. An older destination
 * record is treated as non-blocking so existing users are not locked out.
 */
export function carAvailableForDrive(
  parkedToday: { place?: "home" | "station" | undefined } | null,
  inbound: boolean,
) {
  if (!parkedToday) return true;
  if (parkedToday.place !== "home" && parkedToday.place !== "station") return true;
  return inbound ? false : parkedToday.place === "home" || parkedToday.place === "station";
}
