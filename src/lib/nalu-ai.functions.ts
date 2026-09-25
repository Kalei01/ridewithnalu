import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const point = z.object({
  lat: z.number().min(21).max(22),
  lon: z.number().min(-158.4).max(-157.5),
});

export type AiResult<T> = { ok: true; value: T } | { ok: false; error: string };

/** Nalu Morning Pulse: two calm sentences about the rider's usual commute. */
export const morningPulse = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        from: point,
        to: point,
        destinationLabel: z.string().max(30),
        trainsEveryMinutes: z.number().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<AiResult<{ text: string; faster: string }>> => {
    const ai = await import("./nalu-ai.server");
    try {
      const [drive] = await ai.routeOptions(data.from, data.to);
      const station = await ai.nearestStation(data.from);
      const rail = station
        ? await ai.railBetween(station.stopId, data.to, ai.honoluluSeconds() + 10 * 60)
        : null;
      const railTrip = rail?.trips[0];
      const now = ai.honoluluSeconds();
      const parkRideMinutes = railTrip ? Math.round((railTrip.arrive_seconds - now) / 60) : null;
      const facts = {
        destination: data.destinationLabel,
        driveMinutes: drive?.minutes ?? null,
        driveTypicalMinutes: drive?.typicalMinutes ?? null,
        driveDelayMinutes: drive?.delayMinutes ?? null,
        driveRoads: drive?.roads ?? [],
        nearestStation: station?.name ?? null,
        stationMiles: station?.distanceMiles ?? null,
        skylineDoorToDoorMinutesIncludingWaitAndDriveToStation: parkRideMinutes,
        trainsEveryMinutes: data.trainsEveryMinutes,
      };
      const out = await ai.aiObject(
        "You write Nalu Morning Pulse: exactly two short, calm sentences (under 40 words total) for an Oʻahu commuter. " +
          "Sentence 1: the worst current slowdown on their drive (use the road names and delay), or say roads look normal. " +
          "Sentence 2: whether driving or Skyline (park-and-ride when a station drive is involved) is faster right now and by how much. " +
          "Only use the numbers given; if a number is null, don't invent it.",
        JSON.stringify(facts),
        z.object({ text: z.string(), faster: z.enum(["drive", "skyline", "similar", "unknown"]) }),
      );
      return { ok: true, value: out };
    } catch (error) {
      console.error("[ai] morningPulse", error);
      return { ok: false, error: ai.friendlyAiError(error) };
    }
  });

/** Ask Nalu: natural-language, multi-stop trip planning. */
export const askNalu = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({ query: z.string().min(4).max(400), origin: point.nullable() }).parse(input),
  )
  .handler(async ({ data }) => {
    const ai = await import("./nalu-ai.server");
    try {
      const value = await ai.runAskNalu(data.query, data.origin);
      return { ok: true as const, value };
    } catch (error) {
      console.error("[ai] askNalu", error);
      return { ok: false as const, error: ai.friendlyAiError(error) };
    }
  });

/** Beat the Rush: is congestion building faster than usual on this commute? */
export const rushOutlook = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ from: point, to: point }).parse(input))
  .handler(async ({ data }) => {
    const ai = await import("./nalu-ai.server");
    try {
      const [now] = await ai.routeOptions(data.from, data.to);
      const [later] = await ai.routeOptions(data.from, data.to, { departAt: ai.hstIso(30) });
      if (!now || !later) return { warn: false as const };
      const building = later.minutes - now.minutes;
      const aboveUsual = now.delayMinutes;
      const warn = aboveUsual >= 5 && building >= 4;
      return {
        warn,
        nowMinutes: now.minutes,
        laterMinutes: later.minutes,
        delayMinutes: aboveUsual,
        roads: now.roads.slice(0, 3),
      };
    } catch (error) {
      console.error("[ai] rushOutlook", error);
      return { warn: false as const };
    }
  });

/** Mid-commute rescue: evaluate alternate corridors and a Skyline hub when delay spikes. */
export const rescueAdvice = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        from: point,
        to: point,
        currentMinutes: z.number(),
        spikeMinutes: z.number(),
        currentRoads: z.array(z.string().max(40)).max(10),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<AiResult<{ headline: string; spoken: string }>> => {
    const ai = await import("./nalu-ai.server");
    try {
      const routes = await ai.routeOptions(data.from, data.to, { alternatives: 2 });
      const station = await ai.nearestStation(data.from);
      const out = await ai.aiObject(
        "You are Nalu's mid-commute rescue advisor for an Oʻahu driver. Given the current route and TomTom alternatives, " +
          "recommend at most one detour (by road names) only if it saves at least 3 minutes; otherwise say stay the course. " +
          "Mention the nearby Skyline station as a park-and-ride option only if it is within 3 miles. " +
          "headline: under 12 words. spoken: one sentence under 25 words, safe to hear while driving.",
        JSON.stringify({
          currentMinutes: data.currentMinutes,
          delayJumpMinutes: data.spikeMinutes,
          currentRoads: data.currentRoads,
          alternatives: routes,
          nearestStation: station,
        }),
        z.object({ headline: z.string(), spoken: z.string() }),
      );
      return { ok: true, value: out };
    } catch (error) {
      console.error("[ai] rescueAdvice", error);
      return { ok: false, error: ai.friendlyAiError(error) };
    }
  });
