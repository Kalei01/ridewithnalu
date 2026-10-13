import { afterEach, describe, expect, it, vi } from "vitest";
import { lookupDriveTime, lookupTrafficMinutes } from "./drive.functions";
const data = { fromLat: 21.3358, fromLon: -158.0798, toLat: 21.3099, toLon: -157.8644 };

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("drive routing availability", () => {
  it("returns unavailable without a TomTom key instead of failing the server action", async () => {
    vi.stubEnv("TOMTOM_API_KEY", "");
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    expect(await lookupDriveTime(data)).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns unavailable when TomTom rejects the route", async () => {
    vi.stubEnv("TOMTOM_API_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("unavailable", { status: 503 })));
    expect(await lookupDriveTime(data)).toBeNull();
  });

  it("returns unavailable when the provider request fails", async () => {
    vi.stubEnv("TOMTOM_API_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("network failure"); }));
    expect(await lookupDriveTime(data)).toBeNull();
  });
});

describe("traffic minutes only (station access on the server)", () => {
  const route = (seconds: number) =>
    new Response(JSON.stringify({ routes: [{ summary: { travelDurationInSeconds: seconds, lengthInMeters: 30000 } }] }), {
      status: 200,
    });

  it("sends the Drive row's own live route request, once, and rounds the same way", async () => {
    vi.stubEnv("TOMTOM_API_KEY", "test-key");
    const fetchSpy = vi.fn(async () => route(1_250));
    vi.stubGlobal("fetch", fetchSpy);
    const trip = { ...data, toLat: 21.3, toLon: -157.9 };
    expect(await lookupTrafficMinutes(trip)).toEqual({ trafficMinutes: 21 });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(String(init.body));
    expect(body).toMatchObject({ traffic: "live", routeType: "fast", travelMode: "car" });

    // The full lookup sends the same first request.
    const fullSpy = vi.fn(async () => route(1_250));
    vi.stubGlobal("fetch", fullSpy);
    await lookupDriveTime({ ...trip, toLat: 21.31 });
    const [, fullInit] = fullSpy.mock.calls[0] as unknown as [string, RequestInit];
    expect(Object.keys(JSON.parse(String(fullInit.body))).sort()).toEqual(Object.keys(body).sort());

    // Remembered for two minutes: no second request.
    expect(await lookupTrafficMinutes(trip)).toEqual({ trafficMinutes: 21 });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("returns unavailable, never a guess, when TomTom fails", async () => {
    vi.stubEnv("TOMTOM_API_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("unavailable", { status: 503 })));
    expect(await lookupTrafficMinutes({ ...data, toLat: 21.2 })).toBeNull();
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("network failure"); }));
    expect(await lookupTrafficMinutes({ ...data, toLat: 21.25 })).toBeNull();
  });
});
