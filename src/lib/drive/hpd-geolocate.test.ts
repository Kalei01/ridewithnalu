import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  FREEWAYS,
  GAZETTEER_STATS,
  identifyFreeway,
  parseHeading,
  placeOnFreeway,
} from "./hpd-freeways";
import {
  addressCacheKey,
  hpdGeoCacheSize,
  placeHpdAddress,
  placeHpdBatch,
  resetHpdGeo,
  type GeoDeps,
} from "./hpd-geolocate";
import { hpdIncidentsForRoute, hpdPins, parseHpdRows, type HpdReport } from "./hpd-incidents";
import { hpdInYourWay, newIncidentAlertMemory, planIncidentAlerts } from "../incident-alerts";
import { probeHpd } from "./hpd-incidents";
import { resetTomtomGuard, usageSnapshot } from "./tomtom-guard";
import type { DriveIncident } from "../drive.functions";

const NOW = Date.UTC(2026, 9, 21, 23, 55); // 1:55 PM HST
const iso = (minAgo: number) => new Date(NOW - minAgo * 60_000).toISOString();

const crossStreetBody = {
  results: [{ type: "Cross Street", position: { lat: 21.3189, lon: -157.8782 } }],
};
const streetBody = { results: [{ type: "Street", position: { lat: 21.32, lon: -157.88 } }] };

function deps(fetcher: unknown, over: Partial<GeoDeps> = {}): GeoDeps {
  return {
    fetcher: fetcher as typeof fetch,
    tomtomKey: "test-key",
    mapboxToken: "",
    now: NOW,
    ...over,
  };
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

beforeEach(() => {
  resetTomtomGuard();
  resetHpdGeo();
});

describe("freeway gazetteer", () => {
  it("is a real table with the freeways Honolulu police report on", () => {
    expect(GAZETTEER_STATS.nodes).toBeGreaterThanOrEqual(40);
    expect(FREEWAYS.map((f) => f.id)).toEqual(
      expect.arrayContaining(["H1", "H2", "H3", "H201", "LIKELIKE", "PALI", "NIMITZ"]),
    );
  });
  it("reads the direction from the address", () => {
    expect(parseHeading("H-1 FWY EB / MOANALUA")).toBe("EB");
    expect(parseHeading("H1 FWY WB")).toBe("WB");
    expect(parseHeading("H2 NORTHBOUND / WAIPIO")).toBe("NB");
    expect(parseHeading("KAMEHAMEHA HWY / KAIAHUA ST")).toBeNull();
  });
  it("tells freeways from streets (H-201 is not H-2; Moanalua Fwy is not Moanalua Rd)", () => {
    expect(identifyFreeway("H-1 FWY EB")).toBe("H1");
    expect(identifyFreeway("I-H201")).toBe("H201");
    expect(identifyFreeway("MOANALUA FWY WB")).toBe("H201");
    expect(identifyFreeway("H2 FWY")).toBe("H2");
    expect(identifyFreeway("MOANALUA RD")).toBeNull();
    expect(identifyFreeway("KAIAHUA ST")).toBeNull();
  });
  it("places an exit on the carriageway of its direction, keeping EB and WB apart", () => {
    const eb = placeOnFreeway("H-1 FWY EB / MOANALUA")!;
    const wb = placeOnFreeway("H-1 FWY WB / MOANALUA")!;
    expect(eb).toMatchObject({ freeway: "H1", heading: "EB", match: "exit", node: "moanalua" });
    expect(wb.heading).toBe("WB");
    // Same exit, opposite carriageways: the eastbound side is the south side (driver's right).
    expect(eb.point.lat).toBeLessThan(wb.point.lat);
    const same = (a: number, b: number) => Math.abs(a - b) < 0.0005;
    expect(same(eb.point.lon, wb.point.lon)).toBe(true);
  });
  it("matches exit names loosely (suffixes, 'exit', ramps) and an unknown exit is only 'line'", () => {
    expect(placeOnFreeway("H1 FWY EB / AIEA EXIT")?.node).toBe("waimalu");
    expect(placeOnFreeway("H1 FWY EB / KUNIA RD ON-RAMP")?.node).toBe("kunia");
    expect(placeOnFreeway("H1 FWY WB / SOMEWHERE")?.match).toBe("line");
    expect(placeOnFreeway("KAMEHAMEHA HWY / KAIAHUA ST")).toBeNull();
    // An ordinary road named Pali Hwy at a street we have no node for is the geocoder's job.
    expect(placeOnFreeway("PALI HWY / NUUANU AVE")).not.toBeNull();
    expect(placeOnFreeway("NIMITZ HWY / SOMEWHERE ELSE")).toBeNull();
  });
});

describe("placing a report", () => {
  it("freeway + exit: exact, no network", async () => {
    const fetcher = vi.fn();
    const out = await placeHpdAddress("H1 FWY EB / MOANALUA", "Central", deps(fetcher));
    expect(out.geo).toMatchObject({
      confidence: "exact",
      how: "freeway-exit",
      direction: "EB",
      freeway: "H1",
    });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("freeway with no known exit: approximate, near the area, never exact", async () => {
    const out = await placeHpdAddress("H1 FWY WB", "Kapolei", deps(vi.fn()));
    expect(out.geo).toMatchObject({
      confidence: "approximate",
      how: "freeway-area",
      direction: "WB",
    });
    expect(out.geo!.radiusM).toBeGreaterThan(1000);
    expect((await placeHpdAddress("H1 FWY WB", null, deps(vi.fn()))).geo).toBeNull();
  });
  it("street intersection: TomTom cross-street geocode, exact", async () => {
    const fetcher = vi.fn(async () => json(crossStreetBody));
    const out = await placeHpdAddress("KAMEHAMEHA HWY / KAIAHUA ST", "Central", deps(fetcher));
    expect(out.geo).toMatchObject({
      confidence: "exact",
      how: "intersection",
      provider: "tomtom",
      point: { lat: 21.3189, lon: -157.8782 },
    });
    const url = decodeURIComponent((fetcher.mock.calls[0] as unknown as [string])[0]);
    expect(url).toContain(
      "/search/2/geocode/Kamehameha HWY & KAIAHUA ST".replace("Kamehameha HWY", "KAMEHAMEHA HWY"),
    );
    expect(url).toContain("idxSet=Xstr");
    expect(url).toContain("topLeft=21.75,-158.35");
    expect(usageSnapshot(NOW).tomtomGeocoding.used).toBe(1);
  });
  it("a plain street answer (no cross street found) is only approximate", async () => {
    const fetcher = vi.fn(async () => json(streetBody));
    const out = await placeHpdAddress("FOO ST / BAR ST", null, deps(fetcher));
    expect(out.geo).toMatchObject({ confidence: "approximate", how: "street" });
  });
  it("a block address with a point-address answer is exact", async () => {
    const fetcher = vi.fn(async () =>
      json({ results: [{ type: "Point Address", position: { lat: 21.2851, lon: -157.8372 } }] }),
    );
    const out = await placeHpdAddress("1600 KAPIOLANI BLVD", null, deps(fetcher));
    expect(out.geo).toMatchObject({ confidence: "exact", how: "address" });
  });
  it("ignores answers outside Oʻahu", async () => {
    const fetcher = vi.fn(async () =>
      json({ results: [{ type: "Cross Street", position: { lat: 40, lon: -100 } }] }),
    );
    const out = await placeHpdAddress("MAIN ST / OAK ST", null, deps(fetcher));
    expect(out.geo).toBeNull();
  });
  it("caches per normalized address: direction, case and spelling do not cause a second call", async () => {
    const fetcher = vi.fn(async () => json(crossStreetBody));
    await placeHpdAddress("KAMEHAMEHA HWY / KAIAHUA ST", null, deps(fetcher));
    await placeHpdAddress(
      "Kamehameha Highway EB / Kaiahua Street",
      null,
      deps(fetcher, { now: NOW + 2 * 24 * 3600_000 }),
    );
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(hpdGeoCacheSize()).toBe(1);
    expect(addressCacheKey("Kamehameha Highway EB / Kaiahua Street")).toBe(
      addressCacheKey("KAMEHAMEHA HWY / KAIAHUA ST"),
    );
    // Past three days it is asked again.
    await placeHpdAddress(
      "KAMEHAMEHA HWY / KAIAHUA ST",
      null,
      deps(fetcher, { now: NOW + 4 * 24 * 3600_000 }),
    );
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("shares one lookup between identical reports in a batch and caps new lookups", async () => {
    const fetcher = vi.fn(async () => json(crossStreetBody));
    const same = [0, 1, 2].map(() => ({ address: "A ST / B ST", area: null, point: null }));
    const batch = await placeHpdBatch(same, deps(fetcher));
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(batch.stats).toEqual({ total: 3, placed: 3, exact: 3, approximate: 0 });

    resetHpdGeo();
    fetcher.mockClear();
    const many = Array.from({ length: 40 }, (_, i) => ({
      address: `STREET${i} ST / OTHER${i} ST`,
      area: "Waikiki",
      point: null,
    }));
    const capped = await placeHpdBatch(many, deps(fetcher));
    expect(fetcher).toHaveBeenCalledTimes(25);
    // Reports past the cap still get an area pin (approximate), never nothing and never exact.
    expect(capped.stats.exact).toBe(25);
    expect(capped.stats.approximate).toBe(15);
  });
  it("TomTom unavailable: Mapbox answers once, approximate only, and is never cached", async () => {
    const fetcher = vi.fn(async (url: string) =>
      url.includes("tomtom")
        ? new Response("no", { status: 403 })
        : json({ features: [{ center: [-157.88, 21.32] }] }),
    );
    const out = await placeHpdAddress(
      "A ST / B ST",
      null,
      deps(fetcher, { mapboxToken: "pk.test" }),
    );
    expect(out.geo).toMatchObject({ confidence: "approximate", provider: "mapbox" });
    expect(hpdGeoCacheSize()).toBe(0);
  });
  it("no TomTom key and no Mapbox: falls back to the area centroid, approximate", async () => {
    const out = await placeHpdAddress("A ST / B ST", "Waikiki", deps(vi.fn(), { tomtomKey: "" }));
    expect(out.geo).toMatchObject({ confidence: "approximate", how: "area", provider: "area" });
  });
});

// ---- route relevance ------------------------------------------------------------

const eastPath = [
  { lat: 21.358, lon: -157.92 },
  { lat: 21.358, lon: -157.905 },
  { lat: 21.358, lon: -157.89 },
];
const westPath = [...eastPath].reverse();

async function report(
  address: string,
  minAgo = 10,
  type = "TRAFFIC COLLISION",
  area = "Central",
): Promise<HpdReport> {
  const parsed = parseHpdRows([
    {
      date: "2026-10-21T00:00:00.000",
      time: new Date(NOW - minAgo * 60_000 - 10 * 3600_000).toISOString().slice(11, 16),
      type,
      address,
      area,
    },
  ]);
  const [placed] = (await placeHpdBatch(parsed, deps(vi.fn(async () => json(crossStreetBody)))))
    .placed;
  return placed!;
}

function listed(r: HpdReport, path = eastPath, roads = ["H-1 East"]) {
  return hpdIncidentsForRoute([r], { path, roads }, NOW)[0];
}
const asDrive = (h: NonNullable<ReturnType<typeof listed>>): DriveIncident =>
  h as unknown as DriveIncident;

describe("is a police report in your way", () => {
  it("same direction, ahead, recent, exact, on the route: yes", async () => {
    const r = await report("H1 FWY EB / MOANALUA");
    const incident = listed(r)!;
    expect(incident).toMatchObject({
      onRoute: true,
      confidence: "exact",
      direction: "EB",
      onFreeway: true,
    });
    expect(incident.description).toBe(
      "Police report: collision on H-1 eastbound near Moanalua, 1:45 PM",
    );
    expect(hpdInYourWay(asDrive(incident), eastPath, NOW)).toBe(true);
  });
  it("opposite direction: not listed for the route, and never announced", async () => {
    const r = await report("H1 FWY WB / MOANALUA");
    expect(listed(r, eastPath)).toBeUndefined();
    // Even if it were handed straight to the alert check (e.g. a stale list), it is refused.
    const forced = { ...listed(await report("H1 FWY EB / MOANALUA"))!, direction: "WB" as const };
    expect(hpdInYourWay(asDrive(forced), eastPath, NOW)).toBe(false);
    // The same report is in the way of a westbound rider.
    expect(listed(r, westPath)?.onRoute).toBe(true);
  });
  it("a freeway report with no direction is listed but never announced", async () => {
    const r = await report("H1 FWY / MOANALUA");
    const incident = listed(r)!;
    expect(incident.onRoute).toBe(false);
    expect(hpdInYourWay(asDrive({ ...incident, onRoute: true }), eastPath, NOW)).toBe(false);
  });
  it("older than 45 minutes: shown, not announced", async () => {
    const r = await report("H1 FWY EB / MOANALUA", 50);
    const incident = listed(r)!;
    expect(incident).toBeDefined();
    expect(hpdInYourWay(asDrive(incident), eastPath, NOW)).toBe(false);
    expect(
      hpdInYourWay(asDrive(listed(await report("H1 FWY EB / MOANALUA", 40))!), eastPath, NOW),
    ).toBe(true);
  });
  it("more than 120 m from the route line: not announced", async () => {
    const incident = asDrive(listed(await report("H1 FWY EB / MOANALUA"))!);
    const moved = { ...incident, points: [{ lat: 21.3595, lon: -157.905 }] }; // about 165 m north
    expect(hpdInYourWay(moved, eastPath, NOW)).toBe(false);
  });
  it("approximate never notifies, even sitting on the route", async () => {
    const r = await report("H1 FWY EB", 10);
    expect(r.geo?.confidence).toBe("approximate");
    const incident = listed(r)!;
    expect(incident?.onRoute ?? false).toBe(false);
    const onRoute = {
      ...asDrive(listed(await report("H1 FWY EB / MOANALUA"))!),
      confidence: "approximate" as const,
    };
    expect(hpdInYourWay(onRoute, eastPath, NOW)).toBe(false);
  });
  it("a route that does not use the freeway never lists its report", async () => {
    const r = await report("H1 FWY EB / MOANALUA");
    expect(listed(r, eastPath, ["Nimitz Hwy"])).toBeUndefined();
  });
  it("street intersection: exact and in the way when the geocoded point is on the route", async () => {
    const onPath = { results: [{ type: "Cross Street", position: { lat: 21.358, lon: -157.9 } }] };
    const [placed] = (
      await placeHpdBatch(
        parseHpdRows([
          {
            date: "2026-10-21T00:00:00.000",
            time: "13:45",
            type: "TRAFFIC COLLISION",
            address: "KAMEHAMEHA HWY / KAIAHUA ST",
            area: "Central",
          },
        ]),
        deps(vi.fn(async () => json(onPath))),
      )
    ).placed;
    const incident = hpdIncidentsForRoute([placed!], { path: eastPath, roads: [] }, NOW)[0]!;
    expect(incident.onRoute).toBe(true);
    expect(hpdInYourWay(asDrive(incident), eastPath, NOW)).toBe(true);
  });
});

describe("island pins", () => {
  it("expose confidence, radius and direction; only placed, recent reports", async () => {
    const exact = await report("H1 FWY EB / MOANALUA", 10);
    const soft = await report("H1 FWY WB", 20);
    const old = await report("H1 FWY EB / MOANALUA", 200);
    const pins = hpdPins([exact, soft, old], NOW);
    expect(pins.map((p) => p.confidence).sort()).toEqual(["approximate", "exact"]);
    expect(pins.find((p) => p.confidence === "exact")).toMatchObject({
      direction: "EB",
      onFreeway: true,
      category: "1",
    });
    expect(pins.find((p) => p.confidence === "approximate")!.radiusM).toBeGreaterThan(1000);
  });
});

describe("announcing", () => {
  it("speaks an in-your-way report once, shows it on the HUD, and keeps a behind or approximate one silent", async () => {
    const incident = asDrive(listed(await report("H1 FWY EB / MOANALUA"))!);
    const memory = newIncidentAlertMemory();
    const input = {
      incidents: [],
      nearby: [incident],
      path: eastPath,
      rider: { lat: 21.358, lon: -157.915 },
      nowMs: NOW,
    };
    const first = planIncidentAlerts(input, memory);
    expect(first.speak).toHaveLength(1);
    expect(first.speak[0]!.text).toBe(
      "Police report: collision on H-1 eastbound near Moanalua, 1:45 PM.",
    );
    expect(first.hud?.text).toBe(
      "Police report: collision on H-1 eastbound near Moanalua, 1:45 PM",
    );
    expect(planIncidentAlerts(input, memory).speak).toHaveLength(0); // once per id
    // Rider already past it: nothing.
    const past = planIncidentAlerts(
      { ...input, rider: { lat: 21.358, lon: -157.895 } },
      newIncidentAlertMemory(),
    );
    expect(past.speak).toHaveLength(0);
    expect(past.hud).toBeNull();
    // Approximate: nothing.
    const soft = planIncidentAlerts(
      { ...input, nearby: [{ ...incident, confidence: "approximate" }] },
      newIncidentAlertMemory(),
    );
    expect(soft.speak).toHaveLength(0);
    expect(soft.hud).toBeNull();
  });
});

describe("health detail", () => {
  it("adds placed X of Y with the exact / approximate split", async () => {
    const rows = [
      {
        date: "2026-10-21T00:00:00.000",
        time: "13:45",
        type: "TRAFFIC COLLISION",
        address: "H1 FWY EB / MOANALUA",
        area: "Central",
      },
      {
        date: "2026-10-21T00:00:00.000",
        time: "13:40",
        type: "TRAFFIC COLLISION",
        address: "H1 FWY WB",
        area: "Kapolei",
      },
      {
        date: "2026-10-21T00:00:00.000",
        time: "13:30",
        type: "STALLED VEHICLE",
        address: "A ST / B ST",
        area: "",
      },
    ];
    const fetcher = vi.fn(async () => json(rows));
    const probe = await probeHpd(fetcher as unknown as typeof fetch, NOW);
    expect(probe.detail).toContain("placed 2 of 3 (exact 1, approximate 1)");
  });
});
