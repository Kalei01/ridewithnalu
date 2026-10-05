import { describe, expect, it } from "vitest";
import { dropDriveToStationsWithoutParking, isParkAndRide, nearestParkAndRide } from "./park-and-ride";

const station = (stop_id: string, stop_lat: number, stop_lon: number) => ({ stop_id, stop_lat, stop_lon });
const STATIONS = [
  station("10047", 21.345574, -158.050995), // Kualakaʻi: no lot
  station("10046", 21.358532, -158.051188), // Keoneʻae: lot
  station("10045", 21.36698, -158.045203), // Honouliuli: lot
  station("10030", 21.33274, -157.888805), // Kahauiki: lot
];

describe("Skyline park-and-ride", () => {
  it("knows the four stations with a lot, per the City", () => {
    expect(["10046", "10045", "10055", "10030"].every(isParkAndRide)).toBe(true);
    expect(isParkAndRide("10047")).toBe(false); // Kualakaʻi
    expect(isParkAndRide("10053")).toBe(false); // Waiawa
    expect(isParkAndRide(null)).toBe(false);
  });

  it("picks UH West Oʻahu (Keoneʻae) from ʻEwa Beach, not the nearer Kualakaʻi", () => {
    expect(nearestParkAndRide({ lat: 21.32203, lon: -158.03366 }, STATIONS)?.stop_id).toBe("10046");
  });

  it("drops a drive to a station without a lot, keeps walking trips", () => {
    const drive = (to: string) => ({ legs: [{ kind: "access", mode: "drive", to_stop_id: to }] });
    const walk = { legs: [{ kind: "access", mode: "walk", to_stop_id: "10047" }] };
    expect(dropDriveToStationsWithoutParking([drive("10047"), drive("10046"), walk])).toEqual([drive("10046"), walk]);
  });
});
