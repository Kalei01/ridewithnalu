import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: (...args: unknown[]) => rpc(...args) },
}));
vi.mock("@/lib/debug-log", () => ({ debugLog: vi.fn() }));
vi.mock("@/lib/drive.functions", () => ({
  driveTime: vi.fn().mockResolvedValue({ trafficMinutes: 20 }),
}));

const { planTransitTrip, resetOutboundMultiProbe, setUseOutboundMulti } =
  await import("./transit-plan");
const { emptySetup } = await import("./commute-model");
const { clearPlannerCache } = await import("./planner-cache");
const { resolveTripDirection } = await import("./trip-direction");
const { nearestRailStation } = await import("./rail/park-and-ride");

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-10-14T22:00:00Z") });
  clearPlannerCache();
  resetOutboundMultiProbe();
  setUseOutboundMulti(false);
  rpc.mockReset();
});
afterEach(() => vi.useRealTimers());

const station = (stop_id: string, stop_lat: number, stop_lon: number) => ({
  stop_id,
  stop_name: stop_id,
  stop_lat,
  stop_lon,
});
const STATIONS = [
  station("10047", 21.3358, -158.0614), // Kualakaʻi East Kapolei
  station("10046", 21.3401, -158.0285), // Keoneʻae (park-and-ride)
  station("10055", 21.3731, -157.9388), // Hālawa (park-and-ride)
  station("10030", 21.3366, -157.8825), // Kahauiki (park-and-ride)
];
const optionRow = {
  leave_by_seconds: 43000,
  depart_seconds: 43300,
  arrive_seconds: 46000,
  total_minutes: 50,
  legs: [{ kind: "rail", mode: "rail", from: "A", to: "B", depart_seconds: 43300, arrive_seconds: 45000 }],
};

const townHome = { lat: 21.3099, lon: -157.8644 };
const kapolei = { lat: 21.3358, lon: -158.0798 };
const kaneohe = { lat: 21.4181, lon: -157.8036 };
const haleiwa = { lat: 21.5919, lon: -158.1031 };
const pearlHarbor = { lat: 21.3649, lon: -157.9496 };

const pairs: Array<[string, typeof townHome, typeof townHome]> = [
  ["town and Kapolei", townHome, kapolei],
  ["Kāneʻohe and Kapolei", kaneohe, kapolei],
  ["Haleʻiwa and Pearl Harbor", haleiwa, pearlHarbor],
];

describe("transit planning works the same in both directions", () => {
  for (const [name, a, b] of pairs) {
    for (const [label, origin, destination] of [
      ["forward", a, b],
      ["reverse", b, a],
    ] as const) {
      it(`${name}, ${label}: plans rail + park-and-ride from the rider's own origin`, async () => {
        const savedHome = a; // Home stays put; only the travel direction flips.
        const tripDirection = resolveTripDirection({
          origin,
          destination,
          savedHome,
          manualInbound: null,
        });
        const boarding = nearestRailStation(origin, STATIONS)!;
        const calls: Array<Record<string, unknown>> = [];
        rpc.mockImplementation(async (fn: string, args: Record<string, unknown>) => {
          if (fn === "plan_outbound") {
            calls.push(args);
            return { data: args["p_station"] === boarding.stop_id ? [optionRow] : [], error: null };
          }
          if (fn === "plan_outbound_multi")
            return { data: null, error: { code: "PGRST202", message: "missing" } };
          return { data: [], error: null };
        });
        const options = await planTransitTrip({
          arrivalStationId: null,
          arriveByTarget: null,
          browseStations: STATIONS,
          carAtStation: false,
          vehicleToStation: "vehicle",
          inbound: tripDirection.inbound,
          now: new Date("2026-10-14T22:00:00Z"),
          nowSeconds: 12 * 3600,
          parkedToday: null,
          planMode: "leave-now",
          scheduleAfterSeconds: 12 * 3600,
          setup: { ...emptySetup, homeStopId: boarding.stop_id, destStopId: "bus-stop" },
          tripDirection,
        } as unknown as Parameters<typeof planTransitTrip>[0]);

        // The saved Home end decides "inbound"; geography never does.
        expect(tripDirection.inbound).toBe(destination === savedHome);
        // Rail planning ran from this rider's origin whichever way they head.
        expect(calls.length).toBeGreaterThan(0);
        expect(calls.every((c) => c["p_origin_lat"] === origin.lat)).toBe(true);
        expect(calls.some((c) => c["p_station"] === boarding.stop_id)).toBe(true);
        expect(options.length).toBeGreaterThan(0);
      });
    }
  }
});

describe("reversed trips", () => {
  it("send no destination stop and drop trips that end far from the door", async () => {
    const reversed = resolveTripDirection({
      origin: haleiwa,
      destination: pearlHarbor,
      savedHome: haleiwa,
      manualInbound: true,
    });
    expect(reversed.reverseTrip).toBe(true);
    const seen: Array<Record<string, unknown>> = [];
    const endsAtStation = {
      ...optionRow,
      legs: [
        { kind: "rail", mode: "rail", from: "A", to: "Hālawa", to_stop_id: "10055",
          depart_seconds: 43300, arrive_seconds: 45000 },
      ],
    };
    rpc.mockImplementation(async (fn: string, args: Record<string, unknown>) => {
      if (fn === "plan_outbound") {
        seen.push(args);
        return { data: [endsAtStation], error: null };
      }
      if (fn === "plan_outbound_multi")
        return { data: null, error: { code: "PGRST202", message: "missing" } };
      return { data: [], error: null };
    });
    const options = await planTransitTrip({
      arrivalStationId: null,
      arriveByTarget: null,
      browseStations: STATIONS,
      carAtStation: false,
      vehicleToStation: "vehicle",
      inbound: true,
      now: new Date("2026-10-14T22:00:00Z"),
      nowSeconds: 12 * 3600,
      parkedToday: null,
      planMode: "leave-now",
      scheduleAfterSeconds: 12 * 3600,
      setup: { ...emptySetup, homeStopId: "10047", destStopId: "bus-stop" },
      tripDirection: reversed,
    } as unknown as Parameters<typeof planTransitTrip>[0]);
    expect(seen.length).toBeGreaterThan(0);
    expect(seen.every((c) => c["p_dest_stop"] === null)).toBe(true);
    // The only trip ends at Hālawa, ~30 km from Haleʻiwa with no leg to the door.
    expect(options).toEqual([]);
  });
});
