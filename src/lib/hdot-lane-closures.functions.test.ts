import { describe, expect, it, vi } from "vitest";
import {
  hdotEntryEndDate,
  lookupHdotLaneClosureRoutes,
  parseHdotOahuRoadwork,
} from "./hdot-lane-closures.functions";

describe("lookupHdotLaneClosureRoutes", () => {
  it("returns spatially intersecting HDOT features without changing route data", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          features: [
            {
              attributes: {
                ROUTEID: "H1",
                RouteName: "H-1 Freeway",
                RouteDirn: "E",
              },
              geometry: {
                paths: [
                  [
                    [-158.08, 21.34],
                    [-158.07, 21.35],
                  ],
                ],
              },
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );

    const result = await lookupHdotLaneClosureRoutes({
      routePath: [
        { lat: 21.34, lon: -158.08 },
        { lat: 21.35, lon: -158.07 },
      ],
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.routeName).toBe("H-1 Freeway");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [, request] = fetchMock.mock.calls[0] ?? [];
    expect(request).toMatchObject({ method: "POST" });

    fetchMock.mockRestore();
  });

  it("fails soft when HDOT is unavailable", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network"));

    await expect(
      lookupHdotLaneClosureRoutes({
        routePath: [
          { lat: 21.34, lon: -158.08 },
          { lat: 21.35, lon: -158.07 },
        ],
      }),
    ).resolves.toEqual([]);

    fetchMock.mockRestore();
  });
});

describe("parseHdotOahuRoadwork", () => {
  const oct3 = Date.UTC(2026, 9, 3);
  const page = `<h3>— H-1 Freeway —</h3>
    <p>1) Westbound Kalaeloa to Kunia, closure of two to three lanes from Monday, Sept. 28 through Thursday, Oct. 1, nightly from 8 p.m. to 5 a.m. for paving.</p>
    <p>2) Eastbound full closure of the Punahou Street off-ramp (Exit 23 from the H-1 Freeway) nightly from 8:30 p.m. to 4:30 a.m. for striping.</p>
    <p>4) Eastbound full closure of the Kinau Street off-ramp (Exit 24) from Friday, Oct. 9 at 9 p.m. for repairs.</p>
    <p>3) Eastbound Kapiolani Boulevard, single lane closure from Sunday, Oct. 4 through Friday, Oct. 9 for drainage work.</p>`;

  it("keeps a parenthesised exit number inside its entry", () => {
    const kinau = parseHdotOahuRoadwork(page, oct3).find((item) => /Kinau/.test(item.location));
    expect(kinau?.location).toBe("Eastbound full closure of the Kinau Street off-ramp (Exit 24)");
  });

  it("drops entries whose last date has passed", () => {
    const items = parseHdotOahuRoadwork(page, oct3);
    expect(items.some((item) => /Kalaeloa/.test(item.location))).toBe(false);
    expect(items.some((item) => /Kapiolani/.test(item.location))).toBe(true);
  });

  it("does not cut a location inside parentheses", () => {
    const ramp = parseHdotOahuRoadwork(page, oct3).find((item) => /Punahou/.test(item.location));
    expect(ramp?.location).toBe(
      "Eastbound full closure of the Punahou Street off-ramp (Exit 23 from the H-1 Freeway)",
    );
  });

  it("places a year-less date in the year closest to today", () => {
    expect(hdotEntryEndDate("through Thursday, Oct. 1", oct3)).toBe(Date.UTC(2026, 9, 1));
    expect(hdotEntryEndDate("through Jan. 4", Date.UTC(2026, 11, 20))).toBe(Date.UTC(2027, 0, 4));
    expect(hdotEntryEndDate("nightly until further notice", oct3)).toBeNull();
  });
});

describe("parseHdotOahuRoadwork notes", () => {
  const today = Date.UTC(2026, 9, 4);
  it("skips an ADDED note before the numbered list and strips markers from entries", () => {
    const page =
      "<p>— H-201 Moanalua Freeway —</p><p>ADDED 9/29/26</p>" +
      "<p>1) ADDED 9/29/26: Westbound closure of one to two lanes near Red Hill from 8 p.m. to 5 a.m., Monday, Oct. 5, through Friday, Oct. 9, for paving.</p>";
    const items = parseHdotOahuRoadwork(page, today);
    expect(items).toHaveLength(1);
    expect(items[0]?.location).not.toMatch(/ADDED/);
    expect(items[0]?.location).toMatch(/Westbound|Red Hill/);
  });
});
