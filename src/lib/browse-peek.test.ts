import { describe, expect, it } from "vitest";
import { h1PeekLine, nextTrainMinutes } from "./browse-peek";

const road = (delayMinutes: number, incidents: unknown[] = []) => ({ delayMinutes, incidents });

describe("h1PeekLine", () => {
  it("says nothing until a check has answered", () => {
    expect(h1PeekLine(undefined, undefined)).toBeNull();
  });
  it("says clear both ways", () => {
    expect(h1PeekLine(road(0), road(0))).toBe("H-1 is clear both ways");
  });
  it("names the worse direction", () => {
    expect(h1PeekLine(road(3), road(12))).toBe("H-1 westbound: +12 min over typical");
  });
  it("puts an incident first", () => {
    expect(h1PeekLine(road(0), road(4, [{}]))).toBe("H-1 westbound: incident reported");
  });
  it("works with one direction", () => {
    expect(h1PeekLine(road(0), undefined)).toBe("H-1 eastbound is clear");
  });
});

describe("nextTrainMinutes", () => {
  it("takes the soonest first departure, rounded up", () => {
    expect(
      nextTrainMinutes(
        [[{ departure_seconds: 1000 + 600 }], [{ departure_seconds: 1000 + 125 }]],
        1000,
      ),
    ).toBe(3);
  });
  it("is null when nothing is scheduled", () => {
    expect(nextTrainMinutes([], 1000)).toBeNull();
  });
  it("ignores trains that already left", () => {
    expect(nextTrainMinutes([[{ departure_seconds: 800 }]], 1000)).toBeNull();
  });
});
