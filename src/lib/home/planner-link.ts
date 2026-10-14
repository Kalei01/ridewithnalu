/** Opens the real planner on a place, the same link a guide's "Try this trip" uses. */
export function plannerHref(place: { name: string; lat: number; lon: number }) {
  const params = new URLSearchParams({
    to: `${place.lat},${place.lon}`,
    name: place.name,
    ref: "home",
  });
  return `/?${params.toString()}`;
}
