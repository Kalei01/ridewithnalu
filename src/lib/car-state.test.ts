import { describe, expect, it } from "vitest";
import { carAvailableForDrive } from "./car-state";

describe("parked-car state", () => {
  it("keeps Drive available when no car location was recorded today", () => {
    expect(carAvailableForDrive(null, false)).toBe(true);
    expect(carAvailableForDrive(null, true)).toBe(true);
  });
  it("outbound needs the car at home; return needs it at the destination", () => {
    expect(carAvailableForDrive({ place: "home" }, false)).toBe(true);
    expect(carAvailableForDrive({ place: "station" }, false)).toBe(false);
    expect(carAvailableForDrive({ place: "destination" }, true)).toBe(true);
    expect(carAvailableForDrive({ place: "station" }, true)).toBe(false);
    expect(carAvailableForDrive({ place: "home" }, true)).toBe(false);
  });
});
