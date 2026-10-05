/**
 * Where a guide's "live answer" button takes someone. Coordinates are TheBus
 * GTFS stop locations, so they sit on the street the guide talks about.
 */
export type GuideDestination = {
  /** Short place name for the button and the trip screen. */
  name: string;
  lat: number;
  lon: number;
};

export const DOWNTOWN: GuideDestination = { name: "Downtown Honolulu", lat: 21.308645, lon: -157.861772 }; // S. King St + Bishop St
export const UH_MANOA: GuideDestination = { name: "UH Mānoa", lat: 21.301841, lon: -157.820555 }; // Maile Way + University Ave
export const HNL_AIRPORT: GuideDestination = { name: "Honolulu airport (HNL)", lat: 21.333777, lon: -157.920954 }; // Lelepaua station

/** A link that opens Nalu with the trip to `destination` started (see parseSharedDestination). */
export function tripHref(destination: GuideDestination): string {
  const params = new URLSearchParams({ to: `${destination.lat},${destination.lon}`, name: destination.name });
  return `/?${params.toString()}`;
}
