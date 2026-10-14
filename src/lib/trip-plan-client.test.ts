import { beforeEach, describe, expect, it, vi } from "vitest";

const phone = vi.fn();
const server = vi.fn();
vi.mock("@/lib/transit-plan", () => ({
  planTransitTripDetailed: (...a: unknown[]) => phone(...a),
}));
vi.mock("@/lib/transit-plan.functions", () => ({
  planTripServer: (...a: unknown[]) => server(...a),
  toTripPlanInput: (ctx: unknown) => ctx,
}));
vi.mock("@/lib/debug-log", () => ({ debugLog: vi.fn() }));

const { planTrip, fitsOneServerRequest } = await import("./trip-plan-client");

const phoneAnswer = { options: [{ id: "phone" }], unchecked: { skyline: false, bus: false } };
const serverAnswer = (extra: Record<string, unknown> = {}) => ({
  options: [{ id: "server" }],
  unchecked: { skyline: false, bus: true },
  failed: false,
  overBudget: false,
  timing: { ms: 1, searches: 1, searchesSent: 1, driveLookups: 0, late: 0, overBudget: 0 },
  ...extra,
});
const ctx = (overrides: Record<string, unknown> = {}) =>
  ({ planMode: "leave-now", vehicleToStation: "vehicle", ...overrides }) as never;

function usePath(path: "server" | "phone") {
  vi.stubGlobal("window", { location: { search: `?plan=${path}` } });
  const store = new Map<string, string>();
  vi.stubGlobal("sessionStorage", {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => store.set(k, v),
  });
}

beforeEach(() => {
  vi.unstubAllGlobals();
  phone.mockReset().mockResolvedValue(phoneAnswer);
  server.mockReset().mockResolvedValue(serverAnswer());
});

describe("which path a trip search takes", () => {
  it("server path: one request, its answer as is", async () => {
    usePath("server");
    expect(await planTrip(ctx())).toEqual({
      options: [{ id: "server" }],
      unchecked: { skyline: false, bus: true },
    });
    expect(phone).not.toHaveBeenCalled();
  });

  it("phone path when asked", async () => {
    usePath("phone");
    expect(await planTrip(ctx())).toEqual(phoneAnswer);
    expect(server).not.toHaveBeenCalled();
  });

  it("Arrive By with a car stays on the phone", async () => {
    usePath("server");
    expect(fitsOneServerRequest(ctx({ planMode: "arrive-by" }))).toBe(false);
    expect(fitsOneServerRequest(ctx({ planMode: "arrive-by", vehicleToStation: "none" }))).toBe(
      true,
    );
    await planTrip(ctx({ planMode: "arrive-by" }));
    expect(server).not.toHaveBeenCalled();
    expect(phone).toHaveBeenCalledTimes(1);
  });

  it("falls back to the phone when the request can't be made or the trip is too big", async () => {
    usePath("server");
    server.mockRejectedValueOnce(new Error("network"));
    expect(await planTrip(ctx())).toEqual(phoneAnswer);
    server.mockResolvedValueOnce(serverAnswer({ overBudget: true }));
    expect(await planTrip(ctx())).toEqual(phoneAnswer);
  });

  it("a search that failed on the server shows 'Can't check' (throws), without running again", async () => {
    usePath("server");
    server.mockResolvedValueOnce(serverAnswer({ failed: true }));
    await expect(planTrip(ctx())).rejects.toThrow();
    expect(phone).not.toHaveBeenCalled();
  });
});
