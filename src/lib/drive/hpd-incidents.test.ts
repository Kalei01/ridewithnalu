import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  probeHpd,
  hpdIncidentsForRoute,
  hpdPlaceText,
  hpdQueryUrl,
  hpdNearRoute,
  hpdPoint,
  hpdTimestamp,
  parseHpdRows,
  resetHpd,
  roadNeedle,
} from "./hpd-incidents";
import { resetTomtomGuard } from "./tomtom-guard";
import { planIncidentAlerts, newIncidentAlertMemory } from "../incident-alerts";

// Fixture written from the documented Socrata shape (Date, Time, Type, Address, Location, Area); not captured live.
// 2026-10-21 13:45 HST = 23:45 UTC.
const NOW = Date.UTC(2026, 9, 21, 23, 55);
const route = [
  { lat: 21.3, lon: -157.95 },
  { lat: 21.3, lon: -157.9 },
  { lat: 21.3, lon: -157.85 },
];
const rows = [
  {
    date: "2026-10-21T00:00:00.000",
    time: "13:45",
    type: "TRAFFIC COLLISION",
    address: "H1 FWY EB / MOANALUA",
    area: "Central",
    location: { latitude: "21.3005", longitude: "-157.9", human_address: "{}" },
  },
  {
    date: "2026-10-21T00:00:00.000",
    time: "1:30 PM",
    type: "STALLED VEHICLE",
    address: "KAMEHAMEHA HWY / KAIAHUA ST",
    area: "Central",
  },
  {
    date: "2026-10-21T00:00:00.000",
    time: "11:00",
    type: "TRAFFIC COLLISION",
    address: "H1 FWY WB",
    area: "Central",
    location: { latitude: "21.3", longitude: "-157.9" },
  },
  {
    date: "2026-10-21T00:00:00.000",
    time: "13:50",
    type: "TRAFFIC COLLISION",
    address: "FARRINGTON HWY / HAKIMO RD",
    area: "Leeward",
    location: { latitude: "21.4", longitude: "-158.1" },
  },
  {
    date: "2026-10-21T00:00:00.000",
    time: "13:50",
    type: "TRAFFIC STOP",
    address: "H1 FWY",
    area: "Central",
  },
  { date: "2026-10-21T00:00:00.000", type: "TRAFFIC COLLISION", address: "H1 FWY" },
];

beforeEach(() => {
  resetTomtomGuard();
  resetHpd();
});

describe("reading HPD rows", () => {
  it("parses time (24 h and AM/PM) in Hawaii time", () => {
    expect(hpdTimestamp("2026-10-21T00:00:00.000", "13:45")).toBe(Date.UTC(2026, 9, 21, 23, 45));
    expect(hpdTimestamp("2026-10-21T00:00:00.000", "1:45 PM")).toBe(Date.UTC(2026, 9, 21, 23, 45));
    expect(hpdTimestamp("2026-10-21T00:00:00.000", "12:05 AM")).toBe(Date.UTC(2026, 9, 21, 10, 5));
    expect(hpdTimestamp("2026-10-21T00:00:00.000", null)).toBeNull();
  });
  it("accepts the usual Location shapes and rejects places outside Hawaiʻi", () => {
    expect(hpdPoint({ latitude: "21.3", longitude: "-157.9" })).toEqual({ lat: 21.3, lon: -157.9 });
    expect(hpdPoint({ type: "Point", coordinates: [-157.9, 21.3] })).toEqual({
      lat: 21.3,
      lon: -157.9,
    });
    expect(hpdPoint("POINT (-157.9 21.3)")).toEqual({ lat: 21.3, lon: -157.9 });
    expect(hpdPoint("(21.3, -157.9)")).toEqual({ lat: 21.3, lon: -157.9 });
    expect(hpdPoint({ latitude: "40", longitude: "-100" })).toBeNull();
    expect(hpdPoint(undefined)).toBeNull();
  });
  it("keeps collisions, closures, stalled vehicles and hazards; drops stops and rows without a time", () => {
    const parsed = parseHpdRows(rows);
    expect(parsed.map((r) => r.label)).toEqual([
      "Collision",
      "Stalled vehicle",
      "Collision",
      "Collision",
    ]);
    expect(parseHpdRows({ not: "an array" })).toEqual([]);
  });
});

describe("matching to a route", () => {
  const reports = parseHpdRows(rows);
  it("uses coordinates when present, only the last 90 minutes, and never attaches a delay", () => {
    const found = hpdIncidentsForRoute(reports, { path: route, roads: [] }, NOW);
    expect(found).toHaveLength(1); // the 11:00 report is too old, the Farrington one is off the route
    expect(found[0]).toMatchObject({
      category: "1",
      source: "hpd",
      onRoute: true,
      delayMinutes: null,
      description: "Police report: Collision on H-1 eastbound near Moanalua, 1:45 PM",
    });
  });
  it("without coordinates, shows a report only when the route passes the named place (road and cross street)", () => {
    const both = hpdIncidentsForRoute(
      reports,
      { path: [], roads: ["Kamehameha Hwy", "Kaiahua St"] },
      NOW,
    );
    expect(both.map((f) => f.description)).toEqual([
      "Police report: Stalled vehicle near Kamehameha Highway at Kaiahua Street, 1:30 PM",
    ]);
    expect(both[0]?.onRoute).toBe(false);
    expect(both[0]?.road).toBe("Kamehameha Hwy");
    // One road alone could be anywhere along it: not shown.
    expect(hpdIncidentsForRoute(reports, { path: [], roads: ["Kamehameha Hwy"] }, NOW)).toEqual([]);
  });
  it("writes places in local style with the ʻokina", () => {
    expect(hpdPlaceText("Collision", "H1 FWY WB / KAPIOLANI BLVD")).toBe(
      "Collision on H-1 westbound near Kapiʻolani Boulevard",
    );
    expect(hpdPlaceText("Collision", "KALANIANAOLE HWY")).toBe(
      "Collision near Kalanianaʻole Highway",
    );
  });
  it("asks for newest first and only recent rows", () => {
    const url = decodeURIComponent(hpdQueryUrl(NOW)).replace(/\+/g, " ");
    expect(url).toContain("$order=date DESC");
    expect(url).toContain("$where=date >= '2026-10-20T00:00:00'");
  });
  it("freeway needles match H1 / H-1 / I-H1 but not H-10", () => {
    const needle = roadNeedle("H-1 East")!;
    expect(needle.test("H1 FWY EB")).toBe(true);
    expect(needle.test("I-H1 / PUNCHBOWL")).toBe(true);
    expect(needle.test("H-10 EXIT")).toBe(false);
    expect(roadNeedle("Main")).toBeNull();
  });
});

describe("feed and alerts", () => {
  it("caches the feed for 5 minutes and degrades to unchecked when it fails", async () => {
    const ok = vi.fn(async () => new Response(JSON.stringify(rows), { status: 200 }));
    const first = await hpdNearRoute(
      { path: route, roads: [] },
      ok as unknown as typeof fetch,
      NOW,
    );
    await hpdNearRoute({ path: route, roads: [] }, ok as unknown as typeof fetch, NOW + 60_000);
    expect(first.checked).toBe(true);
    expect(ok).toHaveBeenCalledTimes(1);
    resetTomtomGuard();
    resetHpd();
    const blocked = vi.fn(async () => new Response("no", { status: 403 }));
    expect(
      await hpdNearRoute({ path: route, roads: [] }, blocked as unknown as typeof fetch, NOW),
    ).toEqual({ incidents: [], checked: false });
    await hpdNearRoute({ path: route, roads: [] }, blocked as unknown as typeof fetch, NOW + 1000);
    expect(blocked).toHaveBeenCalledTimes(2); // query + plain once, then backs off for 2 minutes
  });
  it("never claims coverage when the feed is empty or stale", async () => {
    const stale = [
      {
        date: "2026-10-20T00:00:00.000",
        time: "01:00",
        type: "TRAFFIC COLLISION",
        address: "H1 FWY",
      },
    ];
    for (const body of [[], stale]) {
      resetTomtomGuard();
      resetHpd();
      const fetcher = vi.fn(async () => new Response(JSON.stringify(body), { status: 200 }));
      expect(
        (await hpdNearRoute({ path: route, roads: [] }, fetcher as unknown as typeof fetch, NOW))
          .checked,
      ).toBe(false);
    }
  });
  it("retries with the plain URL when the portal rejects the query", async () => {
    const fetcher = vi.fn(async (url: string) =>
      url.includes("order")
        ? new Response("bad column", { status: 400 })
        : new Response(JSON.stringify(rows), { status: 200 }),
    );
    expect(
      (await hpdNearRoute({ path: route, roads: [] }, fetcher as unknown as typeof fetch, NOW))
        .checked,
    ).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("is display-only: never spoken, never on the HUD, never a push", () => {
    const [incident] = hpdIncidentsForRoute(parseHpdRows(rows), { path: route, roads: [] }, NOW);
    expect(incident).toBeDefined();
    const plan = planIncidentAlerts(
      { incidents: [incident as never], nearby: [incident as never], path: route },
      newIncidentAlertMemory(),
    );
    expect(plan.speak).toEqual([]);
    expect(plan.hud).toBeNull();
  });
});

describe("probeHpd", () => {
  const now = Date.UTC(2026, 9, 21, 20, 0); // 10:00 HST
  const json = (status: number, body: unknown) =>
    new Response(typeof body === "string" ? body : JSON.stringify(body), { status });

  it("reports status, rows, newest age and field names", async () => {
    const fetcher = (async () =>
      json(200, [
        {
          date: "2026-10-21T00:00:00.000",
          time: "09:30",
          type: "TRAFFIC",
          address: "H1",
          area: "x",
        },
      ])) as unknown as typeof fetch;
    const probe = await probeHpd(fetcher, now);
    expect(probe.ok).toBe(true);
    expect(probe.detail).toMatch(/HTTP 200/);
    expect(probe.detail).toMatch(/1 rows, 1 with a readable date\+time/);
    expect(probe.detail).toMatch(/newest 30 min old/);
    expect(probe.detail).toMatch(/fields: date,time,type,address,area/);
  });

  it("explains a rejected feed and tries the plain URL", async () => {
    const urls: string[] = [];
    const fetcher = (async (url: string) => {
      urls.push(url);
      return json(403, "Forbidden");
    }) as unknown as typeof fetch;
    const probe = await probeHpd(fetcher, now);
    expect(probe.ok).toBe(false);
    expect(urls).toHaveLength(2);
    expect(probe.detail).toMatch(/query: HTTP 403.*plain: HTTP 403/);
  });

  it("flags rows whose date or time cannot be read", async () => {
    const fetcher = (async () =>
      json(200, [{ incident_date: "2026-10-21", type: "X" }])) as unknown as typeof fetch;
    const probe = await probeHpd(fetcher, now);
    expect(probe.ok).toBe(false);
    expect(probe.detail).toMatch(/0 with a readable date\+time/);
    expect(probe.detail).toMatch(/newest none readable/);
  });

  it("falls back to the plain URL when the filtered query returns an empty array", async () => {
    const urls: string[] = [];
    const fetcher = (async (url: string) => {
      urls.push(url);
      return url.includes("where")
        ? json(200, [])
        : json(200, [
            { date: "10/21/2026", time: "09:30", type: "TRAFFIC COLLISION", address: "H1 FWY" },
          ]);
    }) as unknown as typeof fetch;
    const probe = await probeHpd(fetcher, now);
    expect(urls).toHaveLength(2);
    expect(probe.ok).toBe(true);
    expect(probe.detail).toMatch(/query: HTTP 200.*query: 0 rows.*plain: HTTP 200.*used plain/);
    expect(probe.detail).toMatch(/1 with a readable date\+time/);
    expect(probe.detail).toMatch(/date\/time samples "10\/21\/2026" "09:30"/);
    expect(probe.detail).toMatch(/fields: date,time,type,address/);
  });

  it("names an HTML body as a likely bot challenge", async () => {
    const fetcher = (async () =>
      new Response("<!DOCTYPE html><html>Just a moment...</html>", {
        status: 200,
        headers: { "content-type": "text/html" },
      })) as unknown as typeof fetch;
    const probe = await probeHpd(fetcher, now);
    expect(probe.ok).toBe(false);
    expect(probe.detail).toMatch(/non-JSON response \(likely a bot challenge\)/);
  });

  it("reads text dates like 10/21/2026 with 07:45 in Hawaii time", () => {
    expect(hpdTimestamp("10/21/2026", "07:45")).toBe(Date.UTC(2026, 9, 21, 17, 45));
    expect(hpdTimestamp("10/21/2026 12:00:00 AM", "07:45")).toBe(Date.UTC(2026, 9, 21, 17, 45));
    expect(hpdTimestamp("13/40/2026", "07:45")).toBeNull();
  });
});
