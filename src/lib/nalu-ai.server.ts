import { createOpenAI } from "@ai-sdk/openai";
import { Output, stepCountIs, streamText, tool } from "ai";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { routeTravelSeconds } from "./drive/traffic-summary";

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

export type RouteSummary = {
  minutes: number;
  typicalMinutes: number;
  delayMinutes: number;
  miles: number;
  roads: string[];
};

export async function routeOptions(
  from: Pt,
  to: Pt,
  opts: { arriveAt?: string; departAt?: string; alternatives?: number } = {},
): Promise<RouteSummary[]> {
  const key = process.env["TOMTOM_API_KEY"];
  if (!key) throw new Error("Drive times are not configured.");
  const url =
    `https://api.tomtom.com/routing/1/calculateRoute/${from.lat},${from.lon}:${to.lat},${to.lon}/json` +
    `?key=${key}&traffic=true&travelMode=car&routeType=fastest&computeTravelTimeFor=all` +
    `&instructionsType=text&maxAlternatives=${opts.alternatives ?? 0}` +
    (opts.arriveAt ? `&arriveAt=${encodeURIComponent(opts.arriveAt)}` : "") +
    (opts.departAt ? `&departAt=${encodeURIComponent(opts.departAt)}` : "");
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Drive lookup failed (${res.status}).`);
  const body = (await res.json()) as {
    routes?: Array<{
      summary?: {
        travelTimeInSeconds?: number;
        historicTrafficTravelTimeInSeconds?: number;
        liveTrafficIncidentsTravelTimeInSeconds?: number;
        noTrafficTravelTimeInSeconds?: number;
        lengthInMeters?: number;
      };
      guidance?: { instructions?: Array<{ street?: string; roadNumbers?: string[] }> };
    }>;
  };
  return (body.routes ?? []).map((r) => {
    // Use TomTom's canonical traffic-aware travelTimeInSeconds for both
    // current and future trips. The liveTrafficIncidents field is a separate
    // diagnostic calculation and must not make Morning Pulse disagree with
    // the main commute engine or appear unavailable when that field is absent.
    const minutes = Math.round(
      routeTravelSeconds(
        {
          travelTimeInSeconds: r.summary?.travelTimeInSeconds ?? 0,
          liveTrafficIncidentsTravelTimeInSeconds: r.summary?.liveTrafficIncidentsTravelTimeInSeconds,
        },
        Boolean(opts.departAt || opts.arriveAt),
      ) / 60,
    );
    const typical = Math.round(
      (r.summary?.historicTrafficTravelTimeInSeconds ??
        r.summary?.noTrafficTravelTimeInSeconds ??
        0) / 60,
    );
    const roads: string[] = [];
    for (const i of r.guidance?.instructions ?? []) {
      const name = i.roadNumbers?.[0] ?? i.street;
      if (name && !roads.includes(name)) roads.push(name);
    }
    return {
      minutes,
      typicalMinutes: typical,
      delayMinutes: Math.max(0, minutes - typical),
      miles: Math.round(((r.summary?.lengthInMeters ?? 0) / 1609) * 10) / 10,
      roads: roads.slice(0, 8),
    };
  });
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
    if (plan?.trips?.length) return plan;
  }

  return { originStation: nearestOrigin.name, destStation: dest.name, trips: [] };
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
      "Use local Oʻahu road names. Give leave-by times in Honolulu local time like 6:45 AM. Keep steps short. " +
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
          "Live TomTom drive between two points. Optionally arriveAt (ISO) to plan for a deadline.",
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
