/**
 * The home page map's projection: Oʻahu in a 600-wide SVG view, north up.
 * Equirectangular, scaled for Oʻahu's latitude (accurate to well under a
 * pixel at this size). The baked coastline and Skyline line (island-data.ts)
 * and live geometry (drive routes, bus shapes) all use this same projection.
 */
const LON_MIN = -158.29;
const LAT_MAX = 21.72;
const PAD = 10;
const X_SCALE = Math.cos((21.48 * Math.PI) / 180);
/** View units per degree of latitude. */
const SCALE = (600 - 2 * PAD) / (0.65 * X_SCALE);

export const OAHU_VIEW = { width: 600, height: 476 } as const;

export function projectPoint(lat: number, lon: number): [number, number] {
  return [PAD + (lon - LON_MIN) * X_SCALE * SCALE, PAD + (LAT_MAX - lat) * SCALE];
}
