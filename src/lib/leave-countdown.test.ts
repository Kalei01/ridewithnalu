import { describe, expect, it } from "vitest";
import { leaveCountdown } from "./leave-countdown";

const at = (h: number, m: number, s = 0) => h * 3600 + m * 60 + s;

describe("leave countdown", () => {
  it("counts whole minutes up, from real clock times", () => {
    expect(leaveCountdown(at(7, 41), at(7, 35, 10))).toEqual({
      text: "In 6 min",
      tone: "ahead",
    });
  });
  it("turns to 'soon' at two minutes and under a minute at the end", () => {
    expect(leaveCountdown(at(7, 41), at(7, 39, 30))?.tone).toBe("soon");
    expect(leaveCountdown(at(7, 41), at(7, 40, 30))).toEqual({
      text: "In under a minute",
      tone: "soon",
    });
  });
  it("says it is time once the leave-by time has arrived, for ten minutes", () => {
    expect(leaveCountdown(at(7, 41), at(7, 41))).toEqual({ text: "Time to go", tone: "go" });
    expect(leaveCountdown(at(7, 41), at(7, 50))?.tone).toBe("go");
    expect(leaveCountdown(at(7, 41), at(7, 52))).toBeNull();
  });
  it("stays quiet when the leave time is far off", () => {
    expect(leaveCountdown(at(9, 0), at(7, 0))).toBeNull();
    expect(leaveCountdown(at(8, 29), at(7, 0))?.text).toBe("In 89 min");
  });
  it("handles midnight", () => {
    expect(leaveCountdown(at(0, 5), at(23, 55))?.text).toBe("In 10 min");
    expect(leaveCountdown(at(23, 58), at(0, 2))?.tone).toBe("go");
  });
});
