import { describe, expect, it } from "vitest";
import { routeBearingAt, smoothBearing } from "./navigation-voice";

const northThenEast = [
  { lat: 21.3, lon: -157.86 },
  { lat: 21.301, lon: -157.86 },
  { lat: 21.302, lon: -157.86 },
  { lat: 21.302, lon: -157.859 },
  { lat: 21.302, lon: -157.858 },
];

describe("routeBearingAt", () => {
  it("faces along the road you're on", () => {
    expect(routeBearingAt(northThenEast, { lat: 21.3, lon: -157.86 })).toBeCloseTo(0, 0);
    expect(routeBearingAt(northThenEast, { lat: 21.302, lon: -157.8588 })).toBeCloseTo(90, 0);
  });
  it("gives no direction when you're well off the route", () => {
    expect(routeBearingAt(northThenEast, { lat: 21.31, lon: -157.86 })).toBeNull();
  });
});

describe("smoothBearing", () => {
  it("turns most of the way on one update", () => {
    const next = smoothBearing(0, { gpsHeading: null, speedMps: 10, from: null, to: { lat: 21.3, lon: -157.86 }, routeBearing: 90 });
    expect(next).toBeCloseTo(63, 0);
  });
});
