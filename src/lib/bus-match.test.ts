import { describe, expect, it } from "vitest";
import { confirmedLiveBus, scheduledBusMatch } from "./bus-match";

const at = (h: number, m = 0) => (h * 60 + m) * 60;
const planned = { routeShortName: "A", headsign: "Downtown Honolulu", scheduledSeconds: at(7, 30) };

describe("TheBus live matching", () => {
  it("confirms a unique close route, direction, and schedule match", () => {
    expect(
      scheduledBusMatch(
        [planned],
        { routeShortName: "A", headsign: "Downtown Honolulu" },
        at(7, 34),
      ),
    ).toEqual(planned);
    const arrival = {
      ...planned,
      routeShortName: "A",
      headsign: "Downtown Honolulu",
      isLive: true,
    };
    expect(confirmedLiveBus([arrival], "A", "Downtown Honolulu", at(7, 30))).toEqual(arrival);
  });

  it("rejects a later bus on the same route and direction", () => {
    expect(
      scheduledBusMatch(
        [planned],
        { routeShortName: "A", headsign: "Downtown Honolulu" },
        at(7, 48),
      ),
    ).toBeNull();
  });

  it("rejects ambiguous and wrong-direction live matches", () => {
    const first = { ...planned, routeShortName: "A", headsign: "Downtown Honolulu", isLive: true };
    expect(confirmedLiveBus([first, { ...first }], "A", "Downtown Honolulu", at(7, 30))).toBeNull();
    expect(
      confirmedLiveBus([{ ...first, headsign: "Kapolei" }], "A", "Downtown Honolulu", at(7, 30)),
    ).toBeNull();
    expect(
      scheduledBusMatch(
        [planned, { ...planned, scheduledSeconds: at(7, 31) }],
        { routeShortName: "A", headsign: "Downtown Honolulu" },
        at(7, 30),
      ),
    ).toBeNull();
  });
});
