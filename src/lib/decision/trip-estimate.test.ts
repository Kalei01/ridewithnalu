import { describe, expect, it } from "vitest";
import { destinationAccess } from "../destination-access";
import { decideArrival, decideTrip } from "./commute-decision";
import { driveEstimate, transitEstimate, type TripEstimate } from "./trip-estimate";

const nowMs = Date.parse("2026-09-28T16:00:00-10:00");
const at = (hour: number, minute = 0) => (hour * 60 + minute) * 60;
const downtown = destinationAccess({ lat: 21.309, lon: -157.862 });

function drive(
  trafficMinutes: number,
  low = trafficMinutes - 2,
  high = trafficMinutes + 3,
): TripEstimate {
  return driveEstimate({
    drive: {
      trafficMinutes,
      lowMinutes: low,
      highMinutes: high,
      delayMinutes: trafficMinutes - 38,
      fetchedAt: nowMs,
      trafficBasis: "live",
    },
    access: downtown,
    nowSeconds: at(6),
    nowMs,
    carAvailable: true,
  });
}

function rail(
  arriveMinutesAfterSix: number,
  leaveMinutesAfterSix = 0,
  legs: Array<{
    mode: "walk" | "rail" | "bus" | "drive";
    depart_seconds: number;
    arrive_seconds: number;
    minutes: number;
  }> = [],
): TripEstimate {
  return transitEstimate({
    option: {
      leave_by_seconds: at(6) + leaveMinutesAfterSix * 60,
      arrive_seconds: at(6) + arriveMinutesAfterSix * 60,
      total_minutes: arriveMinutesAfterSix - leaveMinutesAfterSix,
      legs,
    },
    nowSeconds: at(6),
    nowMs,
    scheduleFetchedAt: nowMs,
  });
}

describe("normalized trip estimates", () => {
  it("compares Kapolei to downtown door to door, including parking and walk", () => {
    const item = drive(42, 40, 48);
    expect(item.expectedDurationMinutes).toBe(42);
    expect(item.latestArrival).toBe(at(6) + 48 * 60);
    expect(item.walkingMinutes).toBe(10);
    expect(decideTrip(item, rail(48)).state).toBe("drive");
    expect(decideTrip(item, rail(42)).state).toBe("same");
  });

  it("counts time before a reachable train in the leave-now arrival", () => {
    const item = rail(65, 20);
    expect(item.expectedDurationMinutes).toBe(65);
    expect(item.waitMinutes).toBe(20);
  });

  it("labels direct bus and mixed transit itineraries by their actual modes", () => {
    expect(rail(40, 0, [
      { mode: "walk", depart_seconds: at(6), arrive_seconds: at(6, 5), minutes: 5 },
      { mode: "bus", depart_seconds: at(6, 6), arrive_seconds: at(6, 40), minutes: 34 },
    ]).transitLabel).toBe("Bus");

    expect(rail(50, 0, [
      { mode: "walk", depart_seconds: at(6), arrive_seconds: at(6, 3), minutes: 3 },
      { mode: "rail", depart_seconds: at(6, 4), arrive_seconds: at(6, 35), minutes: 31 },
      { mode: "bus", depart_seconds: at(6, 40), arrive_seconds: at(6, 50), minutes: 10 },
    ]).transitLabel).toBe("Rail + Bus");

    expect(rail(35, 0, [
      { mode: "rail", depart_seconds: at(6), arrive_seconds: at(6, 35), minutes: 35 },
    ]).transitLabel).toBe("Rail");
    expect(rail(55, 0, [
      { mode: "bus", depart_seconds: at(6), arrive_seconds: at(6, 25), minutes: 25 },
      { mode: "walk", depart_seconds: at(6, 25), arrive_seconds: at(6, 28), minutes: 3 },
      { mode: "bus", depart_seconds: at(6, 30), arrive_seconds: at(6, 55), minutes: 25 },
    ]).transitLabel).toBe("Bus + Bus");
  });

  it("keeps walking and bus/rail transfer waits as evidence without double-counting", () => {
    const item = rail(55, 0, [
      { mode: "walk", depart_seconds: at(6), arrive_seconds: at(6, 10), minutes: 10 },
      { mode: "rail", depart_seconds: at(6, 15), arrive_seconds: at(6, 35), minutes: 20 },
      { mode: "bus", depart_seconds: at(6, 46), arrive_seconds: at(6, 55), minutes: 9 },
    ]);
    expect(item.walkingMinutes).toBe(10);
    expect(item.railWaitMinutes).toBe(5);
    expect(item.busWaitMinutes).toBe(11);
    expect(item.transferMinutes).toBe(11);
    expect(item.expectedDurationMinutes).toBe(55);
  });

  it("marks stale traffic and stale timetable separately", () => {
    const oldDrive = driveEstimate({
      drive: {
        trafficMinutes: 42,
        lowMinutes: 40,
        highMinutes: 48,
        delayMinutes: 4,
        fetchedAt: nowMs - 6 * 60_000,
        trafficBasis: "live",
      },
      access: downtown,
      nowSeconds: at(6),
      nowMs,
      carAvailable: true,
    });
    const oldRail = transitEstimate({
      option: null,
      nowSeconds: at(6),
      nowMs,
      scheduleFetchedAt: nowMs - 11 * 60_000,
    });
    expect(oldDrive.source.quality).toBe("stale");
    expect(oldRail.source.quality).toBe("stale");
    const expiredFeed = transitEstimate({
      option: { leave_by_seconds: at(6), arrive_seconds: at(7), total_minutes: 60, legs: [] },
      nowSeconds: at(6),
      nowMs,
      scheduleFetchedAt: nowMs,
      feedExpired: true,
    });
    expect(decideTrip(drive(35), expiredFeed).state).toBe("uncertain");
  });
});

describe("expected-outcome decision", () => {
  it("selects clearly faster driving", () =>
    expect(decideTrip(drive(30), rail(60)).state).toBe("drive"));
  it("selects clearly faster transit", () =>
    expect(decideTrip(drive(55), rail(48)).state).toBe("rail"));
  it("calls overlapping arrival ranges a toss-up", () => {
    expect(decideTrip(drive(42, 40, 48), rail(55)).state).toBe("drive");
  });
  it("does not flip modes for a small ETA fluctuation", () => {
    const item = decideTrip(drive(37, 36, 38), rail(50), "rail", {
      tossUpMinutes: 5,
      switchMarginMinutes: 3,
    });
    expect(item.state).toBe("drive");
    expect(item.differenceMinutes).toBe(13);
    expect(decideTrip(drive(40, 39, 41), rail(60), "rail").state).toBe("drive");
  });
  it("uses an incident and delay only when grounded in a transit win", () => {
    const item = driveEstimate({
      drive: {
        trafficMinutes: 60,
        lowMinutes: 58,
        highMinutes: 62,
        delayMinutes: 22,
        fetchedAt: nowMs,
        trafficBasis: "live",
      },
      access: downtown,
      nowSeconds: at(6),
      nowMs,
      carAvailable: true,
      majorIncident: true,
    });
    const decision = decideTrip(item, rail(48));
    expect(decision.state).toBe("rail");
    expect(decision.primary.kind).toBe("major_incident");
  });
  it("explains a large transit connection wait", () => {
    const transit = rail(65, 0, [
      { mode: "rail", depart_seconds: at(6), arrive_seconds: at(6, 30), minutes: 30 },
      { mode: "bus", depart_seconds: at(6, 42), arrive_seconds: at(7, 5), minutes: 23 },
    ]);
    expect(decideTrip(drive(30), transit).supporting?.kind).toBe("transfer_wait");
  });
  it("does not call an unavailable source slower", () => {
    const brokenRail = transitEstimate({
      option: null,
      nowSeconds: at(6),
      nowMs,
      scheduleFetchedAt: null,
      failed: true,
    });
    expect(decideTrip(drive(35), brokenRail).state).toBe("uncertain");
    expect(decideTrip(drive(35), brokenRail).differenceMinutes).toBeNull();
  });
  it("distinguishes unavailable car, unavailable rail, and both unavailable", () => {
    const noCar = driveEstimate({
      drive: null,
      access: downtown,
      nowSeconds: at(6),
      nowMs,
      carAvailable: false,
    });
    const noService = transitEstimate({
      option: null,
      nowSeconds: at(6),
      nowMs,
      scheduleFetchedAt: nowMs,
    });
    expect(decideTrip(noCar, rail(50)).state).toBe("rail");
    expect(decideTrip(drive(35), noService).state).toBe("drive");
    expect(decideTrip(noCar, noService).state).toBe("none");
  });
  it("downgrades stale traffic rather than claiming a certain winner", () => {
    const item = { ...drive(35), source: { ...drive(35).source, quality: "stale" as const } };
    expect(decideTrip(item, rail(55)).state).toBe("uncertain");
    const noService = { ...rail(50), availability: "service-unavailable" as const };
    expect(decideTrip(item, noService).state).toBe("uncertain");
  });
});

describe("arrival-first decision", () => {
  it("recognizes both feasible options and the leave-later/arrive-earlier tradeoff", () => {
    const driving = {
      ...drive(40),
      leaveTime: at(6, 40),
      arrivalTime: at(7, 26),
      latestArrival: at(7, 30),
    };
    const transit = {
      ...rail(77),
      leaveTime: at(6, 22),
      arrivalTime: at(7, 17),
      latestArrival: at(7, 23),
    };
    const decision = decideArrival(driving, transit, at(7, 30));
    expect(decision.state).toBe("same");
    expect(decision.driveMarginMinutes).toBe(4);
    expect(decision.railMarginMinutes).toBe(13);
  });
  it("handles only drive, only transit, and neither feasible", () => {
    const lateDrive = { ...drive(50), arrivalTime: at(7, 40), latestArrival: at(7, 45) };
    const onTimeDrive = { ...drive(30), arrivalTime: at(7, 20), latestArrival: at(7, 25) };
    const lateRail = { ...rail(90), arrivalTime: at(7, 40), latestArrival: at(7, 45) };
    const onTimeRail = { ...rail(75), arrivalTime: at(7, 15), latestArrival: at(7, 25) };
    expect(decideArrival(onTimeDrive, lateRail, at(7, 30)).state).toBe("drive");
    expect(decideArrival(lateDrive, onTimeRail, at(7, 30)).state).toBe("rail");
    expect(decideArrival(lateDrive, lateRail, at(7, 30)).state).toBe("none");
  });
  it("does not claim a reliable arrival verdict from stale or weak future traffic", () => {
    const driving = { ...drive(40), leaveTime: at(6, 40), arrivalTime: at(7, 26) };
    const transit = { ...rail(77), leaveTime: at(6, 22), arrivalTime: at(7, 17) };
    expect(
      decideArrival(
        { ...driving, source: { ...driving.source, quality: "stale" } },
        transit,
        at(7, 30),
      ).state,
    ).toBe("uncertain");
    expect(
      decideArrival(
        { ...driving, source: { ...driving.source, quality: "limited" } },
        transit,
        at(7, 30),
      ).state,
    ).toBe("uncertain");
  });
});
