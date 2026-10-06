import { describe, expect, it } from "vitest";
import {
  preferLessWalking,
  preferShorterCarLeg,
  preferSkylineOverCar,
  totalWalkMinutes,
} from "./walk-preference";

const walk = (minutes: number) => ({
  mode: "walk",
  minutes,
  depart_seconds: null,
  arrive_seconds: null,
});
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

describe("car legs with Skyline", () => {
  const car = (minutes: number) => ({
    mode: "drive",
    minutes,
    depart_seconds: null,
    arrive_seconds: null,
  });
  // Heading home from downtown at 5 PM: bus, then Skyline to a station, then a car home.
  const pickup = (arrive: number, railMin: number, carMin: number) =>
    option(arrive, [ride("W", 19, 0), ride("", railMin, 1200, "rail"), car(carMin)]);
  const eastKapolei = pickup(65220, 32, 8); // home 6:07 PM
  const waipahu = pickup(65000, 21, 15); // home 6:03 PM
  const kahauiki = pickup(64800, 2, 26); // home 6:00 PM, 2 minutes on the train

  it("a car trip is only a Skyline trip when the train is the bigger part", () => {
    expect(preferSkylineOverCar([eastKapolei, waipahu, kahauiki])).toEqual([eastKapolei, waipahu]);
    const bus = option(70000, [walk(5), ride("42", 40, 0)]);
    expect(preferSkylineOverCar([bus])).toEqual([bus]);
  });

  it("among car trips arriving about the same time, prefers the clearly shorter car leg", () => {
    // Waipahu is only 4 minutes sooner; East Kapolei's pickup is 7 minutes shorter.
    expect(preferShorterCarLeg([eastKapolei, waipahu])).toEqual([eastKapolei]);
  });

  it("keeps a car trip that is much sooner", () => {
    const muchSooner = pickup(64000, 25, 15);
    expect(preferShorterCarLeg([eastKapolei, muchSooner])).toEqual([eastKapolei, muchSooner]);
  });

  it("never removes a trip without a car, and ignores small differences in car time", () => {
    const bus = option(64000, [walk(5), ride("42", 40, 0)]);
    const uhWest = pickup(65220, 30, 10);
    expect(preferShorterCarLeg([bus, eastKapolei, uhWest])).toEqual([bus, eastKapolei, uhWest]);
  });
});
