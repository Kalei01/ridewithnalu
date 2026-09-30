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
      // Use the actual current time. Adding a 10-minute artificial cutoff can
      // hide the next scheduled train and make Morning Pulse report an unavailable ETA.
      const rail = station
        ? await ai.railBetween(station.stopId, data.from, data.to, ai.honoluluSeconds())
        : null;
      const railTrip = rail?.trips.find((trip) => {
        const total = Number(trip.total_minutes);
        const scheduled = (Number(trip.arrive_seconds) - Number(trip.depart_seconds)) / 60;
        return (Number.isFinite(total) && total > 0) || (Number.isFinite(scheduled) && scheduled > 0);
      }) ?? null;

      const formatDuration = (minutes: number | null) => {
        if (minutes === null || !Number.isFinite(minutes)) return null;
        const total = Math.max(0, Math.round(minutes));
        if (total < 60) return `${total} min`;
        const hours = Math.floor(total / 60);
        const mins = total % 60;
        return mins === 0 ? `${hours} hr` : `${hours} hr ${mins} min`;
      };

      const driveMinutes =
        drive && Number.isFinite(Number(drive.minutes)) && Number(drive.minutes) > 0
          ? Number(drive.minutes)
          : null;
      const skylineMinutes = railTrip
        ? Number.isFinite(Number(railTrip.total_minutes)) && Number(railTrip.total_minutes) > 0
          ? Number(railTrip.total_minutes)
          : (Number(railTrip.arrive_seconds) - Number(railTrip.depart_seconds)) / 60
        : null;
      const driveDuration = formatDuration(driveMinutes);
      const skylineDuration = formatDuration(skylineMinutes);

      if (
        driveDuration === null ||
        skylineDuration === null ||
        driveMinutes === null ||
        skylineMinutes === null ||
        !Number.isFinite(skylineMinutes) ||
        skylineMinutes <= 0
      ) {
        return {
          ok: true,
          value: {
            text: "Nalu couldn't compare both options right now because one ETA is unavailable.",
            faster: "unknown",
          },
        };
      }

      const difference = Math.abs(driveMinutes - skylineMinutes);
      const faster = difference <= 2 ? "similar" : driveMinutes < skylineMinutes ? "drive" : "skyline";
      const comparison =
        difference <= 2
          ? `Drive and Skyline are about the same right now: ${driveDuration} vs ${skylineDuration}.`
          : driveMinutes < skylineMinutes
            ? `Driving is about ${difference} min faster: ${driveDuration} vs ${skylineDuration} by Skyline.`
            : `Skyline is about ${difference} min faster: ${skylineDuration} vs ${driveDuration} driving.`;

      const delay = Math.max(0, Math.round(drive.delayMinutes));
      const roads = drive.roads.filter(Boolean).slice(0, 2);
      const trafficSentence =
        delay >= 2
          ? `${roads.join(" and ") || "Your route"} is adding about ${delay} min right now.`
          : "Roads look normal right now.";

      return {
        ok: true,
        value: {
          text: `${trafficSentence} ${comparison}`,
          faster,
        },
      };
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
