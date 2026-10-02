import { describe, expect, it, vi } from "vitest";
import { lookupHdotLaneClosureRoutes } from "./hdot-lane-closures.functions";

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
