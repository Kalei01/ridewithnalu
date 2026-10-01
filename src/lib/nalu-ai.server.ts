import { createOpenAI } from "@ai-sdk/openai";
import { Output, stepCountIs, streamText, tool } from "ai";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

export type Pt = { lat: number; lon: number };

export class AiGatewayError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

function model() {
  // Portable: a standard OPENAI_API_KEY (e.g. on Vercel) wins; otherwise the
  // hosted gateway is used. OPENAI_MODEL optionally overrides the model name.
  const openaiKey = process.env["OPENAI_API_KEY"];
  if (openaiKey) {
    const openai = createOpenAI({ apiKey: openaiKey, baseURL: process.env["OPENAI_BASE_URL"] ?? "https://api.openai.com/v1" });
    return openai.responses(process.env["OPENAI_MODEL"] ?? "gpt-5-mini");
  }
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new AiGatewayError("AI is not configured yet.", 401);
  const lovable = createOpenAI({
    baseURL: "https://ai.gateway.lovable.dev/v1",
    apiKey: key,
    headers: { "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
  });
  return lovable.responses("openai/gpt-6-astra");
}

const reasoning = {
  openai: {
    forceReasoning: true,
    reasoningEffort: "low",
    store: false,
    include: ["reasoning.encrypted_content"],
  },
};

/** Maps gateway failures to calm, user-facing messages. */
export function friendlyAiError(error: unknown): string {
  const status =
    (error as { statusCode?: number; status?: number })?.statusCode ??
    (error as { status?: number })?.status;
  if (status === 402) return "Nalu AI is paused: the workspace is out of AI credits.";
  if (status === 429) return "Nalu AI is busy right now. Try again in a minute.";
  if (status === 403) return "Nalu AI isn't available for this workspace right now.";
  if (error instanceof AiGatewayError) return error.message;
  return "Nalu AI couldn't answer just now.";
}

export async function aiObject<T extends z.ZodTypeAny>(system: string, prompt: string, schema: T) {
  const result = streamText({
    model: model(),
    system,
    prompt,
    output: Output.object({ schema }),
    providerOptions: reasoning,
  });
  return (await result.output) as z.infer<T>;
}

// ---- Data helpers the AI may use (server-side only) ----

const OAHU = { topLeft: "21.75,-158.35", btmRight: "21.20,-157.60" };

export async function geocodeOahu(query: string): Promise<(Pt & { label: string }) | null> {
  const key = process.env["TOMTOM_API_KEY"];
  if (!key) throw new Error("Place search is not configured.");
  const params = new URLSearchParams({
    key,
    countrySet: "US",
    topLeft: OAHU.topLeft,
    btmRight: OAHU.btmRight,
    limit: "5",
    language: "en-US",
  });
  const res = await fetch(
    `https://api.tomtom.com/search/2/search/${encodeURIComponent(query)}.json?${params}`,
  );
  if (!res.ok) throw new Error(`Place search failed (${res.status}).`);
  const body = (await res.json()) as {
    results?: Array<{
      poi?: { name?: string };
      address?: { freeformAddress?: string };
      position?: Pt;
      entryPoints?: Array<{ type?: string; position?: Pt }>;
    }>;
  };
  const hit = body.results?.find((r) => r.position);
  if (!hit?.position) return null;
  const door = hit.entryPoints?.find((e) => e.type === "main")?.position ?? hit.position;
  return {
    lat: door.lat,
    lon: door.lon,
    label: hit.poi?.name ?? hit.address?.freeformAddress ?? query,
  };
}


export type RouteTrafficIncident = {
  id: string | null;
  type: string;
  description: string | null;
  road: string | null;
  delayMinutes: number;
  severity: "unknown" | "minor" | "moderate" | "major" | "undefined";
  from: string | null;
  to: string | null;
  endTime: string | null;
};

const incidentCategory: Record<number, string> = {
  0: "Unknown", 1: "Accident", 2: "Fog", 3: "Dangerous conditions",
  4: "Rain", 5: "Ice", 6: "Traffic jam", 7: "Lane closure",
  8: "Road closure", 9: "Road works", 10: "Wind", 11: "Flooding",
  12: "Detour", 13: "Traffic incident", 14: "Stalled vehicle",
};

const incidentSeverity: Record<number, RouteTrafficIncident["severity"]> = {
  0: "unknown", 1: "minor", 2: "moderate", 3: "major", 4: "undefined",
};

function familiarRoadName(road: string | null | undefined): string | null {
  const raw = road?.trim();
  if (!raw) return null;
  const upper = raw.toUpperCase().replace(/\s+/g, " ");
  const match = upper.match(/^(?:HI|H)[- ]?(\d+)(?:[- ](\d+))?$/);
  const number = match?.[1] ?? null;
  const qualifier = match?.[2] ?? null;
  const common: Record<string, string> = {
    "1": "H-1 Freeway", "2": "H-2 Freeway", "3": "H-3 Freeway",
    "201": "Moanalua Freeway", "63": "Pali Highway", "83": "Kamehameha Highway",
    "92": "Nimitz Highway", "93": "Farrington Highway", "99": "Kamehameha Highway",
    "764": "Geiger Road",
  };
  if (number) return qualifier || !common[number] ? null : common[number];
  return raw;
}

function distancePointToSegmentMeters(point: Pt, a: Pt, b: Pt): number {
  const scaleX = 111320 * Math.max(0.2, Math.cos(point.lat * Math.PI / 180));
  const scaleY = 110540;
  const px = point.lon * scaleX, py = point.lat * scaleY;
  const ax = a.lon * scaleX, ay = a.lat * scaleY;
  const bx = b.lon * scaleX, by = b.lat * scaleY;
  const dx = bx - ax, dy = by - ay, lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSquared));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function distancePointToPolylineMeters(point: Pt, polyline: Pt[]): number {
  let best = Number.POSITIVE_INFINITY;
  for (let i = 1; i < polyline.length; i += 1) {
    best = Math.min(best, distancePointToSegmentMeters(point, polyline[i - 1], polyline[i]));
  }
  return best;
}

function incidentRequiresDetour(incident: RouteTrafficIncident): boolean {
  return incident.type === "Road closure" || incident.type === "Lane closure";
}

function incidentMateriallyAffectsRoute(incident: RouteTrafficIncident): boolean {
  if (incident.type === "Road closure" || incident.type === "Lane closure") return true;
  if (incident.type === "Stalled vehicle" || incident.type === "Accident" || incident.type === "Road works") {
    return incident.severity === "moderate" || incident.severity === "major" || incident.delayMinutes >= 3;
  }
  return incident.delayMinutes >= 3 || incident.severity === "major";
}

function incidentCoordinates(value: unknown): Pt[] {
  if (!Array.isArray(value)) return [];
  if (value.length >= 2 && typeof value[0] === "number" && typeof value[1] === "number") {
    return [{ lat: Number(value[1]), lon: Number(value[0]) }];
  }
  return value.flatMap(incidentCoordinates);
}

async function trafficIncidentsForRoute(routePoints: Pt[], key: string): Promise<RouteTrafficIncident[]> {
  if (routePoints.length < 2) return [];
  const lats = routePoints.map((p) => p.lat), lons = routePoints.map((p) => p.lon);
  const top = OAHU.topLeft.split(",").map(Number), bottom = OAHU.btmRight.split(",").map(Number);
  const minLat = Math.max(bottom[0], Math.min(...lats) - 0.004);
  const maxLat = Math.min(top[0], Math.max(...lats) + 0.004);
  const minLon = Math.max(top[1], Math.min(...lons) - 0.006);
  const maxLon = Math.min(bottom[1], Math.max(...lons) + 0.006);
  if (minLat >= maxLat || minLon >= maxLon) return [];

  const params = new URLSearchParams({
    key,
    bbox: [minLon, minLat, maxLon, maxLat].join(","),
    fields: "{incidents{type,geometry{type,coordinates},properties{id,iconCategory,magnitudeOfDelay,events{description,code,iconCategory},startTime,endTime,from,to,delay,roadNumbers,timeValidity}}}",
    language: "en-GB",
    timeValidityFilter: "present",
  });

  try {
    const response = await fetch("https://api.tomtom.com/traffic/services/5/incidentDetails?" + params.toString());
    if (!response.ok) {
      console.warn("[traffic] incident lookup failed", response.status);
      return [];
    }
    const body = await response.json() as {
      incidents?: Array<{
        geometry?: { coordinates?: unknown };
        properties?: {
          id?: string; iconCategory?: number; magnitudeOfDelay?: number;
          events?: Array<{ description?: string }>;
          endTime?: string; from?: string; to?: string; delay?: number; roadNumbers?: string[];
        };
      }>;
    };

    const incidents: RouteTrafficIncident[] = [];
    for (const incident of body.incidents ?? []) {
      const points = incidentCoordinates(incident.geometry?.coordinates);
      if (!points.length || Math.min(...points.map((p) => distancePointToPolylineMeters(p, routePoints))) > 500) continue;
      const p = incident.properties ?? {}, event = p.events?.[0];
      const type = typeof p.iconCategory === "number" ? (incidentCategory[p.iconCategory] ?? "Traffic incident") : (event?.description ?? "Traffic incident");
      incidents.push({
        id: p.id ?? null,
        type,
        description: event?.description ?? null,
        road: familiarRoadName(p.roadNumbers?.[0]) ?? p.roadNumbers?.[0] ?? p.from ?? null,
        delayMinutes: typeof p.delay === "number" && p.delay > 0 ? Math.round(p.delay / 60) : 0,
        severity: typeof p.magnitudeOfDelay === "number" ? (incidentSeverity[p.magnitudeOfDelay] ?? "unknown") : "unknown",
        from: p.from ?? null,
        to: p.to ?? null,
        endTime: p.endTime ?? null,
      });
    }

    const seen = new Set<string>();
    return incidents.sort((a, b) => b.delayMinutes - a.delayMinutes).filter((item) => {
      const key = [item.id ?? "", item.type, item.road ?? "", item.from ?? ""].join("|");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 5);
  } catch (error) {
    console.warn("[traffic] incident lookup error", error);
    return [];
  }
}

export type RouteSummary = {
  minutes: number;
  typicalMinutes: number;
  delayMinutes: number;
  miles: number;
  roads: string[];
  incidents: RouteTrafficIncident[];
};

export async function routeOptions(
  from: Pt,
  to: Pt,
  opts: { arriveAt?: string; departAt?: string; alternatives?: number } = {},
): Promise<RouteSummary[]> {
  const key = process.env["TOMTOM_API_KEY"];
  if (!key) throw new Error("Drive times are not configured.");

  const url = "https://api.tomtom.com/maps/orbis/routing/routes/calculate?apiVersion=3";
  const routeBody = {
    routePlanningLocations: {
      origin: { type: "Point", coordinates: [from.lon, from.lat] },
      destination: { type: "Point", coordinates: [to.lon, to.lat] },
    },
    traffic: "live",
    routeType: "fast",
    travelMode: "car",
    vehicleEngineType: "combustion",
    ...(opts.departAt ? { departureDateTime: opts.departAt } : {}),
    ...(opts.arriveAt ? { arrivalDateTime: opts.arriveAt } : {}),
    ...(opts.alternatives && opts.alternatives > 0
      ? { maxPathAlternativeRoutes: Math.min(5, Math.max(0, opts.alternatives)) }
      : {}),
    guidance: "instructions",
    instructionPhonetics: "ipa",
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "TomTom-Api-Key": key,
      "TomTom-Api-Version": "3",
      Accept: "application/json",
      Attributes: "routes",
      "Accept-Language": "en-GB",
    },
    body: JSON.stringify(routeBody),
  });
  if (!res.ok) throw new Error(`Drive lookup failed (TomTom Orbis ${res.status}).`);

  const body = (await res.json()) as {
    routes?: Array<{
      summary?: {
        travelDurationInSeconds?: number;
        trafficDelayDurationInSeconds?: number;
        lengthInMeters?: number;
      };
      instructions?: Array<{
        message?: string;
        nextRoadInformation?: {
          roadNames?: Array<{ text?: string }>;
          roadNumbers?: Array<{ text?: string }>;
        };
        previousRoadInformation?: {
          roadNames?: Array<{ text?: string }>;
          roadNumbers?: Array<{ text?: string }>;
        };
      }>;
      path?: { coordinates?: Array<[number, number]> };
      legs?: Array<{ path?: { coordinates?: Array<[number, number]> } }>;
    }>;
  };

  const routes = await Promise.all((body.routes ?? []).map(async (r) => {
    const summary = r.summary;
    const minutes = Math.round((summary?.travelDurationInSeconds ?? 0) / 60);
    const delayMinutes = Math.round((summary?.trafficDelayDurationInSeconds ?? 0) / 60);

    const roads: string[] = [];
    for (const instruction of r.instructions ?? []) {
      const roadInfo = instruction.nextRoadInformation ?? instruction.previousRoadInformation;
      const name = roadInfo?.roadNames?.[0]?.text ?? roadInfo?.roadNumbers?.[0]?.text;
      if (name && !roads.includes(name)) roads.push(name);
    }

    const routePoints = [
      ...(r.path?.coordinates ?? []),
      ...((r.legs ?? []).flatMap((leg) => leg.path?.coordinates ?? [])),
    ].map(([lon, lat]) => ({ lat, lon }));

    const incidents = opts.departAt || opts.arriveAt
      ? []
      : (await trafficIncidentsForRoute(routePoints, key)).filter(incidentMateriallyAffectsRoute);

    return {
      minutes,
      // Orbis v3 does not expose the legacy historicTrafficTravelTimeInSeconds
      // field. The live route duration is the canonical ETA; use its explicit
      // traffic delay for the current-vs-free-flow signal instead of inventing
      // a historical baseline.
      typicalMinutes: Math.max(0, minutes - delayMinutes),
      delayMinutes,
      miles: Math.round(((summary?.lengthInMeters ?? 0) / 1609) * 10) / 10,
      roads: roads.slice(0, 8),
      incidents,
    };
  }));

  return routes;
}

function publicDb() {
  const url = process.env["SUPABASE_URL"]!;
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient(url, key, {
    auth: { persistSession: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`)
          h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

/** Nearest Skyline station and its next departures, straight from the GTFS feed. */
export async function nearestStation(point: Pt) {
  const db = publicDb();
  const { data } = await db.rpc("nearest_stop", {
    p_lat: point.lat,
    p_lon: point.lon,
    p_rail_only: true,
  });
  const row = (Array.isArray(data) ? data[0] : data) as
    | {
        stop_id?: string;
        stop_name?: string;
        stop_lat?: number;
        stop_lon?: number;
        distance_m?: number;
      }
    | undefined;
  if (!row?.stop_id) return null;
  return {
    stopId: row.stop_id,
    name: row.stop_name ?? "",
    lat: Number(row.stop_lat),
    lon: Number(row.stop_lon),
    distanceMiles: row.distance_m ? Math.round((Number(row.distance_m) / 1609) * 10) / 10 : null,
  };
}

const SKYLINE_STATIONS = [
  "Kualakaʻi East Kapolei Station",
  "Keoneʻae UH West Oʻahu Station",
  "Honouliuli Hoʻopili Station",
  "Hōʻaʻae West Loch Station",
  "Pouhala Waipahu Transit Center Station",
  "Hālaulani Leeward Community College Station",
  "Waiawa Pearl Highlands Station",
  "Kalauao Pearlridge Station",
  "Hālawa Aloha Stadium Station",
  "Makalapa Joint Base Pearl Harbor-Hickam Station",
  "Lelepaua Daniel K. Inouye International Airport Station",
  "Āhua Lagoon Drive Station",
  "Kahauiki Kalihi Transit Center Station",
] as const;

function skylineStationIndex(name: string): number | null {
  const normalized = name.toLowerCase().replace(/[ʻ'’]/g, "'").replace(/[^a-z0-9]+/g, " ").trim();
  const index = SKYLINE_STATIONS.findIndex((station) => {
    const stationNormalized = station.toLowerCase().replace(/[ʻ'’]/g, "'").replace(/[^a-z0-9]+/g, " ").trim();
    return normalized.includes(stationNormalized) || stationNormalized.includes(normalized);
  });
  return index >= 0 ? index : null;
}

async function stationByName(name: string) {
  const point = await geocodeOahu(name);
  return point ? await nearestStation(point) : null;
}

export async function railBetween(fromStop: string, fromPoint: Pt, toPoint: Pt, afterSeconds: number) {
  const db = publicDb();
  const dest = await nearestStation(toPoint);
  if (!dest) return null;
  const { data } = await db.rpc("plan_outbound", {
    p_origin_lat: fromPoint.lat,
    p_origin_lon: fromPoint.lon,
    p_station: fromStop,
    p_dest_stop: dest.stopId,
    p_after_seconds: afterSeconds,
    p_limit: 2,
    p_allow_drive: false,
    p_dest_lat: toPoint.lat,
    p_dest_lon: toPoint.lon,
  });

  if (!(data ?? []).length) {
    const fallback = await db.rpc("plan_outbound", {
      p_origin_lat: fromPoint.lat,
      p_origin_lon: fromPoint.lon,
      p_station: fromStop,
      p_dest_stop: dest.stopId,
      p_after_seconds: afterSeconds,
      p_limit: 2,
      p_allow_drive: true,
      p_dest_lat: toPoint.lat,
      p_dest_lon: toPoint.lon,
    });
    const fallbackRows = (fallback.data ?? []) as Array<{
      depart_seconds: number;
      arrive_seconds: number;
      total_minutes: number;
    }>;
    if (fallbackRows.length) return { originStation: fromStop, destStation: dest.name, trips: fallbackRows.slice(0, 2) };
  }

  const rows = (data ?? []) as Array<{
    depart_seconds: number;
    arrive_seconds: number;
    total_minutes: number;
  }>;
  return { originStation: fromStop, destStation: dest.name, trips: rows.slice(0, 2) };
}

function skylineServiceStatus(afterSeconds: number): "service-active" | "service-ended" {
  // Current published Skyline Segment 2 span: 4:00 AM–10:30 PM daily.
  // Keep this deterministic and separate from trip availability so the UI can
  // distinguish "service has ended" from "no matching trip was found."
  const daySeconds = ((afterSeconds % 86400) + 86400) % 86400;
  return daySeconds >= 4 * 3600 && daySeconds < 22 * 3600 + 30 * 60
    ? "service-active"
    : "service-ended";
}

export async function bestRailBetween(fromPoint: Pt, toPoint: Pt, afterSeconds: number) {
  const nearestOrigin = await nearestStation(fromPoint);
  const dest = await nearestStation(toPoint);
  if (!nearestOrigin || !dest) return null;

  const originIndex = skylineStationIndex(nearestOrigin.name);
  const destIndex = skylineStationIndex(dest.name);
  const candidates: Array<typeof nearestOrigin> = [nearestOrigin];

  if (originIndex !== null && destIndex !== null && originIndex > destIndex) {
    for (let index = originIndex - 1; index > destIndex; index -= 1) {
      const candidate = await stationByName(SKYLINE_STATIONS[index]);
      if (candidate && !candidates.some((existing) => existing.stopId === candidate.stopId)) {
        candidates.push(candidate);
      }
    }
  }

  for (const candidate of candidates) {
    const plan = await railBetween(candidate.stopId, fromPoint, toPoint, afterSeconds);
    if (plan?.trips?.length) return { ...plan, serviceStatus: skylineServiceStatus(afterSeconds) };
  }

  return {
    originStation: nearestOrigin.name,
    destStation: dest.name,
    trips: [],
    serviceStatus: skylineServiceStatus(afterSeconds),
  };
}

export function honoluluSeconds(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Pacific/Honolulu",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return get("hour") * 3600 + get("minute") * 60 + get("second");
}

export function hstIso(offsetMinutes: number) {
  return new Date(Date.now() + offsetMinutes * 60_000).toISOString();
}

// ---- Ask Nalu agent ----

const PlanAnswer = z.object({
  recommendation: z.string(),
  mode: z.enum(["drive", "park-and-ride", "transit", "mixed"]),
  leaveBy: z.string(),
  steps: z.array(z.string()),
  caveat: z.string(),
});
export type AskNaluAnswer = z.infer<typeof PlanAnswer>;

export async function runAskNalu(
  query: string,
  origin: Pt | null,
) {
  const nowHst = new Intl.DateTimeFormat("en-US", {
    timeZone: "Pacific/Honolulu",
    weekday: "long",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date());
  const result = streamText({
    model: model(),
    stopWhen: stepCountIs(50),
    system:
      `You are Nalu, a calm Oʻahu commute planner. Current Honolulu time: ${nowHst}. ` +
      "Use the tools for every place, drive time and Skyline lookup; never guess times or coordinates. " +
      "The provided 'origin' is only the rider's current/device starting point. If the rider explicitly names a different starting place in their request (for example, 'Pearlridge to Ala Moana'), the named place overrides the device origin for that trip. Resolve that explicit origin with findPlace and use its coordinates for both driving and Skyline. Never silently substitute the device origin for a place the rider explicitly named. Compare driving with Skyline access when relevant. Never assume the geographically nearest station is the correct rail access point: the access station must be on the correct direction of travel toward the destination. The skylineTrip tool performs this directional station selection using the trip's actual origin coordinates. " +
      "Use familiar local Oʻahu road names with route designations when available, such as Moanalua Freeway (HI-78) or Kamehameha Highway (HI-99). If the trip can start immediately, say 'Leave now' rather than 'Leave by Now' and do not append the current clock time unless the rider explicitly asks for it. For navigation steps, prefer natural major-road phrasing such as 'Take Moanalua Freeway (HI-78) east toward H-1' rather than a list of every turn or transition. Give leave-by times in Honolulu local time like 6:45 AM. Keep steps short. " +
      "Consumer output must never mention internal tools, database lookups, coordinate selection, debug reasoning, or implementation details. " +
      "For Skyline, distinguish service-ended from no matching trip: if serviceStatus is service-ended, say Skyline service has ended for now; if service is active but no trip is returned, say no matching trip was found for that direction/time. Never claim a route is unavailable solely because a tool returned no trips without explaining which case applies. " +
      "Do not say 'no reported traffic delay', 'traffic is clear', or similar unless the data explicitly establishes that. No incident reported does not mean no congestion. If a route-relevant closure or lane closure is returned, do not also lead with '0 minutes of traffic delay' because that is confusing. Treat the TomTom drive ETA as the ETA for the route it actually returned: do not add invented detour minutes. If the incident is a closure/lane closure, say the current route is being affected and tell the rider to follow live rerouting; only say the closure may add time if the route ETA does not already account for it. Use the live drive ETA and delayMinutes when discussing traffic. If driveTime returns relevant traffic incidents, treat them as live route-specific evidence: mention the specific cause when it materially affects the trip, especially a stalled vehicle, crash, closure, lane closure, road works, or major delay. Do not mention incidents that are not relevant to the selected route. Do not invent an incident cause from delayMinutes alone. " +
      "If the destination is a business, mall, venue, or similar place and the requested arrival is late, add a concise reminder to confirm it is open. Do not invent hours. " +
      "Do not ask follow-up questions just because the request is broad. Make reasonable, transparent assumptions using the rider’s origin, current Honolulu time, and common Oʻahu destinations. " +
      "Treat the rider’s entire message as the source of truth for intent. If multiple places or stops are named, resolve every relevant place with findPlace and preserve the order the rider described; do not reduce the request to one destination. " +
      "Never require autocomplete, a selected place, or exact address syntax—the rider may type naturally. Resolve familiar Oʻahu landmarks, malls, workplaces, neighborhoods, stations, and street addresses with findPlace. " +
      "For multi-stop requests, calculate the route leg by leg and account for the required sequence and any stated deadline. For deadline requests, use the deadline with driveTime where useful and include realistic transfer/wait time for Skyline when relevant. " +
      "Only ask a follow-up when a required fact truly cannot be safely inferred or found with the tools. If the request can be answered now, answer it now rather than ending with a question.",
    prompt:
      `Rider request: ${query}\nOrigin available: ${origin ? "yes" : "no"}\nNo place has been pre-selected; resolve places directly from the rider’s natural-language request.`,
    tools: {
      findPlace: tool({
        description: "Find an Oʻahu place or address. Returns door coordinates.",
        inputSchema: z.object({ query: z.string() }),
        execute: async ({ query: q }) => (await geocodeOahu(q)) ?? { error: "not found" },
      }),
      getOrigin: tool({
        description: "The rider's current starting point.",
        inputSchema: z.object({}),
        execute: async () => origin ?? { error: "No origin shared; ask the rider for a start." },
      }),
      driveTime: tool({
        description:
          "Live TomTom drive between two points. Returns current route ETA, delay, roads, and route-relevant traffic incidents when available. Optionally arriveAt (ISO) to plan for a deadline. Current incident data is intentionally omitted for future arrive-by/depart-at calculations.",
        inputSchema: z.object({
          fromLat: z.number(),
          fromLon: z.number(),
          toLat: z.number(),
          toLon: z.number(),
          arriveAt: z.string().optional(),
        }),
        execute: async (i) => {
          const [route] = await routeOptions(
            { lat: i.fromLat, lon: i.fromLon },
            { lat: i.toLat, lon: i.toLon },
            i.arriveAt ? { arriveAt: i.arriveAt } : {},
          );
          return route ?? { error: "no route" };
        },
      }),
      nearestSkylineStation: tool({
        description: "Nearest Skyline rail station to a point.",
        inputSchema: z.object({ lat: z.number(), lon: z.number() }),
        execute: async (p) => (await nearestStation(p)) ?? { error: "none" },
      }),
      skylineTrip: tool({
        description:
          "Find the best directional Skyline trip between the supplied trip origin and destination. The from coordinates MUST be the actual origin of this request, including an origin explicitly named by the rider; do not substitute the device origin. Do not choose the access station yourself; this tool checks the rail corridor direction and avoids stations beyond the destination.",
        inputSchema: z.object({
          fromLat: z.number(),
          fromLon: z.number(),
          toLat: z.number(),
          toLon: z.number(),
          afterSeconds: z.number(),
        }),
        execute: async (i) =>
          await bestRailBetween(
            { lat: i.fromLat, lon: i.fromLon },
            { lat: i.toLat, lon: i.toLon },
            i.afterSeconds,
          ) ?? {
            error: "no rail",
          },
      }),
      currentTime: tool({
        description: "Current Honolulu time as ISO and seconds since midnight.",
        inputSchema: z.object({}),
        execute: async () => ({
          iso: new Date().toISOString(),
          secondsSinceMidnight: honoluluSeconds(),
        }),
      }),
    },
    output: Output.object({ schema: PlanAnswer }),
    providerOptions: reasoning,
  });
  return (await result.output) as AskNaluAnswer;
}
