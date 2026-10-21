import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetHpd } from "./drive/hpd-incidents";
import { breakerState, resetTomtomGuard, usageSnapshot, BREAKER_FORBIDDEN_MS } from "./drive/tomtom-guard";
import { lookupDriveTime, lookupTrafficMinutes, resetDriveCaches } from "./drive.functions";
const data = { fromLat: 21.3358, fromLon: -158.0798, toLat: 21.3099, toLon: -157.8644 };

beforeEach(() => {
  resetTomtomGuard();
  resetDriveCaches();
  resetHpd();
  vi.stubEnv("MAPBOX_ACCESS_TOKEN", "pk.test");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("drive routing availability", () => {
  it("returns unavailable without a TomTom key instead of failing the server action", async () => {
    vi.stubEnv("TOMTOM_API_KEY", "");
    const fetchSpy = vi.fn(async () => new Response("no", { status: 500 }));
    vi.stubGlobal("fetch", fetchSpy);
    expect(await lookupDriveTime(data)).toBeNull();
    // Only the Mapbox fallback may be asked; TomTom never is.
    for (const call of fetchSpy.mock.calls as unknown as Array<[string]>) expect(call[0]).not.toContain("tomtom");
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
    expect(await lookupTrafficMinutes(trip)).toEqual({ trafficMinutes: 21, provider: "tomtom" });
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
    expect(await lookupTrafficMinutes(trip)).toEqual({ trafficMinutes: 21, provider: "tomtom" });
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


const mapboxBody = {
  code: "Ok",
  routes: [
    {
      duration: 1500,
      duration_typical: 1200,
      distance: 30000,
      geometry: { coordinates: [[-158.0798, 21.3358], [-157.95, 21.33], [-157.8644, 21.3099]] },
      legs: [
        {
          annotation: { congestion: ["low", "heavy"] },
          steps: [
            { distance: 100, name: "Kualakaʻi Pkwy", maneuver: { location: [-158.0798, 21.3358], type: "depart", instruction: "Head east" } },
            { distance: 29900, name: "Queen Liliuokalani Freeway", ref: "H-1", maneuver: { location: [-157.95, 21.33], type: "on ramp", modifier: "slight right", instruction: "Take the ramp onto H-1" } },
            { distance: 0, name: "", maneuver: { location: [-157.8644, 21.3099], type: "arrive", instruction: "You have arrived" } },
          ],
        },
      ],
    },
  ],
};

describe("Mapbox fallback", () => {
  const tomtomRoute = new Response(
    JSON.stringify({ routes: [{ summary: { travelDurationInSeconds: 1200, lengthInMeters: 30000 } }] }),
    { status: 200 },
  );
  const hostOf = (call: unknown) => String((call as [string])[0]);

  it("uses Mapbox after TomTom answers 403, labels it, and reports incidents as unavailable", async () => {
    vi.stubEnv("TOMTOM_API_KEY", "test-key");
    const fetchSpy = vi.fn(async (url: string) =>
      url.includes("mapbox") ? new Response(JSON.stringify(mapboxBody), { status: 200 }) : new Response("quota", { status: 403 }),
    );
    vi.stubGlobal("fetch", fetchSpy);
    const drive = await lookupDriveTime(data);
    expect(drive).toMatchObject({
      provider: "mapbox",
      trafficMinutes: 25,
      typicalMinutes: 20,
      typicalChecked: true,
      incidentsAvailable: false,
      incidents: [],
    });
    expect(drive?.maneuvers.map((m) => m.maneuver)).toEqual(["ENTER_MOTORWAY", "ARRIVE"]);
    expect(drive?.trafficSections).toHaveLength(0); // one heavy segment is too short to draw
  });

  it("marks typical as unchecked when Mapbox sends no duration_typical", async () => {
    vi.stubEnv("TOMTOM_API_KEY", "");
    const body = structuredClone(mapboxBody);
    delete (body.routes[0] as { duration_typical?: number }).duration_typical;
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(body), { status: 200 })));
    const drive = await lookupDriveTime(data);
    expect(drive).toMatchObject({ provider: "mapbox", typicalChecked: false, delayMinutes: 0 });
  });

  it("opens a 15-minute breaker on 403: TomTom is not called again", async () => {
    vi.stubEnv("TOMTOM_API_KEY", "test-key");
    const fetchSpy = vi.fn(async (url: string) =>
      url.includes("mapbox") ? new Response(JSON.stringify(mapboxBody), { status: 200 }) : new Response("quota", { status: 403 }),
    );
    vi.stubGlobal("fetch", fetchSpy);
    await lookupDriveTime(data);
    expect(breakerState("routing").open).toBe(true);
    expect(breakerState("routing").reopensInMs).toBeGreaterThan(BREAKER_FORBIDDEN_MS - 5_000);
    const tomtomCalls = () => fetchSpy.mock.calls.filter((c) => hostOf(c).includes("tomtom")).length;
    const before = tomtomCalls();
    await lookupDriveTime({ ...data, toLat: 21.2 });
    await lookupTrafficMinutes({ ...data, toLat: 21.25 });
    expect(tomtomCalls()).toBe(before);
  });

  it("never caches or stores Mapbox results: every call asks again", async () => {
    vi.stubEnv("TOMTOM_API_KEY", "");
    const fetchSpy = vi.fn(async () => new Response(JSON.stringify(mapboxBody), { status: 200 }));
    vi.stubGlobal("fetch", fetchSpy);
    await lookupDriveTime(data);
    await lookupDriveTime(data);
    expect(fetchSpy.mock.calls.filter((c) => hostOf(c).includes("mapbox"))).toHaveLength(2);
  });

  it("keeps via-path pricing TomTom-only", async () => {
    vi.stubEnv("TOMTOM_API_KEY", "test-key");
    const fetchSpy = vi.fn(async () => new Response("quota", { status: 403 }));
    vi.stubGlobal("fetch", fetchSpy);
    expect(await lookupDriveTime({ ...data, via: [{ lat: 21.32, lon: -158 }, { lat: 21.31, lon: -157.9 }] })).toBeNull();
    for (const c of fetchSpy.mock.calls) expect(hostOf(c)).not.toContain("mapbox");
  });

  it("falls back for 5xx and timeouts too, and 400 is not a fallback case", async () => {
    vi.stubEnv("TOMTOM_API_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url.includes("mapbox")) return new Response(JSON.stringify(mapboxBody), { status: 200 });
      throw Object.assign(new Error("timed out"), { name: "TimeoutError" });
    }));
    expect((await lookupDriveTime(data))?.provider).toBe("mapbox");
  });
});

describe("TomTom call savings", () => {
  const route = () =>
    new Response(JSON.stringify({ routes: [{ summary: { travelDurationInSeconds: 1200, lengthInMeters: 30000 }, path: { coordinates: [[-158.08, 21.33], [-157.86, 21.31]] } }] }), { status: 200 });
  const incidents = () => new Response(JSON.stringify({ incidents: [] }), { status: 200 });
  const respond = vi.fn(async (url: string) => {
    if (url.includes("incidentDetails")) return incidents();
    if (!url.includes("tomtom")) return new Response("[]", { status: 200 }); // HDOT roadwork feeds
    return route();
  });
  const tomtomCalls = () => respond.mock.calls.filter((c) => String(c[0]).includes("tomtom")).length;

  it("a leave-now drive costs 2 routing + 1 incident calls, then repeats cost nothing", async () => {
    vi.stubEnv("TOMTOM_API_KEY", "test-key");
    respond.mockClear();
    vi.stubGlobal("fetch", respond);
    const drive = await lookupDriveTime(data);
    expect(drive?.provider).toBe("tomtom");
    expect(drive?.incidentsAvailable).toBe(true);
    const u1 = usageSnapshot();
    expect(u1.tomtomRouting.used).toBe(2);
    expect(u1.tomtomIncidents.used).toBe(1);
    await lookupDriveTime(data); // 5-minute server cache
    expect(tomtomCalls()).toBe(3);
  });

  it("the historical baseline is reused for the same trip even when the live answer is refreshed", async () => {
    vi.stubEnv("TOMTOM_API_KEY", "test-key");
    respond.mockClear();
    vi.stubGlobal("fetch", respond);
    await lookupDriveTime(data);
    await lookupDriveTime({ ...data, forceRefresh: true });
    // second pass: live route only (baseline and island incident box are remembered)
    expect(usageSnapshot().tomtomRouting.used).toBe(3);
    expect(usageSnapshot().tomtomIncidents.used).toBe(1);
  });

  it("other trips on the island share one incident answer", async () => {
    vi.stubEnv("TOMTOM_API_KEY", "test-key");
    respond.mockClear();
    vi.stubGlobal("fetch", respond);
    await lookupDriveTime(data);
    await lookupDriveTime({ ...data, toLat: 21.4, toLon: -157.9 });
    expect(usageSnapshot().tomtomIncidents.used).toBe(1);
  });

  it("the lite health probe is a single routing call", async () => {
    vi.stubEnv("TOMTOM_API_KEY", "test-key");
    respond.mockClear();
    vi.stubGlobal("fetch", respond);
    await lookupDriveTime(data, { lite: true });
    expect(tomtomCalls()).toBe(1);
  });

  it("adds HPD police reports on the route to nearbyIncidents, with no delay, when TomTom incidents are down", async () => {
    vi.stubEnv("TOMTOM_API_KEY", "test-key");
    const now = new Date();
    const hst = new Date(now.getTime() - 10 * 3600_000);
    const pad = (n: number) => String(n).padStart(2, "0");
    const hpdRows = [
      {
        date: `${hst.getUTCFullYear()}-${pad(hst.getUTCMonth() + 1)}-${pad(hst.getUTCDate())}T00:00:00.000`,
        time: `${pad(hst.getUTCHours())}:${pad(hst.getUTCMinutes())}`,
        type: "TRAFFIC COLLISION",
        address: "H1 FWY EB",
        location: { latitude: "21.33", longitude: "-157.95" },
      },
    ];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("honolulu.gov")) return new Response(JSON.stringify(hpdRows), { status: 200 });
        if (url.includes("mapbox")) return new Response(JSON.stringify(mapboxBody), { status: 200 });
        if (url.includes("tomtom")) return new Response("quota", { status: 403 });
        return new Response("[]", { status: 200 });
      }),
    );
    const drive = await lookupDriveTime(data);
    expect(drive).toMatchObject({ provider: "mapbox", incidentsAvailable: false, hpdChecked: true, incidents: [] });
    expect(drive?.nearbyIncidents).toHaveLength(1);
    expect(drive?.nearbyIncidents?.[0]).toMatchObject({ source: "hpd", delayMinutes: null, category: "1" });
  });
});


describe("police report de-duplication and status", () => {
  it("skips a coordinate-less police report when TomTom already lists a collision on that road", async () => {
    const { withHpdReports } = await import("./drive.functions");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("no", { status: 500 })));
    // The feed is unreachable here: nothing to merge, and the existing list is untouched.
    const known = [{ description: "Accident", road: "H-1 East", delayMinutes: 3, category: "1", points: [] }];
    const out = await withHpdReports(known as never, [], { path: [], roads: [] });
    expect(out).toEqual({ nearby: known, checked: false });
  });
});
