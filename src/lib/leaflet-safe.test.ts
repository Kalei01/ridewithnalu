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
