import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  hpdIncidentsForRoute,
  hpdNearRoute,
  hpdPoint,
  hpdTimestamp,
  parseHpdRows,
  resetHpd,
  roadNeedle,
} from "./hpd-incidents";
import { resetTomtomGuard } from "./tomtom-guard";
import {
  incidentAlertKey,
  incidentHudText,
  incidentSpeech,
  planIncidentAlerts,
  newIncidentAlertMemory,
} from "../incident-alerts";

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
      description: "Reported by HPD: Collision near H-1 Fwy EB / Moanalua, 1:45 PM",
    });
  });
  it("matches by road name in the address when there are no coordinates (listed, never an alert)", () => {
    const found = hpdIncidentsForRoute(reports, { path: [], roads: ["Kamehameha Hwy"] }, NOW);
    expect(found.map((f) => f.description)).toEqual([
      "Reported by HPD: Stalled vehicle near Kamehameha Hwy / Kaiahua St, 1:30 PM",
    ]);
    expect(found[0]?.onRoute).toBe(false);
    expect(found[0]?.road).toBe("Kamehameha Hwy");
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
    expect(blocked).toHaveBeenCalledTimes(1); // backs off for 2 minutes
  });
  it("feeds the in-drive accident alert with honest wording and no delay", () => {
    const [incident] = hpdIncidentsForRoute(parseHpdRows(rows), { path: route, roads: [] }, NOW);
    expect(incidentHudText(incident as never)).toBe("Accident near H-1 Fwy EB / Moanalua (HPD)");
    expect(incidentSpeech(incident as never)).toBe(
      "Police report accident near H-1 Fwy EB / Moanalua.",
    );
    expect(incidentAlertKey(incident as never)).toContain("hpd:");
    const plan = planIncidentAlerts(
      { incidents: [], nearby: [incident as never], path: route },
      newIncidentAlertMemory(),
    );
    expect(plan.speak).toHaveLength(1);
    expect(plan.hud?.text).toContain("(HPD)");
  });
});
