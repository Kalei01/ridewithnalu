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
  routeId?: string | number | null;
  routeName?: string | null;
  direction?: string | null;
  island?: string | null;
  route?: string | null;
  startMile?: string | number | null;
  endMile?: string | number | null;
};

type ArcGisResponse = {
  features?: Array<{
    attributes?: {
      ROUTEID?: string | number | null;
      RouteName?: string | null;
      RouteDirn?: string | null;
      Island?: string | null;
      Route?: string | null;
      BMP?: string | number | null;
      EMP?: string | number | null;
    };
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
    returnGeometry: "false",
    outSR: "4326",
    inSR: "4326",
    geometry: JSON.stringify({
      paths: [routePath],
      spatialReference: { wkid: 4326 },
    }),
    geometryType: "esriGeometryPolyline",
    spatialRel: "esriSpatialRelIntersects",
    resultRecordCount: "1000",
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2500);

  try {
    const response = await fetch(HDOT_LANE_CLOSURE_QUERY, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: params,
      signal: controller.signal,
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
      .filter((feature) => feature.attributes)
      .map(({ attributes }) => ({
        routeId: attributes?.ROUTEID ?? null,
        routeName: attributes?.RouteName ?? null,
        direction: attributes?.RouteDirn ?? null,
        island: attributes?.Island ?? null,
        route: attributes?.Route ?? null,
        startMile: attributes?.BMP ?? null,
        endMile: attributes?.EMP ?? null,
      }));
  } catch {
    console.warn("[hdot] lane-closure query unavailable; continuing without HDOT context");
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

export const hdotLaneClosureRoutes = createServerFn({ method: "POST" })
  .inputValidator((input) => schema.parse(input))
  .handler(async ({ data }) => lookupHdotLaneClosureRoutes(data));
