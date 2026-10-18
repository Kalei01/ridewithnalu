import { describe, expect, it } from "vitest";
import { h1PeekLine, nextTrainLine } from "./browse-peek";

const road = (delayMinutes: number, incidents: unknown[] = [], typicalChecked = true) => ({
  delayMinutes,
  incidents,
  typicalChecked,
});

describe("h1PeekLine", () => {
  it("says nothing until a check has answered", () => {
    expect(h1PeekLine(undefined, undefined)).toBeNull();
  });
  it("never shows an old answer after a failed check", () => {
    expect(h1PeekLine(road(0), road(0), true)).toBe("Can’t check H-1 right now");
  });
  it("says clear both ways", () => {
    expect(h1PeekLine(road(0), road(0))).toBe("H-1 is clear both ways");
  });
  it("names the worse direction", () => {
    expect(h1PeekLine(road(3), road(12))).toBe("H-1 westbound: +12 min over typical");
  });
  it("is never clear when a direction has an incident, even at +0", () => {
    expect(h1PeekLine(road(0), road(0, [{}]))).toBe("H-1 westbound: incident reported");
  });
  it("picks the incident direction before the bigger delay", () => {
    expect(h1PeekLine(road(0, [{}]), road(3))).toBe("H-1 eastbound: incident reported");
  });
  it("does not claim clear without a typical-traffic baseline", () => {
    expect(h1PeekLine(road(0, [], false), road(0, [], false))).toBe(
      "H-1: no typical-traffic baseline right now",
    );
  });
  it("works with one direction", () => {
    expect(h1PeekLine(road(0), undefined)).toBe("H-1 eastbound is clear");
  });
});

describe("nextTrainLine", () => {
  const dep = (s: number) => ({
    departure_seconds: s,
    direction_terminus: null,
    trip_headsign: null,
  });
  it("says now inside the first minute", () => {
    expect(nextTrainLine([[dep(1030)]], 1000, "Kualaka'i", null)).toMatch(/^Next train now · /);
  });
  it("counts minutes up to 20, then shows the clock", () => {
    expect(nextTrainLine([[dep(1000 + 125)]], 1000, "x", null)).toMatch(/^Next train in 3 min/);
    expect(nextTrainLine([[dep(1000 + 25 * 60)]], 1000, "x", null)).toMatch(
      /^Next train \d+:\d\d [AP]M/,
    );
  });
  it("skips trains the walk makes uncatchable", () => {
    const line = nextTrainLine([[dep(1000 + 120), dep(1000 + 15 * 60)]], 1000, "x", 10);
    expect(line).toMatch(/^Next you can make in 15 min/);
  });
  it("is null when nothing is scheduled or catchable", () => {
    expect(nextTrainLine([], 1000, "x", null)).toBeNull();
    expect(nextTrainLine([[dep(1000 + 120)]], 1000, "x", 10)).toBeNull();
  });
});
