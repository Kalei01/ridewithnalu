import { describe, expect, it } from "vitest";
import { zoneOffset } from "./region";

describe("zoneOffset", () => {
  it("knows Honolulu and San Francisco offsets", () => {
    expect(zoneOffset("Pacific/Honolulu", new Date("2026-10-06T12:00:00Z"))).toBe("-10:00");
    expect(zoneOffset("America/Los_Angeles", new Date("2026-10-06T12:00:00Z"))).toBe("-07:00");
    expect(zoneOffset("America/Los_Angeles", new Date("2026-12-06T12:00:00Z"))).toBe("-08:00");
  });
});
