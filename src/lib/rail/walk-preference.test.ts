import { describe, expect, it } from "vitest";
import { preferLessWalking, totalWalkMinutes } from "./walk-preference";

const walk = (minutes: number) => ({ mode: "walk", minutes, depart_seconds: null, arrive_seconds: null });
const ride = (route: string, minutes: number, depart: number, mode = "bus") => ({
  mode,
  minutes,
  route_short: route,
  depart_seconds: depart,
  arrive_seconds: depart + minutes * 60,
});
const option = (arrive: number, legs: ReturnType<typeof walk | typeof ride>[]) => ({
  arrive_seconds: arrive,
  leave_by_seconds: 0,
  legs,
});

describe("preferLessWalking", () => {
  it("counts only walking legs", () => {
    expect(totalWalkMinutes(option(0, [walk(12), ride("W", 34, 0), walk(15)]))).toBe(27);
  });

  it("prefers a trip a few minutes later that walks much less", () => {
    const longWalk = option(3600, [walk(12), ride("W", 20, 720), walk(25)]);
    const shortWalk = option(3780, [walk(4), ride("13", 40, 240), walk(3)]);
    expect(preferLessWalking([longWalk, shortWalk])).toEqual([shortWalk]);
  });

  it("keeps the faster trip when the slower one arrives much later", () => {
    const longWalk = option(3600, [walk(12), ride("W", 20, 720), walk(25)]);
    const muchLater = option(3600 + 20 * 60, [walk(4), ride("13", 40, 240), walk(3)]);
    expect(preferLessWalking([longWalk, muchLater])).toEqual([longWalk, muchLater]);
  });

  it("keeps both when the walking saved is small", () => {
    const a = option(3600, [walk(8), ride("W", 30, 480), walk(5)]);
    const b = option(3720, [walk(5), ride("42", 30, 300), walk(4)]);
    expect(preferLessWalking([a, b])).toEqual([a, b]);
  });

  it("drops a one-minute bus hop used only to transfer", () => {
    const hop = option(4000, [walk(3), ride("13", 1, 180), walk(2), ride("W", 25, 600), walk(5)]);
    const plain = option(4100, [walk(6), ride("W", 30, 360), walk(5)]);
    expect(preferLessWalking([hop, plain])).toEqual([plain]);
  });

  it("keeps hop trips when nothing else exists", () => {
    const hop = option(4000, [walk(3), ride("13", 1, 180), walk(2), ride("W", 25, 600), walk(5)]);
    expect(preferLessWalking([hop])).toEqual([hop]);
  });

  it("removes duplicates on the same vehicles, keeping the shorter walk", () => {
    const farCurb = option(3660, [walk(12), ride("W", 34, 720), walk(15)]);
    const nearCurb = option(3600, [walk(10), ride("W", 34, 720), walk(14)]);
    expect(preferLessWalking([farCurb, nearCurb])).toEqual([nearCurb]);
  });

  it("keeps a single rail trip untouched", () => {
    const rail = option(5000, [walk(5), ride("", 7, 300, "rail"), walk(4)]);
    expect(preferLessWalking([rail])).toEqual([rail]);
  });
});
