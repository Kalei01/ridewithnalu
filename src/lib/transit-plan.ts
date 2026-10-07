import { debugLog } from "@/lib/debug-log";
import { supabase } from "@/integrations/supabase/client";
import { inboundPlannerCoordinates } from "@/lib/trip-direction";
import { collectArriveByOptions } from "@/lib/rail/arrive-by-search";
import { findInboundOptions, hubAccessFallback } from "@/lib/rail/inbound-fallback";
import { type PlanMode } from "@/components/commute/ArriveByControls";
import { MAX_STOP_WALK_M } from "@/lib/rail/walk-preference";
import { isParkAndRide, metresBetween, nearestParkAndRide } from "@/lib/rail/park-and-ride";
import { dropOffCandidates, pickupCandidates } from "@/lib/rail/drop-off";
import type { VehicleToStation } from "@/lib/trip-access";
import { driveTime } from "@/lib/drive.functions";
import { honoluluIsoDow } from "@/lib/commute-formatting";
import {
  Coords,
  Leg,
  Option,
  RailStation,
  Setup,
  mergeTransitOptionsWith,
} from "@/lib/commute-model";

import type { ResolvedTripDirection } from "@/lib/trip-direction";
import { planViaSkyline } from "@/lib/rail/via-skyline";
import { shiftOptionDays } from "@/lib/service-day";

/** Everything the transit search needs from the trip screen. */
export type TransitPlanContext = {
  arrivalStationId: string | null;
  arriveByTarget: number | null;
  browseStations: RailStation[];
  /** How a vehicle may be used to reach a station: park it, be dropped off, or not at all. */
  vehicleToStation: VehicleToStation;
  inbound: boolean;
  now: Date;
  nowSeconds: number;
  planMode: PlanMode;
  scheduleAfterSeconds: number;
  setup: Setup;
  tripDirection: ResolvedTripDirection;
};

/**
 * Which kinds of trip Nalu couldn't fully search this time, because a planner
 * that looks for them failed or ran out of time. A row with no trip then says
 * "Can't check Skyline right now", never "no trip makes sense".
 */
export type TransitPlanGaps = { skyline: boolean; bus: boolean };

export type TransitPlanResult = { options: Option[]; unchecked: TransitPlanGaps };

/** Which rows a failed planner stage leaves unchecked. */
const STAGE_GAPS: Record<string, Partial<TransitPlanGaps>> = {
  plan_bus_direct: { bus: true },
  // The general planner finds bus transfers and bus + Skyline trips alike.
  plan_transit_general: { bus: true, skyline: true },
  plan_outbound: { skyline: true },
  plan_inbound: { skyline: true },
  plan_inbound_hub: { skyline: true },
  rail_stations: { skyline: true },
  via_skyline: { skyline: true },
  pickup_inbound: { skyline: true },
};

/**
 * Finds TheBus and Skyline options for a trip: direct buses, the general
 * planner, rail with park-and-ride, late-night service-day handling and
 * arrive-by paging. Moved out of the trip screen unchanged so it can be tested.
 */
export async function planTransitTrip(ctx: TransitPlanContext): Promise<Option[]> {
  return (await planTransitTripDetailed(ctx)).options;
}

/**
 * The same search, plus which kinds of trip couldn't be checked. Successful
 * results are kept as they are; only the failure is carried to the screen.
 */
export async function planTransitTripDetailed(ctx: TransitPlanContext): Promise<TransitPlanResult> {
  const unchecked: TransitPlanGaps = { skyline: false, bus: false };
  const options = await searchTransit(ctx, unchecked);
  // A copy: a slow planner that fails after the answer is out can't change it.
  return { options, unchecked: { ...unchecked } };
}

async function searchTransit(
  ctx: TransitPlanContext,
  unchecked: TransitPlanGaps,
): Promise<Option[]> {
  const {
    arrivalStationId,
    arriveByTarget,
    browseStations,
    vehicleToStation,
    inbound,
    now,
    nowSeconds,
    planMode,
    scheduleAfterSeconds,
    setup,
    tripDirection,
  } = ctx;
  // With a car available, a few real stations that make progress toward the
  // destination are also tried as drop-off points (no lot needed there). Nothing
  // is assumed: the trip search times each, and the comparison decides.
  const dropOffStations =
    vehicleToStation === "vehicle"
      ? dropOffCandidates(
          tripDirection.from,
          tripDirection.to,
          browseStations,
          planMode === "arrive-by" ? 2 : 3,
        )
      : [];
  // The home station counts too: with a car available a ride there needs no lot.
  const dropOffStops: ReadonlySet<string> = new Set(
    vehicleToStation === "vehicle" && setup.homeStopId
      ? [...dropOffStations.map((s) => s.stop_id), setup.homeStopId]
      : dropOffStations.map((s) => s.stop_id),
  );
  // With no vehicle available (taking the bus), no path may end up with a car leg.
  const withoutCarLegs = (options: Option[]) =>
    vehicleToStation === "none"
      ? options.filter((option) => !option.legs.some((leg) => leg.mode === "drive"))
      : options;
  const mergeTransitOptions = (...groups: Option[][]) =>
    mergeTransitOptionsWith({ dropOffStops }, ...groups.map(withoutCarLegs));
  let selectedInboundStation = arrivalStationId;
  let fallbackChecked = false;
  let generalTransitError: unknown = null;
  // Any trip-planner failure: with no options found, the answer is
  // "couldn't check transit", never "there is no transit trip".
  let plannerError: unknown = null;
  const recordTransitRpcError = (stage: string, error: unknown) => {
    if (stage.startsWith("plan_")) plannerError ??= error;
    const gaps = STAGE_GAPS[stage];
    if (gaps?.skyline) unchecked.skyline = true;
    if (gaps?.bus) unchecked.bus = true;
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
  const fromYesterday = (rows: Option[]): Option[] => rows.map((row) => shiftOptionDays(row, -1));

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

  const fetchOutboundAt = async (
    station: string,
    allowDrive: boolean,
    cursor: number,
  ): Promise<Option[]> => {
    try {
      const { data, error } = await supabase.rpc("plan_outbound", {
        p_origin_lat: tripDirection.from.lat as number,
        p_origin_lon: tripDirection.from.lon as number,
        p_station: station,
        p_dest_stop: setup.destStopId,
        p_allow_drive: allowDrive,
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

  // The home station (walking, and by car when one is available: the station
  // nearest home is often the best place to be dropped off even with no lot),
  // plus the nearest station with a lot (e.g. ʻEwa Beach: Kualakaʻi, or UH West
  // Oʻahu), and the drop-off stations chosen above.
  const fetchOutbound = async (cursor: number): Promise<Option[]> => {
    const home = setup.homeStopId;
    const vehicle = vehicleToStation === "vehicle";
    const parkStation =
      vehicle && !isParkAndRide(home)
        ? nearestParkAndRide(tripDirection.from, browseStations)
        : null;
    // The home station first, then the other stations together: fewer heavy
    // searches at once on the database. Every station is still searched.
    const fromHome = await fetchOutboundAt(home, vehicle, cursor);
    const queries: Array<Promise<Option[]>> = [];
    const queried = new Set([home, parkStation?.stop_id]);
    if (parkStation && parkStation.stop_id !== home)
      queries.push(fetchOutboundAt(parkStation.stop_id, true, cursor));
    for (const station of dropOffStations) {
      if (!queried.has(station.stop_id))
        queries.push(fetchOutboundAt(station.stop_id, true, cursor));
    }
    // Safety net: with no vehicle available, no result may carry a car leg.
    const found = [fromHome, ...(await Promise.all(queries))]
      .flat()
      .filter(
        (option) => vehicleToStation !== "none" || !option.legs.some((leg) => leg.mode === "drive"),
      );
    return retimeDriveAccess(found, {
      origin: tripDirection.from,
      stations: browseStations,
      now,
      nowSeconds,
      leaveNow: planMode !== "arrive-by",
    });
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
    let generalSettled = false;
    generalPromise.then(
      () => (generalSettled = true),
      () => (generalSettled = true),
    );
    const primaryTransit =
      fastBus.length || fastOutbound.length
        ? await Promise.race([
            generalPromise,
            new Promise<Option[]>((resolve) =>
              window.setTimeout(() => {
                // Past the grace period the general planner hasn't answered, so
                // bus transfers and bus + Skyline trips weren't fully checked.
                if (!generalSettled) {
                  unchecked.skyline = true;
                  unchecked.bus = true;
                }
                resolve([]);
              }, 8000),
            ),
          ])
        : await generalPromise;
    // Drive to a station + Skyline is a real alternative to the walk-and-ride
    // trips, not just a fallback: from ʻEwa Beach the 91 bus alone is found by
    // the general planner, while driving to the station and riding Skyline gets
    // there sooner. Merge both; the shared filters still drop one-stop rail hops
    // and trips whose extra transfers don't save enough time.
    if (primaryTransit.length)
      return mergeTransitOptions(
        primaryTransit,
        await busPromise,
        dropWalkableDriveAccess(fastOutbound, tripDirection.from, browseStations),
      );

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
          p_allow_drive: false,
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
              p_allow_drive: false,
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

        // The parking filter can drop every hub trip; then fall through to the
        // bus rescue and error reporting below instead of returning nothing.
        const hubKept = hubOptions.length
          ? mergeTransitOptions(hubOptions, primaryTransit, await busPromise)
          : [];
        if (hubKept.length) return hubKept;
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
    if (
      lateNight(cursor) ||
      from.lat == null ||
      from.lon == null ||
      to.lat == null ||
      to.lon == null
    )
      return [];
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
        return (data ?? []).map((row) => ({
          ...row,
          legs: row.legs as unknown as Leg[],
        })) as Option[];
      },
    });
  };

  // Heading home with a car available: a few real stations that make progress
  // toward home, each with a car leg from the station home (a pickup). Nothing
  // is assumed about where; each is timed with live traffic and the comparison
  // decides. Never throws: this only ever adds options.
  const fetchInboundPickup = async (cursor: number): Promise<Option[]> => {
    if (!inbound || vehicleToStation !== "vehicle" || lateNight(cursor)) return [];
    try {
      const coordinates = inboundPlannerCoordinates(tripDirection);
      const stations = pickupCandidates(
        tripDirection.to,
        tripDirection.from,
        browseStations,
        planMode === "arrive-by" ? 3 : 4,
      );
      const found = await Promise.all(
        stations.map(async (station) => {
          const { data, error } = await supabase.rpc("plan_inbound", {
            ...coordinates,
            p_station: station.stop_id,
            p_allow_drive: true,
            p_after_seconds: cursor,
            p_limit: planMode === "arrive-by" ? 8 : 4,
          });
          if (error) {
            recordTransitRpcError("pickup_inbound", error);
            return [];
          }
          const rows = (data ?? []).map((row) => ({
            ...row,
            legs: row.legs as unknown as Leg[],
          })) as Option[];
          // Only trips that end with the car; the rest the other planners already cover.
          return retimeDriveEgress(
            rows.filter((option) => option.legs.at(-1)?.mode === "drive"),
            { station, home: tripDirection.to, now, nowSeconds },
          );
        }),
      );
      return found.flat();
    } catch (error) {
      recordTransitRpcError("pickup_inbound", error);
      return [];
    }
  };

  /**
   * The normal search plus the Skyline bridge and any pickup trips. The bridge
   * starts once the normal search has settled, so fewer heavy searches hit
   * the database at once; its trips are still always included.
   */
  const fetchPageWithSkyline = async (cursor: number): Promise<Option[]> => {
    let bridge: Promise<Option[]> | null = null;
    const pickup = fetchInboundPickup(cursor);
    const extras = async () => {
      bridge ??= fetchViaSkyline(cursor);
      return [...(await bridge), ...(await pickup)];
    };
    try {
      const base = await fetchPage(cursor);
      const extra = await extras();
      return extra.length ? mergeTransitOptions(base, extra) : base;
    } catch (error) {
      // A bridge or pickup trip still counts if the other planners failed.
      const extra = await extras();
      if (extra.length) {
        // The normal search's own trips (including any direct bus) were
        // dropped with the failure, so neither row can claim "no trip".
        unchecked.skyline = true;
        unchecked.bus = true;
        return mergeTransitOptions(extra);
      }
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

/** plan_outbound's drive estimate is ceil(metres / 670.6) + 3 minutes, so 6+ minutes means well past walking range. */
const MIN_DRIVE_ACCESS_MINUTES_WITHOUT_COORDS = 6;

/**
 * plan_outbound offers "drive to the station" whenever a car is allowed, even
 * to a station a rider would normally walk to. Keep a drive-to-station trip
 * only when the station is beyond walking range (MAX_STOP_WALK_M); otherwise
 * the walk-and-ride trips from the general planner already cover it.
 */
export function dropWalkableDriveAccess(
  options: Option[],
  origin: { lat: number | null; lon: number | null },
  stations: RailStation[],
): Option[] {
  return options.filter((option) => {
    const access = option.legs[0];
    if (!access || access.mode !== "drive") return true;
    const station = stations.find((s) => s.stop_id === access.to_stop_id);
    if (
      station?.stop_lat != null &&
      station.stop_lon != null &&
      origin.lat != null &&
      origin.lon != null
    ) {
      return (
        metresBetween(
          { lat: origin.lat, lon: origin.lon },
          { lat: Number(station.stop_lat), lon: Number(station.stop_lon) },
        ) > MAX_STOP_WALK_M
      );
    }
    return (access.minutes ?? 0) >= MIN_DRIVE_ACCESS_MINUTES_WITHOUT_COORDS;
  });
}

/**
 * Heading home, the planner times the car leg from the station with a
 * straight-line guess. Re-time it with live traffic for when the train arrives
 * (a future estimate when that is later), adding nothing for the pickup. With
 * no live time the trip is dropped rather than guessed.
 */
export async function retimeDriveEgress(
  options: Option[],
  input: {
    station: {
      stop_id: string;
      stop_lat: number | string | null;
      stop_lon: number | string | null;
    };
    home: { lat: number | null; lon: number | null };
    now: Date;
    nowSeconds: number;
  },
): Promise<Option[]> {
  const { station, home } = input;
  if (station.stop_lat == null || station.stop_lon == null || home.lat == null || home.lon == null)
    return [];
  const retimed = await Promise.all(
    options.map(async (option): Promise<Option | null> => {
      const car = option.legs.at(-1);
      const before = option.legs.at(-2);
      if (!car || car.mode !== "drive" || !before || before.arrive_seconds == null) return null;
      const start = before.arrive_seconds;
      try {
        const result = await driveTime({
          data: {
            fromLat: Number(station.stop_lat),
            fromLon: Number(station.stop_lon),
            toLat: home.lat as number,
            toLon: home.lon as number,
            ...(start > input.nowSeconds + 300
              ? {
                  departureTime: new Date(
                    input.now.getTime() + (start - input.nowSeconds) * 1000,
                  ).toISOString(),
                }
              : {}),
          },
        });
        if (!result || !Number.isFinite(result.trafficMinutes)) return null;
        const minutes = Math.ceil(result.trafficMinutes);
        const arrive = start + minutes * 60;
        return {
          ...option,
          arrive_seconds: arrive,
          total_minutes: Math.round((arrive - option.leave_by_seconds) / 60),
          legs: [
            ...option.legs.slice(0, -1),
            {
              ...car,
              from_stop_id: car.from_stop_id ?? input.station.stop_id,
              depart_seconds: start,
              arrive_seconds: arrive,
              minutes,
            },
          ],
        };
      } catch {
        return null;
      }
    }),
  );
  return retimed.filter((option): option is Option => option !== null);
}

/**
 * The planner times "drive to the station" from straight-line distance with no
 * traffic. Before such a trip can be compared with driving all the way (which
 * uses live traffic), re-time the drive with the same live traffic source and
 * drop trains that can no longer be reached. If live traffic is unavailable,
 * drop the drive-to-station trips rather than decide on a guess.
 */
export async function retimeDriveAccess(
  options: Option[],
  input: {
    origin: { lat: number | null; lon: number | null };
    stations: RailStation[];
    now: Date;
    nowSeconds: number;
    leaveNow: boolean;
  },
): Promise<Option[]> {
  const driveFirst = (option: Option) => option.legs[0]?.mode === "drive";
  const drives = options.filter(driveFirst);
  if (!drives.length) return options;

  // Leaving now: one live lookup per station. Arrive by: each trip is timed for
  // its own departure (the server caches lookups in short time buckets).
  const keyFor = (option: Option) =>
    input.leaveNow
      ? (option.legs[0]?.to_stop_id ?? "")
      : `${option.legs[0]?.to_stop_id ?? ""}@${option.leave_by_seconds ?? ""}`;
  const lookups = new Map<string, { stopId: string; leave: number }>();
  for (const option of drives) {
    lookups.set(keyFor(option), {
      stopId: option.legs[0]?.to_stop_id ?? "",
      leave: option.leave_by_seconds ?? input.nowSeconds,
    });
  }

  const liveMinutes = new Map<string, number>();
  const { origin } = input;
  await Promise.all(
    [...lookups].map(async ([key, { stopId, leave }]) => {
      const station = input.stations.find((s) => s.stop_id === stopId);
      if (
        !station ||
        station.stop_lat == null ||
        station.stop_lon == null ||
        origin.lat == null ||
        origin.lon == null
      )
        return;
      const departureTime =
        input.leaveNow || leave <= input.nowSeconds
          ? undefined
          : new Date(input.now.getTime() + (leave - input.nowSeconds) * 1000).toISOString();
      try {
        const result = await driveTime({
          data: {
            fromLat: origin.lat,
            fromLon: origin.lon,
            toLat: Number(station.stop_lat),
            toLon: Number(station.stop_lon),
            ...(departureTime ? { departureTime } : {}),
          },
        });
        if (result && Number.isFinite(result.trafficMinutes))
          liveMinutes.set(key, result.trafficMinutes);
      } catch {
        /* no live time: the trip is dropped below */
      }
    }),
  );

  return options.flatMap((option) => {
    if (!driveFirst(option)) return [option];
    const [access, ...rest] = option.legs;
    const live = liveMinutes.get(keyFor(option));
    if (!access || live === undefined || access.arrive_seconds == null) return [];
    // Live road time only: parking and the walk to the platform aren't estimated.
    const minutes = Math.ceil(live);
    const leave = access.arrive_seconds - minutes * 60;
    // Leaving now: a train you can't reach in time isn't an option.
    if (input.leaveNow && leave < input.nowSeconds - 60) return [];
    return [
      {
        ...option,
        leave_by_seconds: leave,
        total_minutes: Math.round((option.arrive_seconds - leave) / 60),
        legs: [{ ...access, depart_seconds: leave, minutes }, ...rest],
      },
    ];
  });
}
