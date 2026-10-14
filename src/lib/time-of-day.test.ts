import { describe, expect, it } from "vitest";
import { honoluluMinutes, timeOfDay } from "./time-of-day";

// Honolulu is UTC-10 all year, so 17:00 UTC is 7:00 AM there.
const at = (utc: string) => new Date(`2026-10-14T${utc}:00Z`);

describe("timeOfDay (Honolulu clock)", () => {
  it("reads Honolulu minutes, not the device's", () => {
    expect(honoluluMinutes(at("17:00"))).toBe(7 * 60);
    expect(honoluluMinutes(at("10:00"))).toBe(0);
  });
  it("names the four periods", () => {
    expect(timeOfDay(at("16:00"))).toBe("sunrise"); // 6:00 AM
    expect(timeOfDay(at("22:00"))).toBe("day"); // noon
    expect(timeOfDay(at("03:30"))).toBe("sunset"); // 5:30 PM (previous day UTC)
    expect(timeOfDay(at("08:00"))).toBe("night"); // 10:00 PM
    expect(timeOfDay(at("12:00"))).toBe("night"); // 2:00 AM
  });
  it("switches exactly on the boundaries", () => {
    expect(timeOfDay(at("15:29"))).toBe("night"); // 5:29 AM
    expect(timeOfDay(at("15:30"))).toBe("sunrise");
    expect(timeOfDay(at("17:30"))).toBe("day"); // 7:30 AM
    expect(timeOfDay(at("03:14"))).toBe("day"); // 5:14 PM
    expect(timeOfDay(at("03:15"))).toBe("sunset");
    expect(timeOfDay(at("05:15"))).toBe("night"); // 7:15 PM
  });
});
