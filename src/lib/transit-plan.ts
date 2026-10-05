import { debugLog } from "@/lib/debug-log";
import { supabase } from "@/integrations/supabase/client";
import { inboundPlannerCoordinates } from "@/lib/trip-direction";
import { collectArriveByOptions } from "@/lib/rail/arrive-by-search";
import { findInboundOptions, hubAccessFallback } from "@/lib/rail/inbound-fallback";
import { type PlanMode } from "@/components/commute/ArriveByControls";
import { MAX_STOP_WALK_M } from "@/lib/rail/walk-preference";
import { honoluluIsoDow } from "@/lib/commute-formatting";
import {
  Coords,
  Leg,
  Option,
  ParkedCar,
  RailStation,
  Setup,
  mergeTransitOptions,
} from "@/lib/commute-model";

import type { ResolvedTripDirection } from "@/lib/trip-direction";
import { planViaSkyline } from "@/lib/rail/via-skyline";

/** Everything the transit search needs from the trip screen. */
export type TransitPlanContext = {
  arrivalStationId: string | null;
  arriveByTarget: number | null;
  browseStations: RailStation[];
  carAtStation: boolean;
  driveAvailable: boolean;
  inbound: boolean;
  now: Date;
  nowSeconds: number;
  parkedToday: ParkedCar | null;
  planMode: PlanMode;
  scheduleAfterSeconds: number;
  setup: Setup;
  tripDirection: ResolvedTripDirection;
};

/**
 * Finds TheBus and Skyline options for a trip: direct buses, the general
 * planner, rail with park-and-ride, late-night service-day handling and
 * arrive-by paging. Moved out of the trip screen unchanged so it can be tested.
 */
export async function planTransitTrip(ctx: TransitPlanContext): Promise<Option[]> {
  const {
    arrivalStationId,
    arriveByTarget,
    browseStations,
    carAtStation,
    driveAvailable,
    inbound,
    now,
    nowSeconds,
    parkedToday,
    planMode,
    scheduleAfterSeconds,
    setup,
    tripDirection,
  } = ctx;
  let selectedInboundStation = arrivalStationId;
  let fallbackChecked = false;
  let generalTransitError: unknown = null;
  // Any trip-planner failure: with no options found, the answer is
  // "couldn't check transit", never "there is no transit trip".
  let plannerError: unknown = null;
  const recordTransitRpcError = (stage: string, error: unknown) => {
    if (stage.startsWith("plan_")) plannerError ??= error;
    const e = error as { code?: unknown; message?: unknown; details?: unknown; hint?: unknown };
    debugLog("transit_rpc_error", {
      stage,
      code: typeof e?.code === "string" ? e.code : "unknown",
      message: typeof e?.message === "string" ? e.message : "Transit RPC failed",
      details: typeof e?.details === "string" ? e.details : null,
      hint: typeof e?.hint === "string" ? e.hint : null,
    });
  };
  // TheBus files after-midnight trips under the previous day's service
  // (25:59 = 1:59 AM). Between midnight and 4 AM, search both days.
  const lateNight = (cursor: number) => cursor < 4 * 3600;
  const fromYesterday = (rows: Option[]): Option[] =>
    rows.map((row) => ({
      ...row,
      leave_by_seconds: row.leave_by_seconds - 86400,
      depart_seconds: row.depart_seconds - 86400,
      arrive_seconds: row.arrive_seconds - 86400,
      legs: row.legs.map((leg) => ({
        ...leg,
        depart_seconds: leg.depart_seconds === null ? null : leg.depart_seconds - 86400,
        arrive_seconds: leg.arrive_seconds === null ? null : leg.arrive_seconds - 86400,
      })),
    }));

  const fetchBusRescue = async (cursor: number): Promise<Option[]> => {
    if (lateNight(cursor)) {
      const [today, yesterday] = await Promise.all([
        fetchBusRescueDay(cursor, 0),
        fetchBusRescueDay(cursor, -1),
      ]);
      return mergeTransitOptions(today, fromYesterday(yesterday));
    }
    return fetchBusRescueDay(cursor, 0);
  };

  const fetchBusRescueDay = async (cursor: number, dayOffset: number): Promise<Option[]> => {
    try {
      const { data: busData, error: busError } = await supabase.rpc("plan_bus_direct", {
        p_origin_lat: tripDirection.from.lat as number,
        p_origin_lon: tripDirection.from.lon as number,
        p_dest_lat: tripDirection.to.lat as number,
        p_dest_lon: tripDirection.to.lon as number,
        p_after_seconds: cursor,
        p_limit: planMode === "arrive-by" ? 8 : 4,
        p_origin_radius_m: MAX_STOP_WALK_M,
        p_dest_radius_m: MAX_STOP_WALK_M,
        p_service_day_offset: dayOffset,
      });
      if (busError) {
        recordTransitRpcError("plan_bus_direct", busError);
        return [];
      }
      const busOptions = (busData ?? []).map((row) => ({
        ...row,
        legs: row.legs as unknown as Leg[],
      })) as Option[];
      return mergeTransitOptions(busOptions);
    } catch (error) {
      recordTransitRpcError("plan_bus_direct", error);
      return [];
    }
  };

  const fetchGeneralTransit = async (cursor: number): Promise<Option[]> => {
    if (lateNight(cursor)) {
      const [today, yesterday] = await Promise.all([
        fetchGeneralTransitDay(cursor, 0),
        fetchGeneralTransitDay(cursor, -1),
      ]);
      return mergeTransitOptions(today, fromYesterday(yesterday));
    }
    return fetchGeneralTransitDay(cursor, 0);
  };

  const fetchGeneralTransitDay = async (cursor: number, dayOffset: number): Promise<Option[]> => {
    const { data, error } = await supabase.rpc("plan_transit_general", {
      p_origin_lat: tripDirection.from.lat as number,
      p_origin_lon: tripDirection.from.lon as number,
      p_dest_lat: tripDirection.to.lat as number,
      p_dest_lon: tripDirection.to.lon as number,
      p_after_seconds: cursor,
      // A few extra candidates so a slightly later, shorter-walk trip survives.
      p_limit: planMode === "arrive-by" ? 8 : 6,
      p_origin_radius_m: MAX_STOP_WALK_M,
      p_dest_radius_m: MAX_STOP_WALK_M,
      p_service_day_offset: dayOffset,
    });
    if (error) {
      generalTransitError = error;
      recordTransitRpcError("plan_transit_general", error);
      return [];
    }
    return mergeTransitOptions(
      (data ?? []).map((row) => ({
        ...row,
        legs: row.legs as unknown as Leg[],
      })) as Option[],
    );
  };

  const fetchOutbound = async (cursor: number): Promise<Option[]> => {
    try {
      const { data, error } = await supabase.rpc("plan_outbound", {
        p_origin_lat: tripDirection.from.lat as number,
        p_origin_lon: tripDirection.from.lon as number,
        p_station: setup.homeStopId,
        p_dest_stop: setup.destStopId,
        p_allow_drive: driveAvailable,
        p_after_seconds: cursor,
        p_limit: planMode === "arrive-by" ? 8 : 4,
        p_dest_lat: tripDirection.to.lat as number,
        p_dest_lon: tripDirection.to.lon as number,
      });
      if (error) {
        recordTransitRpcError("plan_outbound", error);
        return [];
      }
      return (data ?? []).map((row) => ({
        ...row,
        legs: row.legs as unknown as Leg[],
      })) as Option[];
    } catch (error) {
      recordTransitRpcError("plan_outbound", error);
      return [];
    }
  };

  const fetchPage = async (cursor: number): Promise<Option[]> => {
    // The direct-bus and Skyline planners answer in about a second, while the
    // generalized planner can run into its time limit. Start them together so
    // a slow general search never hides a direct bus that arrives sooner.
    const busPromise = fetchBusRescue(cursor);
    const outboundPromise = inbound ? Promise.resolve<Option[]>([]) : fetchOutbound(cursor);
    const generalPromise = fetchGeneralTransit(cursor);

    // When Skyline is outside its published service window, do not let a
    // rail-inclusive planner result hide the remaining TheBus option. The
    // bus rescue is checked first so the UI can honestly compare Drive vs Bus.
    let skylineOutOfService = false;
    const serviceStopId = inbound ? arrivalStationId : setup.homeStopId;
    if (serviceStopId) {
      try {
        const { data: serviceRows, error: serviceError } = await supabase.rpc("service_hours", {
          p_stop_id: serviceStopId,
          p_route_type: 1,
        });
        if (!serviceError) {
          const today = (serviceRows ?? []).find((row) => Number(row.dow) === honoluluIsoDow(now));
          skylineOutOfService = Boolean(
            today &&
            (nowSeconds >= Number(today.last_seconds) || nowSeconds < Number(today.first_seconds)),
          );
        } else {
          recordTransitRpcError("service_hours", serviceError);
        }
      } catch (error) {
        recordTransitRpcError("service_hours", error);
      }
    }

    if (skylineOutOfService) {
      const busRescue = await busPromise;
      if (busRescue.length) return busRescue;
    }

    // Primary path: generalized door-to-door transit. This remains authoritative
    // whenever it produces a usable itinerary.
    // Once a fast planner has a trip, the general planner (normally 1-2 s)
    // gets a grace period; past that it is hitting its time limit.
    const [fastBus, fastOutbound] = await Promise.all([busPromise, outboundPromise]);
    const primaryTransit =
      fastBus.length || fastOutbound.length
        ? await Promise.race([
            generalPromise,
            new Promise<Option[]>((resolve) => window.setTimeout(() => resolve([]), 8000)),
          ])
        : await generalPromise;
    if (primaryTransit.length) return mergeTransitOptions(primaryTransit, await busPromise);

    // Inbound Skyline trips keep the proven multi-station fallbacks. These are
    // only reached after the generalized planner returns zero options.
    if (!inbound) {
      // Home -> Work (outbound) still needs the established Skyline planner
      // as a fallback. The generalized planner can legitimately return zero
      // when its door-to-door bus/rail chain cannot be formed, while the
      // configured home station + destination stop has a valid Skyline trip.
      const outboundOptions = await outboundPromise;
      if (outboundOptions.length)
        return mergeTransitOptions(outboundOptions, primaryTransit, await busPromise);
    }

    if (inbound) {
      const fetchAtStation = async (stationId: string): Promise<Option[]> => {
        const params = {
          ...inboundPlannerCoordinates(tripDirection),
          p_station: stationId,
          p_allow_drive:
            stationId === arrivalStationId
              ? carAtStation
              : Boolean(
                  setup.allowDrive &&
                  parkedToday?.place === "station" &&
                  parkedToday.station === stationId,
                ),
          p_after_seconds: cursor,
          p_limit: planMode === "arrive-by" ? 8 : 4,
        };
        const { data, error } = await supabase.rpc("plan_inbound", params);
        if (error) {
          recordTransitRpcError("plan_inbound", error);
          throw error;
        }
        return (data ?? []).map((row) => ({
          ...row,
          legs: row.legs as unknown as Leg[],
        })) as Option[];
      };

      let stations = browseStations;
      let primaryAlreadyChecked = false;

      if (!stations.length) {
        if (selectedInboundStation) {
          const primary = await fetchAtStation(selectedInboundStation);
          if (primary.length) {
            fallbackChecked = true;
            return mergeTransitOptions(primary, primaryTransit, await busPromise);
          }
          primaryAlreadyChecked = true;
        }

        const stationResult = await supabase.rpc("rail_stations");
        if (stationResult.error) {
          recordTransitRpcError("rail_stations", stationResult.error);
          throw stationResult.error;
        }
        stations = (stationResult.data ?? []) as RailStation[];
      }

      if (!fallbackChecked) {
        const result = await findInboundOptions({
          primaryStationId: primaryAlreadyChecked ? null : selectedInboundStation,
          stations: primaryAlreadyChecked
            ? stations.filter((station) => station.stop_id !== selectedInboundStation)
            : stations,
          destination: tripDirection.to as Coords,
          fetchAtStation,
        });

        selectedInboundStation = result.stationId ?? selectedInboundStation;
        fallbackChecked = true;

        if (result.options.length) {
          return mergeTransitOptions(result.options, primaryTransit, await busPromise);
        }
      }

      // If station egress is still unavailable, try a nearby rail hub and
      // prepend the established access leg rather than declaring transit dead.
      if (selectedInboundStation) {
        const hubOptions = (await hubAccessFallback({
          origin: tripDirection.from as Coords,
          stations: stations.filter((station) => station.stop_id !== selectedInboundStation),
          afterSeconds: cursor,
          fetchFromHub: async (hub, after) => {
            const { data, error } = await supabase.rpc("plan_inbound", {
              ...inboundPlannerCoordinates(tripDirection),
              p_dest_lat: hub.lat,
              p_dest_lon: hub.lon,
              p_station: selectedInboundStation!,
              p_allow_drive: selectedInboundStation === arrivalStationId ? carAtStation : false,
              p_after_seconds: after,
              p_limit: planMode === "arrive-by" ? 8 : 4,
            });
            if (error) {
              recordTransitRpcError("plan_inbound_hub", error);
              throw error;
            }
            return (data ?? []).map((row) => ({
              ...row,
              legs: row.legs as unknown as Leg[],
            }));
          },
        })) as Option[];

        if (hubOptions.length) {
          return mergeTransitOptions(hubOptions, primaryTransit, await busPromise);
        }
      }
    }

    // Final transit rescue: if the rail/general planner cannot form an
    // itinerary, search TheBus directly from the actual origin to stops near
    // the actual destination.
    const busRescue = await busPromise;
    if (busRescue.length) return mergeTransitOptions(busRescue, primaryTransit);

    if (generalTransitError) throw generalTransitError;
    if (plannerError) throw plannerError;

    // A valid zero-row response after the targeted fallbacks is a genuine
    // transit miss. Keep the privacy-safe diagnostic path intact.
    try {
      const diagnoseTransitGeneral = supabase.rpc.bind(supabase) as unknown as (
        functionName: string,
        args: Record<string, number>,
      ) => Promise<{ data: string | null; error: unknown }>;
      const { data: diagnostic, error: diagnosticError } = await diagnoseTransitGeneral(
        "diagnose_transit_general",
        {
          p_origin_lat: tripDirection.from.lat as number,
          p_origin_lon: tripDirection.from.lon as number,
          p_dest_lat: tripDirection.to.lat as number,
          p_dest_lon: tripDirection.to.lon as number,
          p_after_seconds: cursor,
        },
      );
      if (diagnosticError) {
        recordTransitRpcError("diagnose_transit_general", diagnosticError);
      } else if (typeof diagnostic === "string") {
        debugLog("transit_no_itinerary", { stage: diagnostic });
      }
    } catch (error) {
      recordTransitRpcError("diagnose_transit_general", error);
    }

    // Every planner answered and none found a trip: that is a real
    // "no transit trip right now", not a data failure.
    return [];
  };

  // Bus → Skyline → bus needs two transfers, which the general planner can't
  // form. When neither end is near a station, plan the two halves separately.
  const fetchViaSkyline = async (cursor: number): Promise<Option[]> => {
    const { from, to } = tripDirection;
    if (lateNight(cursor) || from.lat == null || from.lon == null || to.lat == null || to.lon == null) return [];
    let stations: RailStation[] = browseStations;
    if (!stations.length) {
      try {
        const { data } = await supabase.rpc("rail_stations");
        stations = (data ?? []) as RailStation[];
      } catch {
        return [];
      }
    }
    return planViaSkyline({
      origin: { lat: from.lat, lon: from.lon },
      destination: { lat: to.lat, lon: to.lon },
      stations,
      afterSeconds: cursor,
      walkRadiusM: MAX_STOP_WALK_M,
      search: async (leg) => {
        const { data, error } = await supabase.rpc("plan_transit_general", {
          p_origin_lat: leg.from.lat,
          p_origin_lon: leg.from.lon,
          p_dest_lat: leg.to.lat,
          p_dest_lon: leg.to.lon,
          p_after_seconds: leg.afterSeconds,
          p_limit: leg.limit,
          p_origin_radius_m: leg.fromRadiusM,
          p_dest_radius_m: leg.toRadiusM,
          p_service_day_offset: 0,
        });
        if (error) {
          recordTransitRpcError("via_skyline", error);
          return [];
        }
        return (data ?? []).map((row) => ({ ...row, legs: row.legs as unknown as Leg[] })) as Option[];
      },
    });
  };

  /** The normal search plus the Skyline bridge, run side by side. */
  const fetchPageWithSkyline = async (cursor: number): Promise<Option[]> => {
    const bridge = fetchViaSkyline(cursor);
    try {
      const base = await fetchPage(cursor);
      const via = await bridge;
      return via.length ? mergeTransitOptions(base, via) : base;
    } catch (error) {
      // A bridge trip still counts if the other planners failed.
      const via = await bridge;
      if (via.length) return mergeTransitOptions(via);
      throw error;
    }
  };

  if (planMode !== "arrive-by" || arriveByTarget === null || arriveByTarget < nowSeconds)
    return fetchPageWithSkyline(scheduleAfterSeconds);
  const result = await collectArriveByOptions({
    nowSeconds: scheduleAfterSeconds,
    targetSeconds: arriveByTarget,
    fetchPage: fetchPageWithSkyline,
  });
  // Pages that all came back empty already cover every departure before the
  // target, so they mean "no trip", not an incomplete search.
  if (!result.complete && result.options.length > 0)
    throw new Error("Arrival timetable search reached its safe page limit.");
  return result.options;
}
