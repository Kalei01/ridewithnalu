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

  it("does not treat a westward custom destination as inbound", () => {
    const trip = resolveTripDirection({ origin: downtown, destination: kapolei,
      savedHome: null, manualInbound: null });
    expect(trip).toMatchObject({ inbound: false, reverseTrip: false,
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

  const kaneohe = { lat: 21.4181, lon: -157.8036 };
  const haleiwa = { lat: 21.5919, lon: -158.1031 };
  const pearlHarbor = { lat: 21.3649, lon: -157.9496 };
  const pairs: Array<[string, typeof kapolei, typeof kapolei]> = [
    ["town and Kapolei", downtown, kapolei],
    ["Kāneʻohe and Kapolei", kaneohe, kapolei],
    ["Haleʻiwa and Pearl Harbor", haleiwa, pearlHarbor],
  ];

  for (const [name, a, b] of pairs) {
    it(`reads direction from Home only, both ways between ${name}`, () => {
      for (const [home, away] of [[a, b], [b, a]] as const) {
        // Heading to Home is inbound, heading out of Home is not, wherever Home is.
        const toHome = resolveTripDirection({ origin: away, destination: home,
          savedHome: home, manualInbound: null });
        expect(toHome).toMatchObject({ inbound: true, reverseTrip: false, from: away, to: home });
        const fromHome = resolveTripDirection({ origin: home, destination: away,
          savedHome: home, manualInbound: null });
        expect(fromHome).toMatchObject({ inbound: false, reverseTrip: false, from: home, to: away });
        // No saved Home: geography alone never makes a trip inbound.
        const none = resolveTripDirection({ origin: home, destination: away,
          savedHome: null, manualInbound: null });
        expect(none.inbound).toBe(false);
        // The Work -> Home toggle brings the rider back to Home.
        const back = resolveTripDirection({ origin: home, destination: away,
          savedHome: home, manualInbound: true });
        expect(back).toMatchObject({ inbound: true, reverseTrip: true, from: away, to: home });
      }
    });
  }
});
