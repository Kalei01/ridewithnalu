import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The phone path's database and drive time, for the side-by-side checks.
const rpc = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: (...args: unknown[]) => rpc(...args) },
}));
vi.mock("@/lib/debug-log", () => ({ debugLog: vi.fn() }));
const driveTime = vi.fn();
vi.mock("@/lib/drive.functions", () => ({
  driveTime: (...args: unknown[]) => driveTime(...args),
  lookupTrafficMinutes: vi.fn(),
}));
vi.mock("@/lib/rate-limit.server", () => ({ rateLimit: () => ({}) }));

const { planTransitTripDetailed } = await import("./transit-plan");
const { planTripOnServer, serverDeps, emptyStats } = await import("./transit-plan.server");
const { toTripPlanInput, fromTripPlanInput, tripPlanInput } =
  await import("./transit-plan.functions");
const { emptySetup } = await import("./commute-model");
const { clearPlannerCache } = await import("./planner-cache");

type Reply = { data: unknown; error: unknown };
const ok = (data: unknown): Reply => ({ data, error: null });

const HOME_STATION = {
  stop_id: "10047",
  stop_name: "KUALAKAI",
  stop_lat: 21.3386,
  stop_lon: -158.0662,
};
const LOT_STATION = {
  stop_id: "10053",
  stop_name: "KEONEAE",
  stop_lat: 21.3554,
  stop_lon: -158.0548,
};
const NOW = 6 * 3600 + 30 * 60;

function leg(
  mode: string,
  from: string,
  to: string,
  depart: number,
  arrive: number,
  toStop?: string,
) {
  return {
    mode,
    from,
    to,
    route_short_name: mode === "bus" ? "42" : null,
    depart_seconds: depart,
    arrive_seconds: arrive,
    minutes: Math.round((arrive - depart) / 60),
    to_stop_id: toStop ?? null,
  };
}

function driveRail(station: typeof HOME_STATION, depart: number) {
  return {
    leave_by_seconds: depart - 600,
    depart_seconds: depart,
    arrive_seconds: depart + 3300,
    total_minutes: 65,
    legs: [
      leg("drive", "Your location", station.stop_name, depart - 600, depart, station.stop_id),
      leg("rail", station.stop_name, "KAHAUIKI", depart, depart + 1920),
      leg("bus", "KAMEHAMEHA HWY", "S KING ST", depart + 2160, depart + 3180),
      leg("walk", "S KING ST", "Your destination", depart + 3180, depart + 3300),
    ],
  };
}

const bus91 = {
  leave_by_seconds: NOW + 300,
  depart_seconds: NOW + 600,
  arrive_seconds: NOW + 4800,
  total_minutes: 75,
  legs: [
    leg("bus", "Fort Weaver Rd", "S King St", NOW + 600, NOW + 4700),
    leg("walk", "S King St", "Your destination", NOW + 4700, NOW + 4800),
  ],
};

/** One database answer table, used by both paths. */
function table(name: string, args: Record<string, unknown>): Reply {
  if (name === "plan_transit_general") return ok([bus91]);
  if (name === "plan_outbound")
    return ok([
      driveRail(args["p_station"] === LOT_STATION.stop_id ? LOT_STATION : HOME_STATION, NOW + 1800),
    ]);
  return ok([]);
}

function context(overrides: Record<string, unknown> = {}) {
  return {
    arrivalStationId: null,
    arriveByTarget: null,
    browseStations: [HOME_STATION, LOT_STATION],
    vehicleToStation: "vehicle",
    inbound: false,
    now: new Date("2026-10-14T16:30:00Z"),
    nowSeconds: NOW,
    planMode: "leave-now",
    scheduleAfterSeconds: NOW,
    setup: { ...emptySetup, homeStopId: HOME_STATION.stop_id, destStopId: "1234" },
    tripDirection: {
      inbound: false,
      reverseTrip: false,
      departingFromSavedHome: true,
      arrivingAtSavedHome: false,
      from: { lat: 21.3352, lon: -158.079 },
      to: { lat: 21.3086, lon: -157.8618 },
    },
    ...overrides,
  } as unknown as Parameters<typeof planTransitTripDetailed>[0];
}

const stats = emptyStats;
const drive = async () => ({ trafficMinutes: 9 });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-10-14T22:00:00Z") });
  clearPlannerCache();
  rpc.mockReset();
  rpc.mockImplementation(async (name: string, args: Record<string, unknown>) => table(name, args));
  driveTime.mockReset();
  driveTime.mockImplementation(async () => ({ trafficMinutes: 9 }));
  vi.stubGlobal("window", { setTimeout: (h: () => void, ms: number) => setTimeout(h, ms) });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("trip search on the server", () => {
  it("gives exactly the phone's answer for the same trip and the same data", async () => {
    const phone = await planTransitTripDetailed(context());
    clearPlannerCache();
    const server = await planTripOnServer(context(), (s) =>
      serverDeps(s, { search: async (fn, args) => table(fn, args ?? {}), drive }),
    );
    expect(phone.options.length).toBeGreaterThan(1);
    expect(server.failed).toBe(false);
    expect({ options: server.options, unchecked: server.unchecked }).toEqual(phone);
  });

  it("starts every station search at once instead of waiting for the home station", async () => {
    let homeAnswered = false;
    let otherStartedFirst = false;
    const search = async (fn: string, args: Record<string, unknown> | undefined) => {
      if (fn === "plan_outbound" && args?.["p_station"] === HOME_STATION.stop_id) {
        await new Promise((resolve) => setTimeout(resolve, 20));
        homeAnswered = true;
      } else if (fn === "plan_outbound") {
        otherStartedFirst ||= !homeAnswered;
      }
      return table(fn, args ?? {});
    };
    const result = await planTripOnServer(context(), (s) => serverDeps(s, { search, drive }));
    expect(otherStartedFirst).toBe(true);
    expect(result.options.length).toBeGreaterThan(1);
  });

  it("a station search that runs past the deadline marks Skyline unchecked, never 'no trip'", async () => {
    vi.useFakeTimers({ now: new Date("2026-10-14T22:00:00Z") });
    const search = (fn: string, args: Record<string, unknown> | undefined) =>
      fn === "plan_outbound"
        ? new Promise<Reply>(() => {}) // never answers
        : Promise.resolve(fn === "plan_transit_general" ? ok([]) : table(fn, args ?? {}));
    const s = stats();
    const pending = planTripOnServer(context(), () =>
      serverDeps(s, { search, drive, searchDeadlineMs: 12_000 }),
    );
    await vi.advanceTimersByTimeAsync(12_000);
    const result = await pending;
    expect(result.unchecked.skyline).toBe(true);
    expect(result.options.some((o) => o.legs.some((l) => l.mode === "rail"))).toBe(false);
    expect(s.late).toBeGreaterThan(0);
  });

  it("a live drive time past the deadline drops those trains and marks Skyline unchecked", async () => {
    vi.useFakeTimers({ now: new Date("2026-10-14T22:00:00Z") });
    const s = stats();
    const pending = planTripOnServer(context(), () =>
      serverDeps(s, {
        search: async (fn, args) => table(fn, args ?? {}),
        drive: () => new Promise(() => {}),
        driveDeadlineMs: 12_000,
      }),
    );
    await vi.advanceTimersByTimeAsync(12_000);
    const result = await pending;
    expect(result.unchecked.skyline).toBe(true);
    expect(result.options.every((o) => o.legs[0]?.mode !== "drive")).toBe(true);
  });

  it("a failed search is not remembered, so the next trip searches again", async () => {
    let calls = 0;
    const search = async (fn: string, args: Record<string, unknown> | undefined) => {
      if (fn === "plan_bus_direct") {
        calls += 1;
        return calls === 1 ? { data: null, error: { message: "timeout" } } : ok([]);
      }
      return table(fn, args ?? {});
    };
    const first = await planTripOnServer(context(), (s) => serverDeps(s, { search, drive }));
    expect(first.unchecked.bus).toBe(true);
    const second = await planTripOnServer(context(), (s) => serverDeps(s, { search, drive }));
    expect(second.unchecked.bus).toBe(false);
    expect(calls).toBe(2);
  });

  it("reports a planner failure as 'couldn't check' on both rows, without throwing", async () => {
    const search = async () => ({
      data: null,
      error: { code: "57014", message: "statement timeout" },
    });
    const result = await planTripOnServer(context(), (s) => serverDeps(s, { search, drive }));
    expect(result.failed).toBe(true);
    expect(result.options).toEqual([]);
    expect(result.unchecked).toEqual({ skyline: true, bus: true });
  });
});

describe("server limits", () => {
  it("keeps the phone's 8 s grace for a slow general planner (same rule)", async () => {
    vi.useFakeTimers({ now: new Date("2026-10-14T22:00:00Z") });
    const search = (fn: string, args: Record<string, unknown> | undefined) =>
      fn === "plan_transit_general"
        ? new Promise<Reply>((resolve) => setTimeout(() => resolve(table(fn, args ?? {})), 9_500))
        : Promise.resolve(table(fn, args ?? {}));
    const pending = planTripOnServer(context(), (s) => serverDeps(s, { search, drive }));
    await vi.advanceTimersByTimeAsync(10_000);
    const result = await pending;
    expect(result.unchecked).toEqual({ skyline: true, bus: true });
    expect(result.options.length).toBeGreaterThan(0);
  });

  it("cancels a search that runs past its deadline", async () => {
    vi.useFakeTimers({ now: new Date("2026-10-14T22:00:00Z") });
    const signals: AbortSignal[] = [];
    const search = (
      fn: string,
      args: Record<string, unknown> | undefined,
      signal?: AbortSignal,
    ) => {
      if (fn !== "plan_outbound") return Promise.resolve(table(fn, args ?? {}));
      if (signal) signals.push(signal);
      return new Promise<Reply>(() => {});
    };
    const pending = planTripOnServer(context(), (s) =>
      serverDeps(s, { search, drive, searchDeadlineMs: 25_000 }),
    );
    await vi.advanceTimersByTimeAsync(25_000);
    const result = await pending;
    expect(result.unchecked.skyline).toBe(true);
    expect(signals.length).toBeGreaterThan(0);
    expect(signals.every((signal) => signal.aborted)).toBe(true);
  });

  it("sends the general search first, so the queue never holds it back", async () => {
    const order: string[] = [];
    const search = async (fn: string, args: Record<string, unknown> | undefined) => {
      order.push(fn);
      return table(fn, args ?? {});
    };
    await planTripOnServer(context(), (s) => serverDeps(s, { search, drive }));
    expect(order[0]).toBe("plan_transit_general");
  });

  it("asks the same live drive time once per trip search", async () => {
    const lookups = vi.fn((_data: unknown) => drive());
    const s = stats();
    await planTripOnServer(context(), () =>
      serverDeps(s, { search: async (fn, args) => table(fn, args ?? {}), drive: lookups }),
    );
    const keys = lookups.mock.calls.map((call) => JSON.stringify(call[0]));
    expect(new Set(keys).size).toBe(keys.length);
    expect(s.driveLookups).toBe(keys.length);
  });

  it("reports a trip too big for one request instead of answering it cut short", async () => {
    const result = await planTripOnServer(context(), (s) =>
      serverDeps(s, { search: async (fn, args) => table(fn, args ?? {}), drive, budget: 3 }),
    );
    expect(result.overBudget).toBe(true);
    expect(result.timing.searchesSent + result.timing.driveLookups).toBeLessThanOrEqual(3);
  });

  it("within budget, says so", async () => {
    const result = await planTripOnServer(context(), (s) =>
      serverDeps(s, { search: async (fn, args) => table(fn, args ?? {}), drive }),
    );
    expect(result.overBudget).toBe(false);
  });
});

describe("what the phone sends", () => {
  it("carries everything the search reads and nothing personal", () => {
    const ctx = context({
      setup: {
        ...emptySetup,
        homeStopId: "10047",
        destStopId: "1234",
        destinationName: "Josh's office",
        destinationAddress: "55 Merchant St",
      },
    });
    const sent = toTripPlanInput(ctx);
    expect(JSON.stringify(sent)).not.toMatch(/Merchant|office/);
    expect(() => tripPlanInput.parse(sent)).not.toThrow();
    const back = fromTripPlanInput(tripPlanInput.parse(JSON.parse(JSON.stringify(sent))));
    expect(back.setup.homeStopId).toBe("10047");
    expect(back.setup.destStopId).toBe("1234");
    expect(back.now.toISOString()).toBe(ctx.now.toISOString());
    expect(back.tripDirection).toEqual(ctx.tripDirection);
    expect(back.browseStations).toEqual(ctx.browseStations);
  });

  it("refuses oversized or malformed trips", () => {
    const sent = toTripPlanInput(context());
    expect(() =>
      tripPlanInput.parse({ ...sent, browseStations: Array(31).fill(sent.browseStations[0]) }),
    ).toThrow();
    expect(() => tripPlanInput.parse({ ...sent, planMode: "teleport" })).toThrow();
    expect(() =>
      tripPlanInput.parse({
        ...sent,
        tripDirection: { ...sent.tripDirection, from: { lat: 200, lon: 0 } },
      }),
    ).toThrow();
    // Outside Hawaiʻi: refused (no searches or traffic lookups elsewhere).
    expect(() =>
      tripPlanInput.parse({
        ...sent,
        tripDirection: { ...sent.tripDirection, to: { lat: 37.77, lon: -122.42 } },
      }),
    ).toThrow();
  });
});
