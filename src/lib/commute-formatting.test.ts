import { describe, expect, it } from "vitest";
import { busRouteLabel, stationLabel, terminusLabel, titleCase } from "./commute-formatting";
import { skylineStationFromText, skylineStationName, withStation } from "./rail/station-names";

describe("display names", () => {
  it("spells Kualakaʻi with the ʻokina however GTFS or typed text has it", () => {
    expect(stationLabel("KUALAKA'I")).toBe("East Kapolei (Kualakaʻi)");
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

describe("Skyline station names riders see (confirmed Oct 11, 2026)", () => {
  it("shows the English name, then the Hawaiian name, for every way GTFS writes it", () => {
    expect(stationLabel("KAHAUIKI KALIHI TRANSIT CENTER STATION")).toBe(
      "Kalihi Transit Center (Kahauiki)",
    );
    expect(terminusLabel("KAHAUIKI KALIHI TRN CTR SKYLINE STATION")).toBe(
      "Kalihi Transit Center (Kahauiki)",
    );
    expect(terminusLabel("HALAULANI LEEWARD COMM COLL SKYLINE STN")).toBe(
      "Leeward Community College (Halaulani)",
    );
    expect(stationLabel("LELEPAUA DANIEL K. INOUYE INTERNATIONAL AIRPORT STATION")).toBe(
      "Daniel K. Inouye International Airport (Lelepaua)",
    );
    expect(stationLabel("MAKALAPA JOINT BASE PEARL HARBOR-HICKAM STATION")).toBe(
      "Joint Base Pearl Harbor–Hickam (Makalapa)",
    );
    expect(stationLabel("HO'AE'AE WEST LOCH STATION")).toBe("West Loch (Hōʻaeʻae)");
    expect(stationLabel("Hālawa")).toBe("Aloha Stadium (Hālawa)");
  });

  it("leaves bus stops on streets with a station's name alone", () => {
    expect(stationLabel("WAIAWA RD + KAMEHAMEHA HWY")).toBe("Waiawa Rd + Kamehameha Highway");
    expect(skylineStationFromText("HALAWA VALLEY ST")).toBeUndefined();
    // A street named after a station, in the station's own area, is still a street.
    expect(skylineStationFromText("KUALAKAI PKWY KAPOLEI")).toBeUndefined();
    expect(skylineStationFromText("MAKALAPA DR PEARL HARBOR")).toBeUndefined();
  });

  it("names a station by its stop id", () => {
    expect(skylineStationName("10045")).toBe("Hoʻopili (Honouliuli)");
    expect(skylineStationName("99999")).toBeUndefined();
  });
});

describe("withStation", () => {
  it("doesn't add Station after a full rider name", () => {
    expect(withStation("Kalihi Transit Center (Kahauiki)")).toBe(
      "Kalihi Transit Center (Kahauiki)",
    );
    expect(withStation("Lelepaua")).toBe("Lelepaua Station");
  });
});
