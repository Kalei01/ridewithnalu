import { expect, it } from "vitest";
import { driveSourceNote } from "./provider-note";

const police = [{ source: "hpd" as const, description: "x", road: null, delayMinutes: null }];

it("says nothing for a normal TomTom answer", () => {
  expect(driveSourceNote({ provider: "tomtom", incidentsAvailable: true })).toBeNull();
  expect(driveSourceNote(null)).toBeNull();
});

it("is honest about the fallback and mentions police reports only when some show", () => {
  expect(driveSourceNote({ provider: "mapbox", incidentsAvailable: false })).toBe(
    "Drive time is estimated. Crash alerts are limited right now.",
  );
  expect(
    driveSourceNote({ provider: "mapbox", incidentsAvailable: false, nearbyIncidents: police }),
  ).toBe("Drive time is estimated. Crash alerts are limited right now; police reports still show.");
  expect(driveSourceNote({ provider: "tomtom", incidentsAvailable: false })).toBe(
    "Crash alerts are limited right now.",
  );
});
