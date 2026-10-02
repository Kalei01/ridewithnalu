import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const HDOT_LANE_CLOSURE_QUERY =
  "https://services.arcgis.com/HQ0xoN0EzDPBOEci/ArcGIS/rest/services/HIDOTLaneClosureRoutesView/FeatureServer/0/query";

const pointSchema = z.object({
  lat: z.number().finite(),
  lon: z.number().finite(),
});

const schema = z.object({
  routePath: z.array(pointSchema).min(2).max(1000),
});

export type HdotLaneClosureRoute = {
  attributes: Record<string, unknown>;
  geometry: unknown;
};

type ArcGisResponse = {
  features?: Array<{
    attributes?: Record<string, unknown>;
    geometry?: unknown;
  }>;
  error?: { message?: string };
};

/**
 * Supplemental HDOT roadwork layer.
 *
 * This deliberately does NOT change TomTom routing or ETA. It asks HDOT for
 * official lane-closure route segments that spatially intersect the route
 * returned by TomTom. Schedule/details are kept separate because the ArcGIS
 * route layer is a spatial layer; HDOT's published roadwork schedule remains
 * the authoritative source for dates/times.
 */
export async function lookupHdotLaneClosureRoutes(
  data: z.infer<typeof schema>,
): Promise<HdotLaneClosureRoute[]> {
  const routePath = data.routePath.map(({ lat, lon }) => [lon, lat]);

  const params = new URLSearchParams({
    f: "json",
    where: "1=1",
    outFields: "ROUTEID,BMP,EMP,RouteDirn,Island,Route,dirn,RouteName",
    returnGeometry: "true",
    outSR: "4326",
    inSR: "4326",
    geometry: JSON.stringify({
      paths: [routePath],
      spatialReference: { wkid: 4326 },
    }),
    geometryType: "esriGeometryPolyline",
    spatialRel: "esriSpatialRelIntersects",
    returnZ: "false",
    returnM: "false",
    resultRecordCount: "1000",
  });

  try {
    const response = await fetch(HDOT_LANE_CLOSURE_QUERY, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: params,
    });

    if (!response.ok) {
      console.error("[hdot] lane-closure query failed", response.status);
      return [];
    }

    const payload = (await response.json()) as ArcGisResponse;
    if (payload.error) {
      console.error("[hdot] ArcGIS error", payload.error.message ?? "unknown error");
      return [];
    }

    return (payload.features ?? [])
      .filter((feature) => feature.attributes && feature.geometry)
      .map((feature) => ({
        attributes: feature.attributes as Record<string, unknown>,
        geometry: feature.geometry,
      }));
  } catch (error) {
    console.error("[hdot] lane-closure query unavailable", error);
    return [];
  }
}

export const hdotLaneClosureRoutes = createServerFn({ method: "POST" })
  .inputValidator((input) => schema.parse(input))
  .handler(async ({ data }) => lookupHdotLaneClosureRoutes(data));
