/**
 * HDOT's weekly roadwork list names roads by freeway code. H-1, H-2 and H-3
 * are what people call them anyway; H-201 is not, so it gets its everyday name
 * with the code alongside.
 */
const FAMILIAR: Record<string, string> = {
  "H-1": "H-1 Freeway",
  "H-2": "H-2 Freeway",
  "H-3": "H-3 Freeway",
  "H-201": "Moanalua Freeway",
};

/** `code` is set only when the name doesn't already contain it. */
export function hdotRoadName(route: string): { name: string; code: string | null } {
  const key = route.trim().toUpperCase().replace(/^H-?\s?/, "H-");
  const name = FAMILIAR[key];
  if (!name) return { name: route, code: null };
  return { name, code: name.includes(key) ? null : key };
}
