import { describe, expect, it } from "vitest";

import { detectTrafficAlert } from "./commute-alerts";

describe("detectTrafficAlert", () => {
  it("does not announce the initial traffic snapshot", () => {
    expect(detectTrafficAlert(null, { delayMinutes: 8, incidentKeys: ["jam:h1"] })).toBeNull();
  });

  it("detects a delay increase of five minutes", () => {
    expect(detectTrafficAlert(
      { delayMinutes: 2, incidentKeys: [] },
      { delayMinutes: 7, incidentKeys: [] },
    )).toEqual({ kind: "delay", increaseMinutes: 5 });
  });

  it("detects a newly reported incident", () => {
    expect(detectTrafficAlert(
      { delayMinutes: 3, incidentKeys: ["jam:h1"] },
      { delayMinutes: 3, incidentKeys: ["jam:h1", "accident:nimitz"] },
    )).toEqual({ kind: "incident" });
  });

  it("ignores unchanged and small traffic shifts", () => {
    expect(detectTrafficAlert(
      { delayMinutes: 3, incidentKeys: ["jam:h1"] },
      { delayMinutes: 7, incidentKeys: ["jam:h1"] },
    )).toBeNull();
  });
});