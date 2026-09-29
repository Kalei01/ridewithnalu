import { describe, expect, it } from "vitest";
import { inboundPlannerCoordinates, resolveTripDirection } from "./trip-direction";

const kapolei = { lat: 21.3358, lon: -158.0798 };
const downtown = { lat: 21.3099, lon: -157.8644 };

describe("trip direction", () => {
  it("selects inbound and preserves origin-to-Home travel for Downtown to Kapolei", () => {
    const trip = resolveTripDirection({ origin: downtown, destination: kapolei,
      savedHome: kapolei, manualInbound: null });
    expect(trip).toMatchObject({ inbound: true, reverseTrip: false,
      arrivingAtSavedHome: true, departingFromSavedHome: false,
      from: downtown, to: kapolei });
    expect(inboundPlannerCoordinates(trip)).toEqual({
      p_dest_lat: downtown.lat, p_dest_lon: downtown.lon,
      p_home_lat: kapolei.lat, p_home_lon: kapolei.lon,
    });
  });

  it("selects inbound for a westward custom destination without claiming it is Home", () => {
    const trip = resolveTripDirection({ origin: downtown, destination: kapolei,
      savedHome: null, manualInbound: null });
    expect(trip).toMatchObject({ inbound: true, reverseTrip: false,
      arrivingAtSavedHome: false, from: downtown, to: kapolei });
  });

  it("recognizes selected Home even when it lies east of the origin", () => {
    const trip = resolveTripDirection({ origin: kapolei, destination: downtown,
      savedHome: downtown, manualInbound: null });
    expect(trip).toMatchObject({ inbound: true, reverseTrip: false,
      arrivingAtSavedHome: true, from: kapolei, to: downtown });
  });

  it("keeps an eastbound departure outbound and honors an explicit override", () => {
    const outbound = resolveTripDirection({ origin: kapolei, destination: downtown,
      savedHome: kapolei, manualInbound: null });
    expect(outbound.inbound).toBe(false);
    expect(outbound.from).toEqual(kapolei);
    const forcedOutbound = resolveTripDirection({ origin: downtown, destination: kapolei,
      savedHome: kapolei, manualInbound: false });
    expect(forcedOutbound.inbound).toBe(false);
    expect(forcedOutbound.from).toEqual(downtown);
    expect(forcedOutbound.departingFromSavedHome).toBe(false);
    const legacyReturn = resolveTripDirection({ origin: kapolei, destination: downtown,
      savedHome: kapolei, manualInbound: true });
    expect(legacyReturn).toMatchObject({ inbound: true, reverseTrip: true,
      arrivingAtSavedHome: true, from: downtown, to: kapolei });
  });
});
