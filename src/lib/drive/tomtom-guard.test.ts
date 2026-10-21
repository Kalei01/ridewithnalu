import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  BREAKER_FORBIDDEN_MS,
  BREAKER_TRANSIENT_MS,
  OAHU_INCIDENT_BOX,
  breakerState,
  countCall,
  incidentBoxFor,
  incidentMaxAgeMs,
  noteTomtomOutcome,
  quotaSpent,
  readTypical,
  rememberTypical,
  resetTomtomGuard,
  sharedIncidents,
  tomtomAvailable,
  typicalKey,
  usageSnapshot,
} from "./tomtom-guard";

beforeEach(() => resetTomtomGuard());

describe("circuit breaker", () => {
  it("skips TomTom for 15 minutes after a 403, then allows it again", () => {
    noteTomtomOutcome(403, "routing", 1_000);
    expect(tomtomAvailable("routing", 1_001)).toBe(false);
    expect(tomtomAvailable("routing", 1_000 + BREAKER_FORBIDDEN_MS - 1)).toBe(false);
    expect(tomtomAvailable("routing", 1_000 + BREAKER_FORBIDDEN_MS)).toBe(true);
  });
  it("a 5xx or timeout pauses only briefly", () => {
    noteTomtomOutcome(503, "routing", 0);
    expect(tomtomAvailable("routing", BREAKER_TRANSIENT_MS - 1)).toBe(false);
    expect(tomtomAvailable("routing", BREAKER_TRANSIENT_MS)).toBe(true);
    noteTomtomOutcome("timeout", "routing", 0);
    expect(breakerState("routing", 1).open).toBe(true);
  });
  it("routing and incident quotas trip separately", () => {
    noteTomtomOutcome(403, "incidents", 0);
    expect(tomtomAvailable("routing", 1)).toBe(true);
    expect(tomtomAvailable("incidents", 1)).toBe(false);
  });
  it("a 404 or 400 does not open it", () => {
    noteTomtomOutcome(400);
    noteTomtomOutcome(404);
    expect(tomtomAvailable()).toBe(true);
  });
});

describe("monthly usage guard", () => {
  it("counts calls, reports the remaining estimate and warns once at 80%", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    for (let i = 0; i < 2_000; i += 1) countCall("tomtomIncidents", Date.UTC(2026, 9, 21));
    expect(warn).toHaveBeenCalledTimes(1);
    expect(usageSnapshot(Date.UTC(2026, 9, 21)).tomtomIncidents).toEqual({
      used: 2_000,
      limit: 2_500,
      remainingEstimate: 500,
    });
    expect(quotaSpent("tomtomIncidents", Date.UTC(2026, 9, 21))).toBe(false);
    for (let i = 0; i < 500; i += 1) countCall("tomtomIncidents", Date.UTC(2026, 9, 21));
    expect(quotaSpent("tomtomIncidents", Date.UTC(2026, 9, 21))).toBe(true);
    warn.mockRestore();
  });
  it("starts over in a new month", () => {
    countCall("tomtomRouting", Date.UTC(2026, 9, 31));
    expect(usageSnapshot(Date.UTC(2026, 10, 1)).tomtomRouting.used).toBe(0);
  });
});

describe("sharing", () => {
  it("trips inside Oʻahu share the island box; others get a snapped box", () => {
    const oahu = incidentBoxFor({ minLat: 21.28, maxLat: 21.37, minLon: -158.11, maxLon: -157.83 });
    expect(oahu).toEqual({ key: "oahu", box: OAHU_INCIDENT_BOX });
    const maui = incidentBoxFor({ minLat: 20.81, maxLat: 20.9, minLon: -156.5, maxLon: -156.3 });
    expect(maui.key).not.toBe("oahu");
    expect(maui.box.minLat).toBeLessThanOrEqual(20.81);
    expect(maui.box.maxLon).toBeGreaterThanOrEqual(-156.3);
  });
  it("asks once per max-age and once for concurrent callers; a failure is not remembered", async () => {
    const load = vi.fn(async () => ({ n: 1 }));
    const [a, b] = await Promise.all([
      sharedIncidents("k", 300_000, load),
      sharedIncidents("k", 300_000, load),
    ]);
    expect(a).toEqual(b);
    await sharedIncidents("k", 300_000, load);
    expect(load).toHaveBeenCalledTimes(1);
    const failing = vi.fn(async () => null);
    await sharedIncidents("bad", 300_000, failing);
    await sharedIncidents("bad", 300_000, failing);
    expect(failing).toHaveBeenCalledTimes(2);
  });
  it("incident answers last 5 min for navigation, 10 otherwise, 30 once the allowance is tight", () => {
    expect(incidentMaxAgeMs(true)).toBe(5 * 60_000);
    expect(incidentMaxAgeMs(false)).toBe(10 * 60_000);
    for (let i = 0; i < 2_000; i += 1) countCall("tomtomIncidents");
    expect(incidentMaxAgeMs(true)).toBe(30 * 60_000);
  });
  it("remembers the usual time per trip and hour for hours", () => {
    const key = typicalKey(
      { fromLat: 21.3358, fromLon: -158.0798, toLat: 21.3099, toLon: -157.8644 },
      0,
    );
    rememberTypical(key, 1_800, 0);
    expect(readTypical(key, 5 * 3600_000)).toBe(1_800);
    expect(readTypical(key, 7 * 3600_000)).toBeNull();
  });
});
