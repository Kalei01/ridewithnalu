import { describe, expect, it } from "vitest";
import { trafficBar } from "./traffic-bar";

describe("traffic bar", () => {
  it("has nothing to show without a real delay reading", () => {
    expect(trafficBar(null)).toBeNull();
    expect(trafficBar(undefined)).toBeNull();
    expect(trafficBar(Number.NaN)).toBeNull();
  });
  it("draws nothing for a zero delay, which can also mean no typical time was available", () => {
    expect(trafficBar(0)).toBeNull();
    expect(trafficBar(0.4)).toBeNull();
  });
  it("is green and short for a small real delay", () => {
    expect(trafficBar(1)).toEqual({ fill: 8, tone: "light", label: "+1 min over typical" });
    expect(trafficBar(4)?.tone).toBe("light");
  });
  it("turns amber at 5 minutes and red at 10, tied to the real delay", () => {
    expect(trafficBar(5)).toEqual({ fill: 25, tone: "moderate", label: "+5 min over typical" });
    expect(trafficBar(9)?.tone).toBe("moderate");
    expect(trafficBar(10)?.tone).toBe("heavy");
  });
  it("fills the whole bar at 20 minutes or more, never past it", () => {
    expect(trafficBar(20)?.fill).toBe(100);
    expect(trafficBar(45)?.fill).toBe(100);
  });
  it("draws nothing when live is faster than typical", () => {
    expect(trafficBar(-3)).toBeNull();
  });
});
