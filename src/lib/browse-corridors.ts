/**
 * Which roads the Browse sheet checks for a rider. Nalu works anywhere on Oʻahu,
 * so the roads follow the rider: their saved Home and Work when both are set
 * (that is their real commute), otherwise the main road between where they are
 * and town. Nothing here assumes the west side or a trip to work.
 *
 * Only reference points live here (towns, the same kind of point the app
 * already uses for Kapolei and downtown). The road names shown to the rider
 * come from the live route itself, never from this table.
 */

export type LatLon = { lat: number; lon: number };

export type CorridorEnds = {
  /** Stable key (cache and React keys). */
  id: string;
  /** Short plain label used until the live route names its roads, e.g. "Kapolei ↔ town". */
  area: string;
  a: LatLon;
  b: LatLon;
};

type Anchor = { id: string; name: string; point: LatLon };

const TOWN: Anchor = { id: "town", name: "town", point: { lat: 21.3099, lon: -157.8644 } };

/** Where riders start from, by area. The nearest one to the rider decides. */
const ANCHORS: Anchor[] = [
  { id: "kapolei", name: "Kapolei", point: { lat: 21.3358, lon: -158.0798 } },
  { id: "ewa", name: "ʻEwa and Waipahu", point: { lat: 21.3822, lon: -158.0092 } },
  { id: "pearl", name: "Pearl City and Aiea", point: { lat: 21.3972, lon: -157.9751 } },
  { id: "waianae", name: "Waiʻanae", point: { lat: 21.4478, lon: -158.1861 } },
  { id: "mililani", name: "Mililani", point: { lat: 21.451, lon: -158.015 } },
  { id: "wahiawa", name: "Wahiawā", point: { lat: 21.5028, lon: -158.0236 } },
  { id: "northshore", name: "the North Shore", point: { lat: 21.5953, lon: -158.1031 } },
  { id: "kaneohe", name: "Kāneʻohe", point: { lat: 21.4181, lon: -157.8036 } },
  { id: "kailua", name: "Kailua", point: { lat: 21.4022, lon: -157.7394 } },
  { id: "kahuku", name: "Kahuku and Laie", point: { lat: 21.6797, lon: -157.9514 } },
  { id: "hawaiikai", name: "Hawaiʻi Kai", point: { lat: 21.2901, lon: -157.704 } },
  TOWN,
];

/** An island-sized limit: farther than this from every anchor is not Oʻahu. */
const OAHU_LIMIT_M = 45_000;

const EARTH_M = 6_371_000;
export function distanceBetweenM(a: LatLon, b: LatLon): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_M * Math.asin(Math.sqrt(h));
}

export function nearestAnchor(point: LatLon): { anchor: Anchor; meters: number } {
  let best = { anchor: TOWN, meters: Infinity };
  for (const anchor of ANCHORS) {
    const meters = distanceBetweenM(point, anchor.point);
    if (meters < best.meters) best = { anchor, meters };
  }
  return best;
}

/** True when the point is on (or near) Oʻahu. */
export function isOnOahu(point: LatLon): boolean {
  return nearestAnchor(point).meters <= OAHU_LIMIT_M;
}

const ROUND = (n: number) => Math.round(n * 1000) / 1000;
const key = (p: LatLon) => `${ROUND(p.lat)},${ROUND(p.lon)}`;

/** Home and Work closer than this are the same neighbourhood: no commute road to check. */
const MIN_COMMUTE_M = 3_000;

/**
 * The roads to check, as end pairs; each pair is checked both ways.
 * - Home and Work saved (and apart): that commute.
 * - Rider in town: west and east of town (two pairs).
 * - Anywhere else: the rider's area to town.
 * - Unknown position (no location, no saved place): town both ways, said plainly.
 * Null when the rider is not on Oʻahu.
 */
export function browseCorridors(input: {
  rider: LatLon | null;
  home: LatLon | null;
  work: LatLon | null;
}): CorridorEnds[] | null {
  const { rider, home, work } = input;
  if (rider && !isOnOahu(rider)) return null;
  if (home && work && distanceBetweenM(home, work) >= MIN_COMMUTE_M) {
    return [{ id: `commute:${key(home)}:${key(work)}`, area: "Home ↔ Work", a: home, b: work }];
  }
  const origin = rider ?? home ?? work;
  const west = ANCHORS.find((a) => a.id === "pearl")!;
  const east = ANCHORS.find((a) => a.id === "hawaiikai")!;
  if (!origin) {
    return [
      { id: "town-west", area: "town ↔ Pearl City", a: TOWN.point, b: west.point },
      { id: "town-east", area: "town ↔ Hawaiʻi Kai", a: TOWN.point, b: east.point },
    ];
  }
  const { anchor } = nearestAnchor(origin);
  if (anchor.id === "town") {
    // In town: both main roads out of town.
    return [
      { id: "town-west", area: "town ↔ Pearl City", a: TOWN.point, b: west.point },
      { id: "town-east", area: "town ↔ Hawaiʻi Kai", a: TOWN.point, b: east.point },
    ];
  }
  return [
    {
      id: `${anchor.id}-town`,
      area: `${anchor.name} ↔ town`,
      a: anchor.point,
      b: TOWN.point,
    },
  ];
}
