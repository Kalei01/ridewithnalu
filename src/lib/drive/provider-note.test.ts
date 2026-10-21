import { expect, it } from "vitest";
import { driveSourceNote } from "./provider-note";

it("says nothing for a normal TomTom answer and is honest about the fallback", () => {
  expect(driveSourceNote({ provider: "tomtom", incidentsAvailable: true })).toBeNull();
  expect(driveSourceNote({ provider: "mapbox", incidentsAvailable: false })).toMatch(
    /Mapbox \(estimate\)/,
  );
  expect(driveSourceNote({ provider: "tomtom", incidentsAvailable: false })).toMatch(/paused/);
});
