import { describe, expect, it } from "vitest";
import { landingView, mayAutoOpenUsualTrip } from "./landing-view";

describe("landing view", () => {
  it("signed-in riders open on Browse, even with a saved trip", () => {
    expect(landingView({ tripConfigured: true, signedIn: true, tripUnderWay: false })).toBe(
      "browse",
    );
  });

  it("a trip under way always reopens", () => {
    expect(landingView({ tripConfigured: true, signedIn: true, tripUnderWay: true })).toBe(
      "commute",
    );
  });

  it("riders who aren't signed in reopen their last trip", () => {
    expect(landingView({ tripConfigured: true, signedIn: false, tripUnderWay: false })).toBe(
      "commute",
    );
  });

  it("with no trip, everyone starts on Browse", () => {
    expect(landingView({ tripConfigured: false, signedIn: false, tripUnderWay: false })).toBe(
      "browse",
    );
    expect(landingView({ tripConfigured: false, signedIn: true, tripUnderWay: false })).toBe(
      "browse",
    );
  });

  it("only riders who aren't signed in get their usual trip opened for them", () => {
    expect(mayAutoOpenUsualTrip({ signedIn: true })).toBe(false);
    expect(mayAutoOpenUsualTrip({ signedIn: false })).toBe(true);
  });
});
