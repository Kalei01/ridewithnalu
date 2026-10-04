import { describe, expect, it } from "vitest";
import { chooseLeave, leaveMessage, nextCheckDelaySeconds, shouldSend } from "./plan";

const h = (hour: number, minute = 0) => hour * 3600 + minute * 60;
const walk = (minutes: number) => ({ mode: "walk", minutes, depart_seconds: null, arrive_seconds: null });
const bus = (route: string, depart: number, minutes: number) => ({
  mode: "bus",
  minutes,
  route_short: route,
  depart_seconds: depart,
  arrive_seconds: depart + minutes * 60,
});

describe("chooseLeave", () => {
  it("picks driving when it lets you leave later, with parking counted", () => {
    const plan = chooseLeave({
      nowSeconds: h(6, 30),
      targetArriveSeconds: h(8),
      drive: { trafficMinutes: 32, delayMinutes: 0 },
      parkingMinutes: 10,
      transit: [
        { leave_by_seconds: h(6, 50), depart_seconds: h(6, 58), arrive_seconds: h(7, 50), legs: [walk(8), bus("42", h(6, 58), 48), walk(4)] },
      ],
    })!;
    expect(plan.mode).toBe("drive");
    expect(plan.leaveBySeconds).toBe(h(7, 18));
    expect(leaveMessage(plan, "Home", true).title).toBe("Time to head home");
    expect(plan.transitOnTime).toBe(true);
    expect(leaveMessage(plan, "Work").body).toBe(
      "Leave by 7:18 AM to get there by 8:00 AM. Driving is faster today: about 32 min plus parking.",
    );
  });

  it("picks the bus when it lets you leave later than driving", () => {
    const plan = chooseLeave({
      nowSeconds: h(6, 30),
      targetArriveSeconds: h(8),
      drive: { trafficMinutes: 70, delayMinutes: 25 },
      parkingMinutes: 10,
      transit: [
        { leave_by_seconds: h(6, 52), depart_seconds: h(7), arrive_seconds: h(7, 52), legs: [walk(8), bus("E", h(7), 48), walk(4)] },
        { leave_by_seconds: h(7, 12), depart_seconds: h(7, 20), arrive_seconds: h(8, 10), legs: [walk(8), bus("E", h(7, 20), 46), walk(4)] },
      ],
    })!;
    expect(plan.mode).toBe("transit");
    expect(plan.leaveBySeconds).toBe(h(6, 52));
    expect(leaveMessage(plan, "Work").body).toBe(
      "Leave by 6:52 AM for Bus E at 7:00 AM. You'll get there around 7:52 AM.",
    );
  });

  it("says plainly when no transit makes it", () => {
    const plan = chooseLeave({
      nowSeconds: h(7),
      targetArriveSeconds: h(8),
      drive: { trafficMinutes: 30, delayMinutes: 12 },
      parkingMinutes: 4,
      transit: [],
    })!;
    expect(leaveMessage(plan, "Work").body).toBe(
      "Leave by 7:26 AM to get there by 8:00 AM. No bus or train makes it in time, so drive: about 30 min plus parking. Traffic is heavier than usual.",
    );
  });

  it("switches to 'leave now' when the leave time has passed", () => {
    const plan = chooseLeave({
      nowSeconds: h(7, 40),
      targetArriveSeconds: h(8),
      drive: { trafficMinutes: 30, delayMinutes: 0 },
      parkingMinutes: 4,
      transit: [],
    })!;
    expect(plan.late).toBe(true);
    expect(leaveMessage(plan, "Work")).toEqual({
      title: "Leave now for Work",
      body: "Driving gets you there around 8:14 AM.",
    });
    expect(leaveMessage(plan, "Home", true).title).toBe("Leave now to get home");
  });

  it("ignores transit trips you can no longer catch", () => {
    const plan = chooseLeave({
      nowSeconds: h(7),
      targetArriveSeconds: h(8),
      drive: { trafficMinutes: 30, delayMinutes: 0 },
      parkingMinutes: 1,
      transit: [{ leave_by_seconds: h(6, 50), depart_seconds: h(6, 58), arrive_seconds: h(7, 40), legs: [walk(8), bus("42", h(6, 58), 40)] }],
    })!;
    expect(plan.mode).toBe("drive");
    expect(plan.transitOnTime).toBe(false);
  });
});

describe("timing", () => {
  const plan = chooseLeave({
    nowSeconds: h(6),
    targetArriveSeconds: h(8),
    drive: { trafficMinutes: 30, delayMinutes: 0 },
    parkingMinutes: 0,
    transit: [],
  })!;
  it("sends only within ten minutes of the leave time", () => {
    expect(shouldSend(plan, h(7, 10))).toBe(false);
    expect(shouldSend(plan, h(7, 21))).toBe(true);
  });
  it("checks more often as the leave time gets close", () => {
    expect(nextCheckDelaySeconds(plan, h(6))).toBe(20 * 60);
    expect(nextCheckDelaySeconds(plan, h(7, 12))).toBe(5 * 60);
  });
});
