import { describe, expect, it } from "vitest";
import { trafficBar } from "./traffic-bar";

describe("traffic bar", () => {
  it("has nothing to show without a real delay reading", () => {
    expect(trafficBar(null)).toBeNull();
    expect(trafficBar(undefined)).toBeNull();
    expect(trafficBar(Number.NaN)).toBeNull();
  });
  it("is green and short when traffic is at or near typical", () => {
    expect(trafficBar(0)).toEqual({ fill: 8, tone: "light", label: "Light traffic" });
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
  it("treats a negative reading (faster than typical) as light", () => {
    expect(trafficBar(-3)).toEqual({ fill: 8, tone: "light", label: "Light traffic" });
  });
});
