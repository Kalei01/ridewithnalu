import { describe, expect, it } from "vitest";
import { buildManeuvers } from "./drive.functions";

const path = [
  { lat: 21.3, lon: -157.86 },
  { lat: 21.301, lon: -157.86 },
  { lat: 21.302, lon: -157.86 },
];

describe("buildManeuvers", () => {
  it("reads turns in the classic, lat/lon and GeoJSON formats", () => {
    const turns = buildManeuvers(
      [
        { maneuver: "DEPART", maneuverPoint: { latitude: 21.3, longitude: -157.86 } },
        { maneuver: "TURN_RIGHT", maneuverPoint: { latitude: 21.301, longitude: -157.86 }, instructionMessage: "Turn right onto Kapiolani Blvd" },
        { maneuver: "turnLeft", maneuverPoint: { type: "Point", coordinates: [-157.85, 21.31] } } as never,
        { maneuver: "ARRIVE", maneuverPoint: { lat: 21.302, lon: -157.86 } } as never,
      ],
      path,
    );
    expect(turns.map((t) => t.maneuver)).toEqual(["TURN_RIGHT", "TURN_LEFT", "ARRIVE"]);
    expect(turns[1]).toMatchObject({ lat: 21.31, lon: -157.85, instruction: "Turn left" });
  });
  it("places a turn by its distance along the route when no point is given", () => {
    const [turn] = buildManeuvers(
      [{ maneuver: "TURN_RIGHT", routeOffsetInMeters: 150, nextRoadInformation: { streetName: { text: "Ward Ave" } } } as never],
      path,
    );
    expect(turn).toMatchObject({ lat: 21.302, instruction: "Turn right onto Ward Ave" });
  });
});
