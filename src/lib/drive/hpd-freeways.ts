/**
 * Oʻahu freeway gazetteer for placing Honolulu Police reports that name a
 * freeway and an exit / cross street ("H-1 Fwy EB / Moanalua").
 *
 * Each freeway is an ordered list of interchange nodes, west to east (H-2:
 * south to north). The straight lines between nodes are the freeway centre
 * line, which is all the placement needs: a report is put on the node it
 * names, on the carriageway of its direction (EB / WB / NB / SB), a few metres
 * to the driver's right of the centre line.
 *
 * Provenance: the node coordinates were written from public geography (the
 * interchange names match the TomTom guidance wording the app already shows,
 * e.g. "H-1 EB Aiea Exit", "Kunia on-ramp") and have NOT been surveyed against
 * a map in this repo. Treat each as good to a few hundred metres. They are used
 * three ways, so a wrong node can never cause a false alert on its own:
 *  - on a rider's route, a freeway report only counts after it lands within
 *    FREEWAY_SNAP_M of that same freeway on the route's own geometry;
 *  - on the island map it is shown as a pin with its stated confidence;
 *  - a report whose exit is not in the table is only "approximate".
 * Flip `verified` on a node once it has been checked against a map.
 */
import type { GeoPoint } from "./incident-correlation";

export type Heading = "EB" | "WB" | "NB" | "SB";
export type FreewayId = "H1" | "H2" | "H3" | "H201" | "LIKELIKE" | "PALI" | "NIMITZ";

type Node = { names: string[]; lat: number; lon: number; verified?: boolean };
type Freeway = { id: FreewayId; label: string; nodes: Node[] };

/** Lateral distance from the centre line to a carriageway (about half the median plus half a lane). */
const CARRIAGEWAY_OFFSET_M = 14;
/** A route freeway counts as the report's freeway when the report lands this close to it. */
export const FREEWAY_SNAP_M = 400;

export const FREEWAYS: Freeway[] = [
  {
    id: "H1",
    label: "H-1",
    nodes: [
      { names: ["makakilo", "makakilo dr", "farrington", "kalaeloa"], lat: 21.348, lon: -158.0925 },
      { names: ["kapolei pkwy", "kapolei", "kalaeloa blvd"], lat: 21.349, lon: -158.065 },
      { names: ["kualakai", "kualakai pkwy", "east kapolei", "ewa"], lat: 21.3615, lon: -158.041 },
      {
        names: ["kunia", "kunia rd", "fort barrette", "waikele", "ewa kunia"],
        lat: 21.379,
        lon: -158.012,
      },
      { names: ["fort weaver", "fort weaver rd", "ewa beach"], lat: 21.383, lon: -158.0045 },
      { names: ["waipahu", "waipahu st", "paiwa", "paiwa st"], lat: 21.3875, lon: -157.9995 },
      { names: ["waiawa", "h2", "h-2", "mililani", "wahiawa"], lat: 21.3945, lon: -157.996 },
      {
        names: ["pearl city", "waimano home", "waimano", "waiau", "pearl highlands", "lehua"],
        lat: 21.393,
        lon: -157.97,
      },
      {
        names: ["waimalu", "kaonohi", "aiea", "aiea heights", "pearlridge", "kamehameha hwy"],
        lat: 21.388,
        lon: -157.933,
      },
      {
        names: ["halawa", "stadium", "aloha stadium", "h3", "h-3", "salt lake"],
        lat: 21.3745,
        lon: -157.919,
      },
      {
        names: ["moanalua", "moanalua rd", "moanalua fwy", "h201", "h-201", "aliamanu", "tripler"],
        lat: 21.358,
        lon: -157.905,
      },
      {
        names: ["radford", "hickam", "pearl harbor", "airport", "nimitz"],
        lat: 21.34,
        lon: -157.9,
      },
      {
        names: ["middle st", "middle street", "kalihi", "dillingham", "likelike", "kam iv"],
        lat: 21.331,
        lon: -157.8855,
      },
      {
        names: ["vineyard", "vineyard blvd", "school st", "liliha", "nuuanu"],
        lat: 21.3195,
        lon: -157.8685,
      },
      {
        names: ["punchbowl", "punchbowl st", "pali", "pali hwy", "lunalilo"],
        lat: 21.3115,
        lon: -157.8545,
      },
      {
        names: ["wilder", "wilder ave", "pensacola", "makiki", "kinau"],
        lat: 21.3015,
        lon: -157.843,
      },
      {
        names: ["punahou", "university", "mccully", "kapiolani", "isenberg", "manoa"],
        lat: 21.2985,
        lon: -157.8305,
      },
      {
        names: ["kapahulu", "kaimuki", "harding", "palolo", "waialae", "waialae ave", "kahala"],
        lat: 21.2885,
        lon: -157.812,
      },
    ],
  },
  {
    id: "H2",
    label: "H-2",
    nodes: [
      { names: ["waiawa", "h1", "h-1", "pearl city"], lat: 21.3945, lon: -157.996 },
      { names: ["waipio", "waipio uka", "gentry", "mililani"], lat: 21.4075, lon: -158.0035 },
      {
        names: ["ka uka", "ka uka blvd", "waikele", "mililani mauka"],
        lat: 21.4235,
        lon: -158.0095,
      },
      { names: ["meheula", "meheula pkwy"], lat: 21.4465, lon: -158.0105 },
      { names: ["wahiawa", "wilikina", "kellogg", "kamehameha hwy"], lat: 21.4945, lon: -158.0175 },
    ],
  },
  {
    id: "H3",
    label: "H-3",
    nodes: [
      { names: ["halawa", "stadium", "h1", "h-1", "moanalua valley"], lat: 21.3745, lon: -157.919 },
      { names: ["salt lake", "red hill", "moanalua"], lat: 21.386, lon: -157.9 },
      {
        names: ["tetsuo harano", "harano tunnel", "tunnel", "haiku", "koolau"],
        lat: 21.3975,
        lon: -157.828,
      },
      { names: ["kaneohe", "likelike", "kahekili", "windward"], lat: 21.4135, lon: -157.784 },
      {
        names: ["mcbh", "marine base", "kaneohe marine", "mokapu", "kaneohe bay dr"],
        lat: 21.4265,
        lon: -157.762,
      },
    ],
  },
  {
    id: "H201",
    label: "Moanalua Freeway",
    nodes: [
      { names: ["halawa", "stadium", "h1", "h-1"], lat: 21.3715, lon: -157.918 },
      { names: ["salt lake", "salt lake blvd", "aliamanu"], lat: 21.3595, lon: -157.9 },
      {
        names: ["ala napunani", "moanalua rd", "tripler", "moanalua"],
        lat: 21.352,
        lon: -157.8925,
      },
      {
        names: ["middle st", "middle street", "kalihi", "dillingham", "h1", "h-1"],
        lat: 21.3335,
        lon: -157.8845,
      },
    ],
  },
  {
    id: "LIKELIKE",
    label: "Likelike Highway",
    nodes: [
      { names: ["king st", "dillingham", "kalihi", "school st"], lat: 21.3325, lon: -157.8725 },
      {
        names: ["kam iv", "kamehameha iv", "kalihi valley", "kam iv rd"],
        lat: 21.3395,
        lon: -157.861,
      },
      { names: ["wilson tunnel", "tunnel", "kaneohe"], lat: 21.3665, lon: -157.8265 },
      { names: ["kahekili", "haiku", "kaneohe", "windward"], lat: 21.4015, lon: -157.795 },
    ],
  },
  {
    id: "PALI",
    label: "Pali Highway",
    nodes: [
      { names: ["vineyard", "school st", "nuuanu", "liliha"], lat: 21.321, lon: -157.8575 },
      { names: ["nuuanu pali", "wyllie", "judd", "nuuanu ave"], lat: 21.3395, lon: -157.8465 },
      { names: ["pali tunnel", "tunnel", "pali lookout"], lat: 21.3625, lon: -157.7945 },
      {
        names: ["kailua", "castle junction", "kamehameha hwy", "kalanianaole", "kailua rd"],
        lat: 21.389,
        lon: -157.7635,
      },
    ],
  },
  {
    id: "NIMITZ",
    label: "Nimitz Highway",
    nodes: [
      {
        names: ["airport", "lagoon", "lagoon dr", "aolele", "mapunapuna"],
        lat: 21.3295,
        lon: -157.9105,
      },
      { names: ["kalihi", "dillingham", "puuhale", "kapalama"], lat: 21.3205, lon: -157.8845 },
      { names: ["sand island", "sand island access"], lat: 21.3135, lon: -157.8765 },
      {
        names: ["aloha tower", "bishop", "bishop st", "pacific", "alakea"],
        lat: 21.3075,
        lon: -157.8655,
      },
    ],
  },
];

export const GAZETTEER_STATS = {
  freeways: FREEWAYS.length,
  nodes: FREEWAYS.reduce((n, f) => n + f.nodes.length, 0),
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
    verified: node.verified === true,
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
