import { clockFromSeconds } from "./commute-formatting";

const SITE = "https://ridenalu.com";

/** Oʻahu, with a little room around the coast. Shared links outside it are ignored. */
const OAHU = { south: 21.2, north: 21.75, west: -158.32, east: -157.6 };

export type SharedDestination = { lat: number; lon: number; name: string };

export type ShareAnswer = {
  verdict: string;
  transitLabel: string;
  destination: string;
  minutesFaster: number | null;
  leaveSeconds: number | null;
  arriveSeconds: number | null;
};

/** The message people send: one plain sentence or two, no hype. */
export function shareText(answer: ShareAnswer): string {
  const transit = answer.transitLabel || "Transit";
  const to = answer.destination;
  const rounded = answer.minutesFaster == null ? null : Math.round(answer.minutesFaster);
  const faster = rounded && rounded >= 2 ? rounded : null;
  let headline: string;
  if (answer.verdict === "drive") headline = faster ? `Driving beats ${transit.toLowerCase()} by ${faster} min to ${to} right now.` : `Driving is the way to ${to} right now.`;
  else if (answer.verdict === "transit") headline = faster ? `${transit} beats driving by ${faster} min to ${to} right now.` : `${transit} is the way to ${to} right now.`;
  else headline = `Driving and ${transit.toLowerCase()} are about even to ${to} right now.`;
  const leave = answer.leaveSeconds == null ? null : clockFromSeconds(answer.leaveSeconds);
  const arrive = answer.arriveSeconds == null ? null : clockFromSeconds(answer.arriveSeconds);
  const timing = leave && arrive ? ` Leave by ${leave} to arrive about ${arrive}.` : arrive ? ` Arrive about ${arrive}.` : "";
  return `${headline}${timing}`;
}

/**
 * Link that opens Nalu. It carries the destination only when the sender says
 * it's safe to share (never their saved home or work), rounded to about 10 m.
 */
export function shareUrl(destination: SharedDestination | null): string {
  const url = new URL(SITE + "/");
  url.searchParams.set("ref", "share");
  if (destination) {
    url.searchParams.set("to", `${destination.lat.toFixed(4)},${destination.lon.toFixed(4)}`);
    url.searchParams.set("name", destination.name.slice(0, 80));
  }
  return url.toString();
}

/** Read a shared destination from a link, or null if it's missing or off-island. */
export function parseSharedDestination(search: string): SharedDestination | null {
  const params = new URLSearchParams(search);
  const match = params.get("to")?.match(/^(-?\d{1,3}\.\d{1,6}),(-?\d{1,3}\.\d{1,6})$/);
  if (!match) return null;
  const lat = Number(match[1]);
  const lon = Number(match[2]);
  if (lat < OAHU.south || lat > OAHU.north || lon < OAHU.west || lon > OAHU.east) return null;
  const name = (params.get("name") ?? "").replace(/[<>]/g, "").trim().slice(0, 80) || "Shared place";
  return { lat, lon, name };
}

/**
 * The link preview (Messages, WhatsApp, Facebook) for a link that opens Nalu on
 * a place. It names the question, not an answer: the answer is live, and would
 * be out of date by the time someone opens the link.
 */
export function sharedTripPreview(
  search: Record<string, unknown> | undefined,
): { title: string; description: string } | null {
  const params = new URLSearchParams();
  for (const key of ["to", "name"]) {
    const value = search?.[key];
    if (typeof value === "string" || typeof value === "number") params.set(key, String(value));
  }
  const destination = parseSharedDestination(params.toString());
  if (!destination || destination.name === "Shared place") return null;
  return {
    title: `Drive, TheBus or Skyline to ${destination.name}?`,
    description:
      "Nalu checks live traffic, TheBus and Skyline for this trip and says which way is faster right now, and when to leave.",
  };
}

/** Link added to an ETA message. It only opens Nalu: no place, no location. */
export function etaUrl(): string {
  return `${SITE}/?ref=eta`;
}

/** "On my way" message for family; no location, just the plan. */
export function etaText(destination: string, mode: string, arriveSeconds: number | null): string {
  const arrive = arriveSeconds == null ? null : clockFromSeconds(arriveSeconds);
  const how = mode === "drive" ? "Driving" : `Taking ${mode}`;
  return arrive ? `On my way to ${destination}. ${how}, arriving about ${arrive}.` : `On my way to ${destination}. ${how}.`;
}
