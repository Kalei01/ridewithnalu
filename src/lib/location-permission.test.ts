import { describe, expect, it, vi } from "vitest";

import {
  detectLocationPlatform,
  isPermissionDeniedError,
  queryLocationPermission,
  type LocationPermission,
} from "./location-permission";

describe("isPermissionDeniedError", () => {
  it("recognizes the PERMISSION_DENIED code (1)", () => {
    expect(isPermissionDeniedError({ code: 1, message: "User denied Geolocation" })).toBe(true);
  });

  it("does not treat other geolocation errors as denials", () => {
    expect(isPermissionDeniedError({ code: 2, message: "Position unavailable" })).toBe(false);
    expect(isPermissionDeniedError({ code: 3, message: "Timeout" })).toBe(false);
    expect(isPermissionDeniedError(new Error("timeout"))).toBe(false);
    expect(isPermissionDeniedError(null)).toBe(false);
    expect(isPermissionDeniedError(undefined)).toBe(false);
    expect(isPermissionDeniedError("denied")).toBe(false);
  });
});

describe("queryLocationPermission", () => {
  it("maps the Permissions API state", async () => {
    vi.stubGlobal(
      "navigator",
      { permissions: { query: async () => ({ state: "denied" }) } } as unknown as Navigator,
    );
    expect(await queryLocationPermission()).toBe<LocationPermission>("denied");

    vi.stubGlobal(
      "navigator",
      { permissions: { query: async () => ({ state: "granted" }) } } as unknown as Navigator,
    );
    expect(await queryLocationPermission()).toBe<LocationPermission>("granted");
    vi.unstubAllGlobals();
  });

  it("falls back to unsupported when geolocation is not a queryable permission", async () => {
    vi.stubGlobal(
      "navigator",
      { permissions: { query: async () => { throw new Error("TypeError: name not supported"); } } } as unknown as Navigator,
    );
    expect(await queryLocationPermission()).toBe("unsupported");
    vi.unstubAllGlobals();
  });

  it("falls back to unsupported without the Permissions API", async () => {
    vi.stubGlobal("navigator", {} as unknown as Navigator);
    expect(await queryLocationPermission()).toBe("unsupported");
    vi.unstubAllGlobals();
  });
});

describe("detectLocationPlatform", () => {
  it("detects iOS Safari", () => {
    const ua =
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
    expect(detectLocationPlatform(ua, true)).toBe("ios");
  });

  it("detects iPadOS reporting as Macintosh with touch", () => {
    const ua =
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15";
    expect(detectLocationPlatform(ua, true)).toBe("ios");
  });

  it("detects Android Chrome", () => {
    const ua =
      "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36";
    expect(detectLocationPlatform(ua, true)).toBe("android");
  });

  it("detects desktop browsers", () => {
    const ua =
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
    expect(detectLocationPlatform(ua, false)).toBe("desktop");
  });
});
