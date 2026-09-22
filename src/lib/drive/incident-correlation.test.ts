import { describe, expect, it } from "vitest";
import { incidentTouchesRoute } from "./incident-correlation";

const route = [
  { lat: 21.329, lon: -157.893 },
  { lat: 21.322, lon: -157.875 },
  { lat: 21.315, lon: -157.858 },
];

describe("incidentTouchesRoute", () => {
  it("keeps an incident on the calculated corridor", () => {
    expect(incidentTouchesRoute([{ lat: 21.3221, lon: -157.8751 }], route)).toBe(true);
  });

  it("rejects an incident on an unrelated nearby street", () => {
    expect(incidentTouchesRoute([{ lat: 21.326, lon: -157.875 }], route)).toBe(false);
  });

  it("rejects incidents without geometry", () => {
    expect(incidentTouchesRoute([], route)).toBe(false);
  });
});