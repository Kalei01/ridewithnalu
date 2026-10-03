import { afterEach, describe, expect, it, vi } from "vitest";
import { lookupDriveTime } from "./drive.functions";
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
