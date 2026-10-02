import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const HDOT_LANE_CLOSURE_QUERY =
  "https://services.arcgis.com/HQ0xoN0EzDPBOEci/ArcGIS/rest/services/HIDOTLaneClosureRoutesView/FeatureServer/0/query";
const HDOT_OAHU_ROADWORK_URL = "https://hidot.hawaii.gov/highways/roadwork/oahu/";

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

export type HdotScheduledClosure = {
  route: string;
  direction: string | null;
  location: string;
  laneSummary: string;
  schedule: string;
  work: string | null;
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
 * Official HDOT spatial route context. This does not prove a closure is active
 * at this exact moment; the weekly schedule below provides the time window.
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

function normalizeRoute(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = value.toUpperCase().replace(/–/g, "-").match(/\bH-?\s?(\d{1,3})\b/);
  return match ? `H-${match[1]}` : null;
}

function normalizeDirection(value: string | null | undefined): string | null {
  if (!value) return null;
  const lower = value.trim().toLowerCase();
  if (lower === "eb" || lower.includes("eastbound")) return "eastbound";
  if (lower === "wb" || lower.includes("westbound")) return "westbound";
  if (lower === "nb" || lower.includes("northbound")) return "northbound";
  if (lower === "sb" || lower.includes("southbound")) return "southbound";
  return null;
}

function parseHdotOahuRoadwork(html: string): HdotScheduledClosure[] {
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#8217;|&#x2019;/gi, "’")
    .replace(/&#8211;|&#x2013;/gi, "–")
    .replace(/\s+/g, " ")
    .trim();

  const out: HdotScheduledClosure[] = [];
  const sectionRe = /—\s*([^—]+?)\s*—/g;
  const sections = [...text.matchAll(sectionRe)];

  for (let i = 0; i < sections.length; i++) {
    const title = sections[i][1].trim();
    const route = normalizeRoute(title);
    if (!route) continue;

    const bodyStart = (sections[i].index ?? 0) + sections[i][0].length;
    const bodyEnd = sections[i + 1]?.index ?? text.length;
    const body = text.slice(bodyStart, bodyEnd);

    const entries = body.split(/(?=\b\d+\)\s)/g);
    for (const raw of entries) {
      const clean = raw.replace(/^\s*\d+\)\s*/, "").trim();
      if (!clean) continue;

      const direction = normalizeDirection(clean);
      const location = clean.split(/\s+from\s+|\s+between\s+|\s+in the vicinity of\s+/i)[0].trim();

      let laneSummary = "Lane closure";
      const range = clean.match(/closure of (?:the )?(one|two|three|four|five|six|seven|eight|nine|ten)\s+to\s+(one|two|three|four|five|six|seven|eight|nine|ten) lanes?/i);
      if (range) laneSummary = `${range[1]}–${range[2]} lanes closed`;
      else if (/full closure/i.test(clean)) laneSummary = "Full closure";
      else if (/single .*lane closure|single lane closure/i.test(clean)) laneSummary = "1 lane closed";
      else if (/two .*lanes? closed/i.test(clean)) laneSummary = "2 lanes closed";
      else if (/three .*lanes? closed/i.test(clean)) laneSummary = "3 lanes closed";

      const scheduleMatch = clean.match(/(?:from|nightly from)\s+(.+?)(?:\s+for\s+|\.\s+Note:|$)/i);
      const schedule = scheduleMatch?.[1]?.trim() || "See HDOT weekly schedule";
      const workMatch = clean.match(/\sfor\s+(.+?)(?:\.\s+Note:|$)/i);

      out.push({
        route,
        direction,
        location,
        laneSummary,
        schedule,
        work: workMatch?.[1]?.trim() || null,
      });
    }
  }
  return out;
}

function routeKeys(closure: HdotLaneClosureRoute) {
  return new Set(
    [closure.routeName, closure.route]
      .map(normalizeRoute)
      .filter((value): value is string => Boolean(value)),
  );
}

/**
 * Fetches the current official Oʻahu weekly schedule and keeps only entries
 * whose freeway/route and direction are represented by the spatial HDOT
 * segments intersecting Nalu's TomTom route.
 */
export async function lookupHdotScheduledClosures(
  spatialClosures: HdotLaneClosureRoute[],
): Promise<HdotScheduledClosure[]> {
  if (!spatialClosures.length) return [];

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2500);

  try {
    const response = await fetch(HDOT_OAHU_ROADWORK_URL, {
      headers: { Accept: "text/html" },
      signal: controller.signal,
    });
    if (!response.ok) {
      console.warn("[hdot] weekly roadwork page failed", response.status);
      return [];
    }

    const html = await response.text();
    const scheduled = parseHdotOahuRoadwork(html);
    const routeKeysOnPath = new Set(spatialClosures.flatMap(routeKeys));

    return scheduled
      .filter((item) => {
        if (!routeKeysOnPath.has(item.route)) return false;
        const directions = spatialClosures
          .filter((closure) => routeKeys(closure).has(item.route))
          .map((closure) => normalizeDirection(closure.direction ?? ""));
        return !item.direction || directions.includes(item.direction);
      })
      .sort((a, b) => {
        const laneWeight = (value: string) =>
          value.includes("3–4") ? 5 : value.includes("2–3") ? 4 : value.includes("Full") ? 4 : value.includes("2") ? 3 : 1;
        return laneWeight(b.laneSummary) - laneWeight(a.laneSummary);
      })
      .slice(0, 4);
  } catch {
    console.warn("[hdot] weekly roadwork unavailable; continuing without schedule");
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

export const hdotLaneClosureRoutes = createServerFn({ method: "POST" })
  .inputValidator((input) => schema.parse(input))
  .handler(async ({ data }) => {
    const spatial = await lookupHdotLaneClosureRoutes(data);
    const scheduled = await lookupHdotScheduledClosures(spatial);
    return { spatial, scheduled };
  });
