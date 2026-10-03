import { createCanonicalTrip, type CanonicalTrip } from "./trip-model";
import { createNaluVerdict } from "./verdict-engine";
import type { DecisionModeEstimate } from "./drive-transit-decision";

type MorningPulseDrive = {
  minutes: number;
  delayMinutes: number;
  roads: string[];
  incidents: Array<{ severity: string }>;
  source?: string;
};

type MorningPulseRail = {
  /** When the rider must leave the door (GTFS seconds since Honolulu midnight). */
  leave_by_seconds?: number | null;
  /** When the train departs. */
  depart_seconds: number;
  /** Door arrival at the destination. */
  arrive_seconds: number;
  total_minutes: number;
};

export type MorningPulseVerdictInput = {
  from: { lat: number; lon: number };
  to: { lat: number; lon: number };
  drive: MorningPulseDrive | null;
  rail: MorningPulseRail | null;
  nowEpochMs: number;
  nowSecondsSinceMidnight: number;
};

export type MorningPulseVerdict = {
  verdict: ReturnType<typeof createNaluVerdict>;
  trip: CanonicalTrip;
};

function railEpochMs(nowEpochMs: number, nowSeconds: number, departSeconds: number) {
  const deltaSeconds = departSeconds - nowSeconds;
  return nowEpochMs + Math.max(0, deltaSeconds) * 1000;
}

export function createMorningPulseVerdict(input: MorningPulseVerdictInput): MorningPulseVerdict {
  const requestedAt = Math.floor(input.nowEpochMs / 1000);
  const driveArrival = input.drive
    ? requestedAt + Math.max(0, Math.round(input.drive.minutes * 60))
    : null;

  const toEpoch = (gtfsSeconds: number) =>
    Math.floor(railEpochMs(input.nowEpochMs, input.nowSecondsSinceMidnight, gtfsSeconds) / 1000);
  // Leave time is when the rider walks out the door, not when the train departs.
  const railLeaveSeconds =
    input.rail && Number.isFinite(input.rail.leave_by_seconds ?? NaN)
      ? (input.rail.leave_by_seconds as number)
      : input.rail && Number.isFinite(input.rail.depart_seconds)
        ? input.rail.depart_seconds
        : null;
  const railDeparture = railLeaveSeconds === null ? null : toEpoch(railLeaveSeconds);
  // Arrival is the scheduled door arrival, which already includes the wait
  // before boarding. Fall back to leave time + door-to-door minutes.
  const railArrival =
    input.rail && Number.isFinite(input.rail.arrive_seconds) && input.rail.arrive_seconds > 0
      ? toEpoch(input.rail.arrive_seconds)
      : railDeparture !== null && input.rail && Number.isFinite(input.rail.total_minutes) && input.rail.total_minutes > 0
        ? railDeparture + Math.round(input.rail.total_minutes * 60)
        : null;

  const drive: DecisionModeEstimate = {
    mode: "drive",
    availability: input.drive ? "available" : "data-error",
    quality: input.drive ? "good" : "unavailable",
    expectedMinutes: input.drive?.minutes ?? null,
    leaveTime: input.drive ? requestedAt : null,
    arrivalTime: driveArrival,
    earliestArrival: driveArrival,
    latestArrival: driveArrival,
    uncertaintyMinutes: 0,
    trafficDelayMinutes: input.drive?.delayMinutes ?? null,
    majorIncident: Boolean(input.drive?.incidents.some((incident) => incident.severity === "major")),
    railWaitMinutes: 0,
    busWaitMinutes: 0,
    transferMinutes: 0,
  };

  const rail: DecisionModeEstimate = {
    mode: "transit",
    availability: input.rail ? "available" : "service-unavailable",
    quality: input.rail ? "good" : "unavailable",
    expectedMinutes:
      input.rail && Number.isFinite(input.rail.total_minutes) && input.rail.total_minutes > 0
        ? input.rail.total_minutes
        : null,
    leaveTime: railDeparture,
    arrivalTime: railArrival,
    earliestArrival: railArrival,
    latestArrival: railArrival,
    uncertaintyMinutes: 0,
    trafficDelayMinutes: null,
    majorIncident: false,
    railWaitMinutes:
      railDeparture === null ? 0 : Math.max(0, (railDeparture - requestedAt) / 60),
    busWaitMinutes: 0,
    transferMinutes: 0,
  };

  const trip = createCanonicalTrip({
    origin: { latitude: input.from.lat, longitude: input.from.lon },
    destination: { latitude: input.to.lat, longitude: input.to.lon },
    constraint: { type: "now" },
    requestedAt,
    routes: [
      {
        id: "drive-route",
        mode: "drive",
        segments: [{
          id: "drive-segment",
          mode: "drive",
          origin: { latitude: input.from.lat, longitude: input.from.lon },
          destination: { latitude: input.to.lat, longitude: input.to.lon },
          departureTime: drive.leaveTime,
          arrivalTime: drive.arrivalTime,
          durationMinutes: drive.expectedMinutes,
          distanceMeters: null,
          routeGeometry: [],
          source: input.drive?.source ?? "TomTom",
          observedAt: input.drive ? requestedAt : null,
          quality: input.drive ? "current" : "unavailable",
          notes: [],
        }],
        departureTime: drive.leaveTime,
        arrivalTime: drive.arrivalTime,
        durationMinutes: drive.expectedMinutes,
        transferCount: 0,
        walkingMinutes: 0,
        source: input.drive?.source ?? "TomTom",
      },
      {
        id: "rail-route",
        mode: "rail",
        segments: [{
          id: "rail-segment",
          mode: "rail",
          origin: { latitude: input.from.lat, longitude: input.from.lon },
          destination: { latitude: input.to.lat, longitude: input.to.lon },
          departureTime: rail.leaveTime,
          arrivalTime: rail.arrivalTime,
          durationMinutes: rail.expectedMinutes,
          distanceMeters: null,
          routeGeometry: [],
          source: "GTFS",
          observedAt: input.rail ? requestedAt : null,
          quality: input.rail ? "current" : "unavailable",
          notes: [],
        }],
        departureTime: rail.leaveTime,
        arrivalTime: rail.arrivalTime,
        durationMinutes: rail.expectedMinutes,
        transferCount: 0,
        walkingMinutes: 0,
        source: "GTFS",
      },
    ],
    selectedRouteId: null,
  });

  return {
    trip,
    verdict: createNaluVerdict({ trip, estimates: [drive, rail] }),
  };
}
