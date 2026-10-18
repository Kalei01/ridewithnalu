import { describe, expect, it } from "vitest";
import { splitSkylineStations } from "./skyline-stations";
import { SKYLINE_STOP_IDS } from "./station-names";

describe("splitSkylineStations", () => {
  it("orders known stations west to east and reports unknown ids", () => {
    const stations = [
      { stopId: SKYLINE_STOP_IDS[2]! },
      { stopId: "99999" },
      { stopId: SKYLINE_STOP_IDS[0]! },
    ];
    const { known, unknown } = splitSkylineStations(stations);
    expect(known.map((s) => s.stopId)).toEqual([SKYLINE_STOP_IDS[0], SKYLINE_STOP_IDS[2]]);
    expect(unknown).toEqual([{ stopId: "99999" }]);
  });
  it("knows all 13 line stations by name", () => {
    expect(new Set(SKYLINE_STOP_IDS).size).toBe(SKYLINE_STOP_IDS.length);
    expect(SKYLINE_STOP_IDS.length).toBe(13);
  });
});
