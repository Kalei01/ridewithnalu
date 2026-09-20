import { describe, expect, it } from "vitest";

import { evaluateApproach, parseAlertPrefs, type ApproachStop } from "./approach";

// A straight west-to-east chain of five stops roughly 900 m apart, arriving
// every 3 minutes, with the fourth stop as the alight point.
const stops: ApproachStop[] = [
  { stopName: "Stop A", lat: 21.30, lon: -157.90, arriveSeconds: 28800, isAlight: false },
  { stopName: "Stop B", lat: 21.30, lon: -157.89, arriveSeconds: 28980, isAlight: false },
  { stopName: "Stop C", lat: 21.30, lon: -157.88, arriveSeconds: 29160, isAlight: false },
  { stopName: "Stop D", lat: 21.30, lon: -157.87, arriveSeconds: 29340, isAlight: true },
  { stopName: "Stop E", lat: 21.30, lon: -157.86, arriveSeconds: 29520, isAlight: false },
];

describe("evaluateApproach", () => {
  it("returns null without a usable stop sequence", () => {
    expect(evaluateApproach({ stops: [], nowSeconds: 28800, rider: null })).toBeNull();
  });

  it("raises the pull-cord alert one stop away", () => {
    const result = evaluateApproach({
      stops,
      nowSeconds: 29200,
      rider: { lat: 21.30, lon: -157.88 },
    });
    expect(result?.state).toBe("urgent");
    expect(result?.stopsAway).toBe(1);
    expect(result?.alightName).toBe("Stop D");
    expect(result?.live).toBe(true);
  });

  it("raises the get-ready alert two stops away", () => {
    const result = evaluateApproach({
      stops,
      nowSeconds: 29000,
      rider: { lat: 21.30, lon: -157.89 },
    });
    expect(result?.state).toBe("ready");
    expect(result?.stopsAway).toBe(2);
    expect(result?.nextStopName).toBe("Stop C");
  });

  it("stays calm early in the ride", () => {
    const result = evaluateApproach({
      stops,
      nowSeconds: 28800,
      rider: { lat: 21.30, lon: -157.90 },
    });
    expect(result?.state).toBe("cruising");
    expect(result?.stopsAway).toBe(3);
  });

  it("falls back to the timetable when GPS drifts far away", () => {
    const drifting = evaluateApproach({
      stops,
      nowSeconds: 29200,
      // A wild fix hundreds of km off: ignore it, do not flicker off-route.
      rider: { lat: 25.0, lon: -150.0 },
    });
    expect(drifting?.live).toBe(false);
    expect(drifting?.state).toBe("urgent");
    expect(drifting?.stopsAway).toBe(1);
  });

  it("works with no GPS at all, from the schedule only", () => {
    const result = evaluateApproach({ stops, nowSeconds: 29000, rider: null });
    expect(result?.live).toBe(false);
    expect(result?.state).toBe("ready");
    expect(result?.metersToAlight).toBeNull();
  });

  it("reports a missed stop when the rider is moving away past the alight stop", () => {
    const result = evaluateApproach({
      stops,
      nowSeconds: 29460,
      rider: { lat: 21.30, lon: -157.862 },
      distanceTrend: [200, 500, 850],
      previousState: "urgent",
    });
    expect(result?.state).toBe("passed");
  });

  it("reports a missed stop from the schedule when the ride ran long", () => {
    const result = evaluateApproach({ stops, nowSeconds: 29700, rider: null });
    expect(result?.state).toBe("passed");
  });

  it("mutes alerts when the rider is off the planned corridor", () => {
    const result = evaluateApproach({
      stops,
      nowSeconds: 29200,
      // ~2 km north of every planned stop.
      rider: { lat: 21.32, lon: -157.88 },
      previousState: "ready",
    });
    expect(result?.state).toBe("off-route");
  });

  it("never steps the pull-cord alert back down", () => {
    const result = evaluateApproach({
      stops,
      nowSeconds: 29000,
      rider: { lat: 21.30, lon: -157.89 },
      previousState: "urgent",
    });
    expect(result?.state).toBe("urgent");
  });
});

describe("parseAlertPrefs", () => {
  it("defaults to haptics on and sound off", () => {
    expect(parseAlertPrefs(null)).toEqual({ sound: false, haptics: true, keepOnTransfer: false });
  });

  it("keeps stored values and fills gaps", () => {
    expect(parseAlertPrefs(JSON.stringify({ sound: true }))).toEqual({
      sound: true,
      haptics: true,
      keepOnTransfer: false,
    });
  });

  it("survives corrupt storage", () => {
    expect(parseAlertPrefs("{oops")).toEqual({ sound: false, haptics: true, keepOnTransfer: false });
  });
});
