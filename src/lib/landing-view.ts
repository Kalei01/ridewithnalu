/**
 * Which screen Nalu opens on. Signed-in riders start on Browse, where their
 * saved places are one tap away, instead of being dropped into a trip. A trip
 * that is actually under way still reopens on its own, and so do riders who
 * aren't signed in (their last trip is the only shortcut they have).
 */
export function landingView(input: {
  tripConfigured: boolean;
  signedIn: boolean;
  tripUnderWay: boolean;
}): "browse" | "commute" {
  if (!input.tripConfigured) return "browse";
  return input.tripUnderWay || !input.signedIn ? "commute" : "browse";
}

/** Whether Nalu may open the rider's usual trip by itself on load. Signed-in riders land on Browse. */
export function mayAutoOpenUsualTrip(input: { signedIn: boolean }): boolean {
  return !input.signedIn;
}
