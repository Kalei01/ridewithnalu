import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { rateLimit } from "./rate-limit.server";
import { emptySetup } from "./commute-model";
import type { TransitPlanContext } from "./transit-plan";
import { planTripOnServer } from "./transit-plan.server";

// Far above what a person does by hand (one trip search per screen change);
// stops scripts. Each search also spends live-traffic lookups.
const planLimit = rateLimit("plan", 120);

// Hawaiʻi only (with room around the islands): no searches or traffic lookups elsewhere.
const lat = z.number().min(18).max(23);
const lon = z.number().min(-161.5).max(-154);
const point = z.object({ lat: lat.nullable(), lon: lon.nullable() });
const stopId = z.string().max(40);
const seconds = z
  .number()
  .int()
  .min(-86_400)
  .max(3 * 86_400);

/**
 * Only what the trip search reads: the two ends, the trip question, the rider's
 * station stops and the Skyline station list. No names, addresses or account.
 */
export const tripPlanInput = z.object({
  arrivalStationId: stopId.nullable(),
  arriveByTarget: seconds.nullable(),
  browseStations: z
    .array(
      z.object({
        stop_id: stopId,
        stop_name: z.string().max(120).nullable(),
        stop_lat: lat.nullable(),
        stop_lon: lon.nullable(),
      }),
    )
    // Room for the whole Skyline line (about 20 stations when complete).
    .max(30),
  vehicleToStation: z.enum(["vehicle", "none"]),
  inbound: z.boolean(),
  now: z.string().datetime({ offset: true }),
  nowSeconds: seconds,
  planMode: z.enum(["leave-now", "arrive-by"]),
  scheduleAfterSeconds: seconds,
  homeStopId: stopId,
  destStopId: stopId,
  tripDirection: z.object({
    inbound: z.boolean(),
    reverseTrip: z.boolean(),
    departingFromSavedHome: z.boolean(),
    arrivingAtSavedHome: z.boolean(),
    from: point,
    to: point,
  }),
});

export type TripPlanInput = z.infer<typeof tripPlanInput>;

/** The phone's trip-search context, trimmed to what the server needs. */
export function toTripPlanInput(ctx: TransitPlanContext): TripPlanInput {
  return {
    arrivalStationId: ctx.arrivalStationId,
    arriveByTarget: ctx.arriveByTarget,
    browseStations: ctx.browseStations.map((s) => ({
      stop_id: s.stop_id,
      stop_name: s.stop_name,
      stop_lat: s.stop_lat == null ? null : Number(s.stop_lat),
      stop_lon: s.stop_lon == null ? null : Number(s.stop_lon),
    })),
    vehicleToStation: ctx.vehicleToStation,
    inbound: ctx.inbound,
    now: ctx.now.toISOString(),
    nowSeconds: ctx.nowSeconds,
    planMode: ctx.planMode,
    scheduleAfterSeconds: ctx.scheduleAfterSeconds,
    homeStopId: ctx.setup.homeStopId,
    destStopId: ctx.setup.destStopId,
    tripDirection: {
      inbound: ctx.tripDirection.inbound,
      reverseTrip: ctx.tripDirection.reverseTrip,
      departingFromSavedHome: ctx.tripDirection.departingFromSavedHome,
      arrivingAtSavedHome: ctx.tripDirection.arrivingAtSavedHome,
      from: { lat: ctx.tripDirection.from.lat, lon: ctx.tripDirection.from.lon },
      to: { lat: ctx.tripDirection.to.lat, lon: ctx.tripDirection.to.lon },
    },
  };
}

/** The server's side of toTripPlanInput: the context the planner expects. */
export function fromTripPlanInput(data: TripPlanInput): TransitPlanContext {
  const { homeStopId, destStopId, now, ...rest } = data;
  return {
    ...rest,
    now: new Date(now),
    setup: { ...emptySetup, homeStopId, destStopId },
  };
}

/** One request per trip: every TheBus and Skyline search, run on the server. */
export const planTripServer = createServerFn({ method: "POST" })
  .middleware([planLimit])
  .validator((input) => tripPlanInput.parse(input))
  .handler(async ({ data }) => planTripOnServer(fromTripPlanInput(data)));
