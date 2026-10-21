import { describe, expect, it } from "vitest";
import { buildMapboxUrl, mapboxManeuverCode, parseMapboxRoute } from "./mapbox-directions";

// Fixture written from Mapbox's documented Directions v5 response shape (not captured live).
const line = Array.from({ length: 6 }, (_, i) => [-158 + i * 0.01, 21.33] as [number, number]);
const payload = {
  code: "Ok",
  routes: [
    {
      duration: 1500,
      duration_typical: 1260,
      distance: 31000,
      geometry: { coordinates: line },
      legs: [
        {
          annotation: { congestion: ["low", "moderate", "moderate", "heavy", "severe"] },
          steps: [
            {
              distance: 500,
              name: "Kualakaʻi Parkway",
              maneuver: { location: line[0]!, type: "depart", instruction: "Head east" },
            },
            {
              distance: 30000,
              name: "Queen Liliuokalani Freeway",
              ref: "H-1;I-H1",
              maneuver: {
                location: line[1]!,
                type: "on ramp",
                modifier: "slight right",
                instruction: "Take the ramp on the right",
              },
            },
            {
              distance: 500,
              name: "Punchbowl St",
              maneuver: {
                location: line[4]!,
                type: "turn",
                modifier: "left",
                instruction: "Turn left onto Punchbowl St",
              },
            },
            {
              distance: 0,
              name: "",
              maneuver: { location: line[5]!, type: "arrive", instruction: "You have arrived" },
            },
          ],
        },
      ],
    },
  ],
};

describe("Mapbox Directions parsing", () => {
  it("reads live and typical time, distance, path, congestion runs and steps", () => {
    const route = parseMapboxRoute(payload)!;
    expect(route.liveSeconds).toBe(1500);
    expect(route.typicalSeconds).toBe(1260);
    expect(route.meters).toBe(31000);
    expect(route.path).toHaveLength(6);
    expect(route.path[0]).toEqual({ lat: 21.33, lon: -158 });
    expect(route.congestion).toEqual([
      { start: 1, end: 3, severity: "moderate" },
      { start: 3, end: 5, severity: "heavy" },
    ]);
    expect(route.instructions.map((i) => [i.routeOffsetInMeters, i.maneuver])).toEqual([
      [0, "DEPART"],
      [500, "ENTER_MOTORWAY"],
      [30500, "TURN_LEFT"],
      [31000, "ARRIVE"],
    ]);
    expect(
      route.instructions[1]?.nextRoadInformation.roadShields?.map((s) => s.roadNumber.text),
    ).toEqual(["H-1", "I-H1"]);
  });
  it("has no typical time unless Mapbox sent one", () => {
    const copy = structuredClone(payload) as { routes: Array<{ duration_typical?: number }> };
    delete copy.routes[0]!.duration_typical;
    expect(parseMapboxRoute(copy)!.typicalSeconds).toBeNull();
  });
  it("rejects errors, empty answers and routes without geometry", () => {
    expect(parseMapboxRoute({ code: "NoRoute", routes: [] })).toBeNull();
    expect(parseMapboxRoute({ code: "Ok", routes: [] })).toBeNull();
    expect(parseMapboxRoute(null)).toBeNull();
    expect(
      parseMapboxRoute({ code: "Ok", routes: [{ duration: 100, geometry: { coordinates: [] } }] }),
    ).toBeNull();
  });
  it("ignores congestion that doesn't line up with the geometry", () => {
    const copy = structuredClone(payload);
    copy.routes[0]!.legs[0]!.annotation.congestion = ["heavy"];
    expect(parseMapboxRoute(copy)!.congestion).toEqual([]);
  });
});

describe("Mapbox request and maneuver codes", () => {
  it("asks the driving-traffic profile server-side with lon,lat order and a future departure only", () => {
    const now = Date.UTC(2026, 9, 21, 12, 0, 0);
    const url = buildMapboxUrl(
      {
        fromLat: 21.3358,
        fromLon: -158.0798,
        toLat: 21.3099,
        toLon: -157.8644,
        departureTime: new Date(now + 3600_000).toISOString(),
        bearing: 92.4,
      },
      "pk.x",
      now,
    );
    expect(url).toContain(
      "/directions/v5/mapbox/driving-traffic/-158.0798,21.3358;-157.8644,21.3099?",
    );
    expect(url).toContain("geometries=geojson");
    expect(url).toContain("steps=true");
    expect(url).toContain("depart_at=2026-10-21T13%3A00%3A00Z");
    expect(url).toContain("bearings=92%2C45%3B");
    expect(
      buildMapboxUrl(
        {
          fromLat: 1,
          fromLon: 2,
          toLat: 3,
          toLon: 4,
          departureTime: new Date(now - 1000).toISOString(),
        },
        "t",
        now,
      ),
    ).not.toContain("depart_at");
  });
  it("maps Mapbox maneuvers onto the codes the HUD and voice use", () => {
    expect(mapboxManeuverCode("off ramp", "right")).toBe("MOTORWAY_EXIT_RIGHT");
    expect(mapboxManeuverCode("off ramp", "left")).toBe("MOTORWAY_EXIT_LEFT");
    expect(mapboxManeuverCode("fork", "slight left")).toBe("KEEP_LEFT");
    expect(mapboxManeuverCode("turn", "sharp right")).toBe("SHARP_RIGHT");
    expect(mapboxManeuverCode("turn", "uturn")).toBe("MAKE_UTURN");
    expect(mapboxManeuverCode("roundabout", "right")).toBe("ROUNDABOUT_CROSS");
    expect(mapboxManeuverCode("new name", "straight")).toBe("STRAIGHT");
  });
});
