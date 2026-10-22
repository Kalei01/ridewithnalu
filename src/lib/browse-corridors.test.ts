import { describe, expect, it } from "vitest";
import { browseCorridors, isOnOahu } from "./browse-corridors";

const KAPOLEI = { lat: 21.3358, lon: -158.0798 };
const KAILUA = { lat: 21.4022, lon: -157.7394 };
const HALEIWA = { lat: 21.5953, lon: -158.1031 };
const WAIKIKI = { lat: 21.2793, lon: -157.8294 };

describe("browseCorridors", () => {
  it("follows the rider: North Shore, Windward and west are not the same road", () => {
    const ids = [KAPOLEI, KAILUA, HALEIWA].map(
      (rider) => browseCorridors({ rider, home: null, work: null })?.[0]?.id,
    );
    expect(new Set(ids).size).toBe(3);
    expect(ids[1]).toBe("kailua-town");
    expect(ids[2]).toBe("northshore-town");
  });

  it("uses the saved Home and Work as the commute when both are set", () => {
    const result = browseCorridors({ rider: KAPOLEI, home: KAILUA, work: HALEIWA });
    expect(result).toHaveLength(1);
    expect(result?.[0]?.area).toBe("Home ↔ Work");
    expect(result?.[0]?.a).toEqual(KAILUA);
  });

  it("ignores a Home and Work that are in the same neighbourhood", () => {
    const near = { lat: KAILUA.lat + 0.005, lon: KAILUA.lon };
    expect(browseCorridors({ rider: KAILUA, home: KAILUA, work: near })?.[0]?.id).toBe(
      "kailua-town",
    );
  });

  it("checks both main roads out of town for a rider in town", () => {
    expect(browseCorridors({ rider: WAIKIKI, home: null, work: null })).toHaveLength(2);
  });

  it("falls back to town both ways with no position, and to nothing off the island", () => {
    expect(browseCorridors({ rider: null, home: null, work: null })).toHaveLength(2);
    expect(
      browseCorridors({ rider: { lat: 37.77, lon: -122.42 }, home: null, work: null }),
    ).toBeNull();
    expect(isOnOahu(KAPOLEI)).toBe(true);
  });
});
