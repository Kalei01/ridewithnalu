/**
 * Oʻahu freeway gazetteer for placing Honolulu Police reports that name a
 * freeway and an exit / cross street ("H-1 Fwy EB / Paiwa St").
 *
 * Each freeway is an ordered list of interchange nodes, west to east (H-2 and
 * Likelike/Pali: south to north). A report is put on the node it names, on the
 * carriageway of its direction (EB / WB / NB / SB), a few metres to the driver's
 * right of the centre line.
 *
 * Provenance (rebuilt from real routing geometry, not memory): every node sits on
 * the freeway's actual centre line as returned by the live drive route (Mapbox
 * driving geometry, within 100 m by construction).
 *  - `verified: true` nodes were placed at a real exit / ramp maneuver on a live
 *    route ("take exit 22 onto Kinau Street", "take exit 3 toward Kapolei", the
 *    H-1/H-2 and H-1/H-201 splits ...); `source` says which. Only these can give
 *    an "exact" placement, and so only these can ever be announced.
 *  - `verified: false` nodes are a name snapped onto the real line: right road,
 *    along-the-line position only roughly known (up to ~800 m). They place an
 *    "approximate" pin on the map and never notify.
 *  - Estimates that could not be snapped within 800 m of the real line were dropped,
 *    and an alias belongs to exactly one node (no lumping of exits that are
 *    kilometres apart). A bare "Moanalua" is ambiguous (Moanalua Road or Moanalua
 *    Freeway), so it is not an alias: "Moanalua Fwy" / "H201" map to the Halawa split.
 * More verified nodes can be added the same way: route through the exit and read
 * the maneuver location.
 */
import type { GeoPoint } from "./incident-correlation";

export type Heading = "EB" | "WB" | "NB" | "SB";
export type FreewayId = "H1" | "H2" | "H3" | "H201" | "LIKELIKE" | "PALI" | "NIMITZ";

type Node = {
  names: string[];
  lat: number;
  lon: number;
  /** True only when the position comes from a real exit / ramp maneuver on a live route (see `source`). */
  verified: boolean;
  source: string;
};
type Freeway = { id: FreewayId; label: string; nodes: Node[] };

/** Lateral distance from the centre line to a carriageway (about half the median plus half a lane). */
const CARRIAGEWAY_OFFSET_M = 14;
/** A freeway report is listed (Drive Details / map) for a route that uses the same freeway within this distance. */
export const FREEWAY_LIST_M = 400;

export const FREEWAYS: Freeway[] = [
  {
    id: "H1",
    label: "H-1",
    nodes: [
      {
        names: ["kapolei pkwy", "kalaeloa blvd"],
        lat: 21.35141,
        lon: -158.06759,
        verified: false,
        source: `snapped onto the real freeway line; position along the line is an estimate`,
      },
      {
        names: ["kualakai", "kualakai pkwy", "uhwo", "east kapolei"],
        lat: 21.36761,
        lon: -158.05868,
        verified: true,
        source: `exit 3 maneuver (Kualakai Pkwy/UH West Oahu), WB route`,
      },
      {
        names: ["waipahu", "waipahu st", "paiwa", "paiwa st"],
        lat: 21.39587,
        lon: -158.00994,
        verified: true,
        source: `exit maneuver "take Paiwa Street toward Waipahu", EB route`,
      },
      {
        names: ["waiawa", "h2", "h-2"],
        lat: 21.39787,
        lon: -157.99391,
        verified: true,
        source: `H-1/H-2 split maneuver (take the left exit onto H2 N)`,
      },
      {
        names: ["pearl city", "waimano home", "waimano", "pearl highlands"],
        lat: 21.39031,
        lon: -157.97095,
        verified: false,
        source: `snapped onto the real freeway line; position along the line is an estimate`,
      },
      {
        names: ["waimalu", "kaonohi", "aiea", "aiea heights", "pearlridge"],
        lat: 21.38592,
        lon: -157.93442,
        verified: false,
        source: `snapped onto the real freeway line; position along the line is an estimate`,
      },
      {
        names: ["halawa", "aloha stadium", "stadium", "moanalua fwy", "h201", "h-201"],
        lat: 21.36978,
        lon: -157.92003,
        verified: true,
        source: `H-1/H-201 split maneuver (exit onto H201 E toward Honolulu)`,
      },
      {
        names: ["middle st", "middle street"],
        lat: 21.33492,
        lon: -157.88813,
        verified: false,
        source: `snapped onto the real freeway line; position along the line is an estimate`,
      },
      {
        names: ["king st", "king street", "north king"],
        lat: 21.34091,
        lon: -157.88617,
        verified: true,
        source: `maneuver "keep right toward King Street", EB route`,
      },
      {
        names: ["vineyard", "vineyard blvd"],
        lat: 21.32418,
        lon: -157.86528,
        verified: false,
        source: `snapped onto the real freeway line; position along the line is an estimate`,
      },
      {
        names: ["punchbowl", "punchbowl st"],
        lat: 21.31218,
        lon: -157.85301,
        verified: false,
        source: `snapped onto the real freeway line; position along the line is an estimate`,
      },
      {
        names: ["kinau", "kinau st", "exit 22"],
        lat: 21.30579,
        lon: -157.85093,
        verified: true,
        source: `exit 22 maneuver (Kinau Street), EB route`,
      },
      {
        names: ["wilder", "wilder ave", "pensacola"],
        lat: 21.30351,
        lon: -157.84217,
        verified: false,
        source: `snapped onto the real freeway line; position along the line is an estimate`,
      },
      {
        names: ["punahou", "punahou st"],
        lat: 21.29868,
        lon: -157.83038,
        verified: false,
        source: `snapped onto the real freeway line; position along the line is an estimate`,
      },
      {
        names: ["university", "university ave"],
        lat: 21.29508,
        lon: -157.82197,
        verified: false,
        source: `snapped onto the real freeway line; position along the line is an estimate`,
      },
      {
        names: ["waialae ave", "waialae"],
        lat: 21.2907,
        lon: -157.8163,
        verified: true,
        source: `maneuver "take H1 W" from Waialae Avenue, WB route`,
      },
      {
        names: ["kapahulu", "kapahulu ave"],
        lat: 21.28915,
        lon: -157.81199,
        verified: false,
        source: `snapped onto the real freeway line; position along the line is an estimate`,
      },
    ],
  },
  {
    id: "H2",
    label: "H-2",
    nodes: [
      {
        names: ["waiawa", "h1", "h-1", "pearl city"],
        lat: 21.39786,
        lon: -157.99385,
        verified: true,
        source: `H-1/H-2 split maneuver (take the left exit onto H2 N)`,
      },
    ],
  },
  {
    id: "H3",
    label: "H-3",
    nodes: [
      {
        names: ["halawa", "stadium", "h1", "h-1"],
        lat: 21.37039,
        lon: -157.91502,
        verified: true,
        source: `exit 1C maneuver (take exit 1C onto the H3 E toward Kaneohe)`,
      },
      {
        names: ["salt lake"],
        lat: 21.38489,
        lon: -157.89869,
        verified: false,
        source: `snapped onto the real freeway line; position along the line is an estimate`,
      },
      {
        names: ["tetsuo harano", "harano tunnel", "tunnel"],
        lat: 21.40197,
        lon: -157.82866,
        verified: false,
        source: `snapped onto the real freeway line; position along the line is an estimate`,
      },
      {
        names: ["mcbh", "marine base", "kaneohe marine", "kaneohe bay dr", "mokapu"],
        lat: 21.42931,
        lon: -157.75523,
        verified: false,
        source: `snapped onto the real freeway line; position along the line is an estimate`,
      },
    ],
  },
  {
    id: "H201",
    label: "Moanalua Freeway",
    nodes: [
      {
        names: ["halawa", "stadium", "h1", "h-1"],
        lat: 21.3697,
        lon: -157.9197,
        verified: true,
        source: `H-1/H-201 split maneuver (exit onto H201 E toward Honolulu)`,
      },
      {
        names: ["salt lake", "salt lake blvd", "aliamanu"],
        lat: 21.35952,
        lon: -157.89969,
        verified: false,
        source: `snapped onto the real freeway line; position along the line is an estimate`,
      },
      {
        names: ["middle st", "middle street"],
        lat: 21.3368,
        lon: -157.88271,
        verified: false,
        source: `snapped onto the real freeway line; position along the line is an estimate`,
      },
    ],
  },
  {
    id: "LIKELIKE",
    label: "Likelike Highway",
    nodes: [
      {
        names: ["wilson tunnel", "tunnel"],
        lat: 21.37069,
        lon: -157.82912,
        verified: false,
        source: `snapped onto the real freeway line; position along the line is an estimate`,
      },
      {
        names: ["kahekili", "kamehameha hwy", "kaneohe"],
        lat: 21.40282,
        lon: -157.79961,
        verified: true,
        source: `maneuver at the Likelike Hwy end / Kamehameha Hwy (HI 830) junction`,
      },
    ],
  },
  {
    id: "PALI",
    label: "Pali Highway",
    nodes: [
      {
        names: ["nuuanu pali", "wyllie", "judd", "nuuanu ave"],
        lat: 21.33554,
        lon: -157.84016,
        verified: false,
        source: `snapped onto the real freeway line; position along the line is an estimate`,
      },
      {
        names: ["pali tunnel", "tunnel", "pali lookout"],
        lat: 21.36472,
        lon: -157.79595,
        verified: false,
        source: `snapped onto the real freeway line; position along the line is an estimate`,
      },
    ],
  },
  {
    id: "NIMITZ",
    label: "Nimitz Highway",
    nodes: [
      {
        names: ["airport", "lagoon", "lagoon dr", "aolele", "mapunapuna"],
        lat: 21.33272,
        lon: -157.91549,
        verified: false,
        source: `snapped onto the real freeway line; position along the line is an estimate`,
      },
      {
        names: ["aloha tower", "bishop", "bishop st", "pacific", "alakea"],
        lat: 21.30647,
        lon: -157.86481,
        verified: false,
        source: `snapped onto the real freeway line; position along the line is an estimate`,
      },
    ],
  },
];

export const GAZETTEER_STATS = {
  freeways: FREEWAYS.length,
  nodes: FREEWAYS.reduce((n, f) => n + f.nodes.length, 0),
  verified: FREEWAYS.reduce((n, f) => n + f.nodes.filter((x) => x.verified).length, 0),
};

// ---- reading an address ------------------------------------------------------

export function plain(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[ʻ'’`.]/g, "")
    .replace(/[^A-Z0-9/&@ -]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const HEADINGS: Array<[RegExp, Heading]> = [
  [/\b(?:EB|EASTBOUND|EAST BOUND)\b/, "EB"],
  [/\b(?:WB|WESTBOUND|WEST BOUND)\b/, "WB"],
  [/\b(?:NB|NORTHBOUND|NORTH BOUND)\b/, "NB"],
  [/\b(?:SB|SOUTHBOUND|SOUTH BOUND)\b/, "SB"],
];

/** EB / WB / NB / SB from the address text, or null when it names no direction. */
export function parseHeading(address: string): Heading | null {
  const text = plain(address);
  for (const [pattern, heading] of HEADINGS) if (pattern.test(text)) return heading;
  return null;
}

/** The text without direction words, for keys and matching. */
export function stripHeading(address: string): string {
  return HEADINGS.reduce(
    (t, [pattern]) => t.replace(new RegExp(pattern.source, "g"), " "),
    plain(address),
  )
    .replace(/\s+/g, " ")
    .trim();
}

/** Which gazetteer freeway a single street name denotes, or null for an ordinary street. */
export function identifyFreeway(part: string): FreewayId | null {
  const t = stripHeading(part);
  if (/\b(?:I-?)?H-?\s?201\b/.test(t) || /\bMOANALUA (?:FWY|FREEWAY)\b/.test(t)) return "H201";
  const h = t.match(/\b(?:I-?)?H-?\s?([123])(?![0-9])/);
  if (h) return `H${h[1]}` as FreewayId;
  if (/\bLUNALILO (?:FWY|FREEWAY)\b/.test(t)) return "H1";
  if (/\bLIKELIKE\b/.test(t)) return "LIKELIKE";
  if (/\bPALI (?:HWY|HIGHWAY)\b|^PALI$/.test(t)) return "PALI";
  if (/\bNIMITZ\b/.test(t)) return "NIMITZ";
  return null;
}

const FILLER =
  /\b(?:EXIT|ON-?RAMP|OFF-?RAMP|RAMP|INTERCHANGE|ONRAMP|OFFRAMP|OFF|ON|NEAR|AT|THE|TO|FROM|FWY|FREEWAY)\b/g;
const SUFFIX =
  /\b(?:RD|ROAD|ST|STREET|AVE|AVENUE|BLVD|BOULEVARD|PKWY|PARKWAY|DR|DRIVE|HWY|HIGHWAY)$/;

function crossKey(cross: string): string {
  return stripHeading(cross).replace(FILLER, " ").replace(/\s+/g, " ").trim();
}

function findNode(freeway: Freeway, cross: string): Node | null {
  const key = crossKey(cross);
  if (!key) return null;
  const bare = key.replace(SUFFIX, "").trim();
  let best: { node: Node; score: number } | null = null;
  for (const node of freeway.nodes) {
    for (const alias of node.names) {
      const a = plain(alias);
      const exact = key === a || bare === a;
      const within = !exact && (` ${key} `.includes(` ${a} `) || ` ${bare} `.includes(` ${a} `));
      if (!exact && !within) continue;
      const score = (exact ? 100 : 0) + a.length;
      if (!best || score > best.score) best = { node, score };
    }
  }
  return best?.node ?? null;
}

// ---- geometry ---------------------------------------------------------------

const M_PER_DEG = 111_320;

function bearing(a: GeoPoint, b: GeoPoint): number {
  const dy = (b.lat - a.lat) * M_PER_DEG;
  const dx = (b.lon - a.lon) * M_PER_DEG * Math.cos((a.lat * Math.PI) / 180);
  return ((Math.atan2(dx, dy) * 180) / Math.PI + 360) % 360;
}

function offsetRight(p: GeoPoint, bearingDeg: number, meters: number): GeoPoint {
  const rad = (((bearingDeg + 90) % 360) * Math.PI) / 180;
  return {
    lat: p.lat + (Math.cos(rad) * meters) / M_PER_DEG,
    lon: p.lon + (Math.sin(rad) * meters) / (M_PER_DEG * Math.cos((p.lat * Math.PI) / 180)),
  };
}

const isForward = (heading: Heading) => heading === "EB" || heading === "NB";

/** Centre-line bearing at a node (along the W→E / S→N listing order). */
function lineBearingAt(freeway: Freeway, index: number): number {
  const a = freeway.nodes[Math.max(0, index - 1)]!;
  const b = freeway.nodes[Math.min(freeway.nodes.length - 1, index + 1)]!;
  return bearing(a, b);
}

/** The point on the heading's own carriageway, a few metres to the driver's right of the centre line. */
function onCarriageway(freeway: Freeway, index: number, heading: Heading | null): GeoPoint {
  const node = freeway.nodes[index]!;
  const centre = { lat: node.lat, lon: node.lon };
  if (!heading) return centre;
  const forward = lineBearingAt(freeway, index);
  const travel = isForward(heading) ? forward : (forward + 180) % 360;
  return offsetRight(centre, travel, CARRIAGEWAY_OFFSET_M);
}

export type FreewayPlacement = {
  freeway: FreewayId;
  label: string;
  heading: Heading | null;
  point: GeoPoint;
  /** "exit" = the named exit / cross street is in the table; "line" = only the freeway is known. */
  match: "exit" | "line";
  node: string | null;
  verified: boolean;
};

/**
 * Place a freeway report ("H1 FWY EB / MOANALUA") from the table. Null when the
 * address names no gazetteer freeway. `match: "line"` has no usable point (the
 * caller picks one along the line, e.g. nearest an area centroid).
 */
export function placeOnFreeway(address: string): FreewayPlacement | null {
  const parts = plain(address)
    .split(/\s*(?:\/|&|@|\bAT\b|\bAND\b)\s*/)
    .map((p) => p.trim())
    .filter(Boolean);
  const heading = parseHeading(address);
  for (let i = 0; i < parts.length; i += 1) {
    const id = identifyFreeway(parts[i]!);
    if (!id) continue;
    // Nimitz and Pali are ordinary roads in most reports; "Pali Hwy / Nuuanu Ave" is a street
    // intersection, so only claim them when their cross street is a known node.
    const freeway = FREEWAYS.find((f) => f.id === id)!;
    const others = parts.filter((_, j) => j !== i);
    for (const cross of others) {
      const otherId = identifyFreeway(cross);
      if (otherId && otherId !== id) {
        // "H1 / H2": the interchange between two freeways, taken from either table.
        const node = findNode(freeway, cross);
        if (node) {
          const index = freeway.nodes.indexOf(node);
          return place(freeway, index, heading, node, "exit");
        }
        continue;
      }
      const node = findNode(freeway, cross);
      if (node) return place(freeway, freeway.nodes.indexOf(node), heading, node, "exit");
    }
    if (id === "NIMITZ" || id === "PALI" || id === "LIKELIKE") {
      // Without a known cross street these are ordinary roads: let the geocoder place them.
      return null;
    }
    return {
      freeway: id,
      label: freeway.label,
      heading,
      point: { lat: freeway.nodes[0]!.lat, lon: freeway.nodes[0]!.lon },
      match: "line",
      node: null,
      verified: false,
    };
  }
  return null;
}

function place(
  freeway: Freeway,
  index: number,
  heading: Heading | null,
  node: Node,
  match: "exit" | "line",
): FreewayPlacement {
  return {
    freeway: freeway.id,
    label: freeway.label,
    heading,
    point: onCarriageway(freeway, index, heading),
    match,
    node: node.names[0]!,
    verified: node.verified,
  };
}

/** The point on a freeway's centre line closest to `target` (for "freeway + area" placements). */
export function nearestOnFreeway(
  id: FreewayId,
  target: GeoPoint,
  heading: Heading | null,
): GeoPoint {
  const freeway = FREEWAYS.find((f) => f.id === id)!;
  let best = { index: 0, d: Infinity };
  freeway.nodes.forEach((n, index) => {
    const dy = (n.lat - target.lat) * M_PER_DEG;
    const dx = (n.lon - target.lon) * M_PER_DEG * Math.cos((target.lat * Math.PI) / 180);
    const d = Math.hypot(dx, dy);
    if (d < best.d) best = { index, d };
  });
  return onCarriageway(freeway, best.index, heading);
}

/** Does a direction of travel (compass bearing) fit a heading? Within 70 degrees of the cardinal. */
export function bearingFitsHeading(travelBearing: number, heading: Heading): boolean {
  const target = { EB: 90, WB: 270, NB: 0, SB: 180 }[heading];
  const diff = Math.abs(((travelBearing - target + 540) % 360) - 180);
  return diff <= 70;
}
