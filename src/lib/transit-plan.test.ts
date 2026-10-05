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
      from: { lat: 21.3365, lon: -158.0854 },
      to: { lat: 21.2911, lon: -157.843 },
    },
    ...overrides,
  } as Parameters<typeof planTransitTrip>[0];
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
        args.p_service_day_offset === -1 ? ok([option(86400 + 1800, "C")]) : ok([]),
    });
    const options = await planTransitTrip(context({ nowSeconds: 1800, scheduleAfterSeconds: 1800 }));
    const offsets = rpc.mock.calls
      .filter(([name]) => name === "plan_bus_direct")
      .map(([, args]) => (args as Record<string, unknown>).p_service_day_offset);
    expect(offsets).toEqual(expect.arrayContaining([0, -1]));
    // TheBus writes 24:30 for 12:30 AM; Nalu shifts it back onto today's clock.
    expect(options[0]?.depart_seconds).toBe(1800);
  });
});
