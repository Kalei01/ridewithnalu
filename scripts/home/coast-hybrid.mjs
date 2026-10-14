// Prepares the Oʻahu coastline for bake-island.mts (run by hand; needs polygon-clipping@0.15.7
// installed in a scratch folder, e.g. `bun add polygon-clipping@0.15.7` there).
//   1. US Census Bureau cartographic boundary tracts, 1:500k, 2019 (Hawaiʻi), from
//      https://raw.githubusercontent.com/uscensusbureau/citysdk/master/v2/GeoJSON/500k/2019/15/tract.json
//      Honolulu County tracts on Oʻahu are unioned: a smooth, shoreline-clipped outline.
//   2. Those tracts include Pearl Harbor's water, so the harbor and lochs are cut out with
//      OpenStreetMap land (@geo-maps/earth-lands-100m, ODbL) inside a box around the harbor.
// Usage: node coast-hybrid.mjs <tract.json> <earth-lands map.geo.json> <out.geo.json>
import pc from "polygon-clipping";
import { readFileSync, writeFileSync } from "node:fs";

const [tractPath, landsPath, outPath] = process.argv.slice(2);
const inOahu = (ring) => ring.every(([x, y]) => x > -158.4 && x < -157.5 && y > 21.1 && y < 21.8);

const tracts = JSON.parse(readFileSync(tractPath, "utf8"));
const polys = [];
for (const f of tracts.features) {
  if (f.properties.COUNTYFP !== "003") continue;
  const list = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
  for (const p of list) if (inOahu(p[0])) polys.push([p]);
}
const census = pc.union(...polys);

const lands = JSON.parse(readFileSync(landsPath, "utf8"));
const g = lands.type === "FeatureCollection" ? lands.features[0].geometry : lands.geometries[0];
const osm = g.coordinates.filter((p) => inOahu(p[0]));
const harbor = [
  [
    [-158.04, 21.28],
    [-157.935, 21.28],
    [-157.935, 21.41],
    [-158.04, 21.41],
    [-158.04, 21.28],
  ],
];
const water = pc.difference(harbor, ...osm);
const out = pc.difference(census, ...water);
writeFileSync(
  outPath,
  JSON.stringify({
    type: "FeatureCollection",
    features: [
      { type: "Feature", properties: {}, geometry: { type: "MultiPolygon", coordinates: out } },
    ],
  }),
);
console.log("rings", out.map((p) => `${p[0].length}/${p.length}`).join(" "));
