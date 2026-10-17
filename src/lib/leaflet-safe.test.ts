import { describe, expect, it, vi } from "vitest";
import { removeMapSafely } from "./leaflet-safe";

describe("removeMapSafely", () => {
  it("stops animations and clears the zoom flag before removing", () => {
    const calls: string[] = [];
    const map = {
      _animatingZoom: true,
      stop: vi.fn(() => calls.push("stop")),
      off: vi.fn(() => calls.push("off")),
      remove: vi.fn(function (this: { _animatingZoom: boolean }) {
        calls.push(`remove:${String(this._animatingZoom)}`);
      }),
    };
    removeMapSafely(map as never);
    expect(calls).toEqual(["stop", "off", "remove:false"]);
  });
});

describe("isMapAlive", () => {
  it("is false for a missing, unloaded, removed or detached map", async () => {
    const { isMapAlive } = await import("./leaflet-safe");
    const mk = (loaded: boolean, connected: boolean) =>
      ({ _loaded: loaded, getContainer: () => ({ isConnected: connected }) }) as never;
    expect(isMapAlive(null)).toBe(false);
    expect(isMapAlive(mk(false, true))).toBe(false);
    expect(isMapAlive(mk(true, false))).toBe(false);
    expect(isMapAlive(mk(true, true))).toBe(true);
  });
});
