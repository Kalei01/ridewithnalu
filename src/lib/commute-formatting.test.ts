import { describe, expect, it } from "vitest";
import { busRouteLabel, stationLabel, titleCase } from "./commute-formatting";

describe("display names", () => {
  it("spells Kualakaʻi with the ʻokina however GTFS or typed text has it", () => {
    expect(stationLabel("KUALAKA'I")).toBe("Kualakaʻi");
    expect(titleCase("Kualakai")).toBe("Kualakaʻi");
  });

  it("names the UH West Oʻahu station", () => {
    expect(titleCase("KEONE'AE U.H. WEST OAHU")).toBe("Keoneʻae (UH West Oʻahu)");
  });

  it("keeps CountryExpress as one word", () => {
    expect(titleCase("COUNTRYEXPRESS C")).toBe("CountryExpress C");
  });

  it("labels numbered routes Bus N and named lines by name", () => {
    expect(busRouteLabel("42")).toBe("Bus 42");
    expect(busRouteLabel("W LINE")).toBe("W Line");
    expect(busRouteLabel(null)).toBe("Bus");
  });
});
