import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: (...args: unknown[]) => rpc(...args) } }));
vi.mock("@/lib/debug-log", () => ({ debugLog: vi.fn() }));

const { planTransitTrip } = await import("./transit-plan");
const { emptySetup } = await import("./commute-model");

type Reply = { data: unknown; error: unknown };
const ok = (data: unknown): Reply => ({ data, error: null });
const fail = (message: string): Reply => ({ data: null, error: { message } });

function option(depart: number, route = "40") {
  return {
    leave_by_seconds: depart - 300,
    depart_seconds: depart,
    arrive_seconds: depart + 2400,
    total_minutes: 45,
    legs: [{ mode: "bus", route_short_name: route, depart_seconds: depart, arrive_seconds: depart + 2400 }],
  };
}

function context(overrides: Record<string, unknown> = {}) {
  return {
    arrivalStationId: null,
    arriveByTarget: null,
    browseStations: [],
    carAtStation: false,
    driveAvailable: true,
    inbound: false,
    now: new Date("2026-10-05T18:00:00Z"),
    nowSeconds: 8 * 3600,
    parkedToday: null,
    planMode: "leave-now" as const,
    scheduleAfterSeconds: 8 * 3600,
    setup: { ...emptySetup },
    tripDirection: {
      inbound: false,
      reverseTrip: false,
      departingFromSavedHome: false,
      arrivingAtSavedHome: false,
      from: { lat: 21.3365, lon: -158.0854 },
      to: { lat: 21.2911, lon: -157.843 },
    },
    ...overrides,
  } as unknown as Parameters<typeof planTransitTrip>[0];
}

/** Each planner answers from this table; anything else returns no rows. */
function answer(table: Record<string, Reply | ((args: Record<string, unknown>) => Reply)>) {
  rpc.mockImplementation(async (name: string, args: Record<string, unknown>) => {
    const entry = table[name];
    if (!entry) return ok([]);
    return typeof entry === "function" ? entry(args) : entry;
  });
}

describe("transit trip planner", () => {
  beforeEach(() => rpc.mockReset());

  it("returns a direct bus when the general planner finds nothing", async () => {
    answer({ plan_bus_direct: ok([option(8 * 3600 + 600)]) });
    const options = await planTransitTrip(context());
    expect(options).toHaveLength(1);
    expect(options[0]?.depart_seconds).toBe(8 * 3600 + 600);
  });

  it("reports a failure instead of 'no trip' when every planner errors", async () => {
    answer({
      plan_bus_direct: fail("timeout"),
      plan_transit_general: fail("timeout"),
      plan_outbound: fail("timeout"),
    });
    await expect(planTransitTrip(context())).rejects.toBeTruthy();
  });

  it("treats empty answers from every planner as a real 'no trip'", async () => {
    answer({});
    await expect(planTransitTrip(context())).resolves.toEqual([]);
  });

  it("after midnight, also searches yesterday's late-night service", async () => {
    answer({
      plan_bus_direct: (args) =>
        args["p_service_day_offset"] === -1 ? ok([option(86400 + 1800, "C")]) : ok([]),
    });
    const options = await planTransitTrip(context({ nowSeconds: 1800, scheduleAfterSeconds: 1800 }));
    const offsets = rpc.mock.calls
      .filter(([name]) => name === "plan_bus_direct")
      .map(([, args]) => (args as Record<string, unknown>)["p_service_day_offset"]);
    expect(offsets).toEqual(expect.arrayContaining([0, -1]));
    // TheBus writes 24:30 for 12:30 AM; Nalu shifts it back onto today's clock.
    expect(options[0]?.depart_seconds).toBe(1800);
  });
});

describe("transit trip planner: bus → Skyline → bus", () => {
  beforeEach(() => rpc.mockReset());

  it("finds the Skyline trip home to ʻEwa Beach that beats the 42 alone", async () => {
    const KAHAUIKI = { stop_id: "10030", stop_name: "KAHAUIKI KALIHI TRANSIT CENTER STATION", stop_lat: "21.33274", stop_lon: "-157.888805" };
    const KUALAKAI = { stop_id: "10047", stop_name: "KUALAKA'I EAST KAPOLEI STATION", stop_lat: "21.345574", stop_lon: "-158.050995" };
    const walk = (kind: string, from: string, to: string, a: number, b: number) => ({ kind, mode: "walk", from, to, minutes: Math.round((b - a) / 60), depart_seconds: a, arrive_seconds: b, route_short: null, route_long: null, headsign: null });
    const ride = (mode: string, route: string, from: string, to: string, a: number, b: number) => ({ kind: mode === "rail" ? "rail" : "connect", mode, route_short: route, route_long: null, headsign: null, from, to, minutes: Math.round((b - a) / 60), depart_seconds: a, arrive_seconds: b });
    const busOnly = { leave_by_seconds: 62760, depart_seconds: 63120, arrive_seconds: 68940, total_minutes: 103, legs: [walk("access", "Your location", "S BERETANIA ST + BISHOP ST", 62760, 63120), ride("bus", "42", "S BERETANIA ST + BISHOP ST", "FORT WEAVER RD + KEAUNUI DR", 63120, 67740), walk("egress", "FORT WEAVER RD + KEAUNUI DR", "Your destination", 67740, 68940)] };
    const toStation = { leave_by_seconds: 61200, depart_seconds: 61560, arrive_seconds: 62520, total_minutes: 22, legs: [walk("access", "Your location", "S BERETANIA ST + BISHOP ST", 61200, 61560), ride("bus", "52", "S BERETANIA ST + BISHOP ST", "KAMEHAMEHA HWY + MIDDLE ST", 61560, 62460), walk("egress", "KAMEHAMEHA HWY + MIDDLE ST", "Your destination", 62460, 62520)] };
    const fromStation = { leave_by_seconds: 63240, depart_seconds: 63240, arrive_seconds: 67140, total_minutes: 65, legs: [walk("access", "Your location", KAHAUIKI.stop_name, 63240, 63240), ride("rail", "", KAHAUIKI.stop_name, "HO'AE'AE WEST LOCH STATION", 63240, 64860), walk("connect", "HO'AE'AE WEST LOCH STATION", "FARRINGTON HWY + LEOKU ST", 64860, 65160), ride("bus", "42", "FARRINGTON HWY + LEOKU ST", "FORT WEAVER RD + KEAUNUI DR", 65160, 65940), walk("egress", "FORT WEAVER RD + KEAUNUI DR", "Your destination", 65940, 67140)] };
    answer({
      rail_stations: ok([KAHAUIKI, KUALAKAI]),
      plan_transit_general: (args) => {
        if (Math.abs(Number(args["p_dest_lat"]) - 21.33274) < 1e-4) return ok([toStation]);
        if (Math.abs(Number(args["p_origin_lat"]) - 21.33274) < 1e-4) return ok([fromStation]);
        return ok([busOnly]);
      },
    });
    const options = await planTransitTrip(
      context({
        nowSeconds: 61200,
        scheduleAfterSeconds: 61200,
        tripDirection: {
          inbound: false,
          reverseTrip: false,
          departingFromSavedHome: false,
          arrivingAtSavedHome: false,
          from: { lat: 21.3101, lon: -157.8624 },
          to: { lat: 21.32203, lon: -158.03366 },
        },
      }),
    );
    expect(options[0]?.arrive_seconds).toBe(67140); // 6:39 PM via Skyline
    expect(options[0]?.legs.filter((l) => l.mode === "bus" || l.mode === "rail").map((l) => l.mode)).toEqual(["bus", "rail", "bus"]);
    expect(options.some((o) => o.arrive_seconds === 68940)).toBe(true); // the 42 alone is still listed
  });
});
