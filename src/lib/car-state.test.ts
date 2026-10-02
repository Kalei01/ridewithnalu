import { describe, expect, it } from "vitest";
import { carAvailableForDrive } from "./car-state";

describe("parked-car state", () => {
  it("keeps Drive available when no car location was recorded today", () => {
    expect(carAvailableForDrive(null, false)).toBe(true);
    expect(carAvailableForDrive(null, true)).toBe(true);
  });
  it("allows driving from the recorded car location and blocks the opposite leg", () => {
    expect(carAvailableForDrive({ place: "home" }, false)).toBe(true);
    expect(carAvailableForDrive({ place: "station" }, false)).toBe(true);
    // Destination is no longer a tracked parked-car state; legacy values are non-blocking.
    expect(carAvailableForDrive({ place: "destination" } as unknown as { place?: "home" | "station" }, true)).toBe(true);
    expect(carAvailableForDrive({ place: "station" }, true)).toBe(false);
    expect(carAvailableForDrive({ place: "home" }, true)).toBe(false);
  });
});
