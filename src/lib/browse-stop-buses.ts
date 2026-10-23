/**
 * Live vs scheduled for the departures on a Browse bus-stop card, and the buses
 * to draw on the map. Evidence comes from TheBus arrivals (bus-arrivals.functions);
 * a row is "live" only when confirmedLiveBus matches it, and a departed bus is never
 * shown as catchable (same grace as the trip screen's dropDeparted).
 */
import { confirmedLiveBus } from "@/lib/bus-match";
import { dropDeparted } from "@/lib/rail/departed";
import type { BusArrival } from "@/lib/bus-arrivals.functions";

export type ScheduledDeparture = {
  departure_seconds: number;
  route_short_name: string | null;
  route_long_name?: string | null;
  headsign: string | null;
};

export type LabelledDeparture<T extends ScheduledDeparture> = {
  departure: T;
  live: boolean;
  /** Seconds the rider can use: the live prediction when confirmed, else the timetable. */
  seconds: number;
};

export function labelDepartures<T extends ScheduledDeparture>(
  departures: readonly T[],
  live: readonly BusArrival[] | undefined,
  nowSeconds: number,
): LabelledDeparture<T>[] {
  const arrivals = [...(live ?? [])];
  const rows = departures.map((departure) => {
    const match = confirmedLiveBus(
      arrivals,
      departure.route_short_name,
      departure.headsign,
      departure.departure_seconds,
    );
    return {
      departure,
      live: Boolean(match),
      seconds: match ? match.estimatedSeconds : departure.departure_seconds,
      leave_by_seconds: match ? match.estimatedSeconds : departure.departure_seconds,
    };
  });
  return dropDeparted(rows, nowSeconds).map(({ departure, live: isLive, seconds }) => ({
    departure,
    live: isLive,
    seconds,
  }));
}

export type StopBus = { id: string; route: string; lat: number; lon: number };

/** Live buses with a GPS fix that have not yet left this stop, one marker per vehicle. */
export function stopBuses(live: readonly BusArrival[] | undefined, nowSeconds: number): StopBus[] {
  const seen = new Set<string>();
  const out: StopBus[] = [];
  const upcoming = dropDeparted(
    (live ?? []).map((arrival) => ({ arrival, leave_by_seconds: arrival.estimatedSeconds })),
    nowSeconds,
  );
  for (const { arrival } of upcoming) {
    const vehicle = arrival.vehicle;
    if (!arrival.isLive || arrival.canceled || !vehicle) continue;
    const id = vehicle.id || `${arrival.routeShortName}:${vehicle.lat},${vehicle.lon}`;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({ id, route: arrival.routeShortName, lat: vehicle.lat, lon: vehicle.lon });
  }
  return out;
}
