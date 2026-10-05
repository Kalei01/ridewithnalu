import { describe, expect, it } from "vitest";
import { directionLabel, groupRoadwork } from "./roadwork";

const closure = (route: string, location = "somewhere") => ({
  route,
  direction: "eastbound",
  location,
  laneSummary: "Lane closure",
  schedule: "nightly from 8 p.m. to 4:30 a.m.",
  work: null,
});

describe("roadwork page grouping", () => {
  it("puts freeways first in H-1, H-2, H-3, Moanalua order, then other roads by name", () => {
    const groups = groupRoadwork([
      closure("Kamehameha Highway"),
      closure("H-201"),
      closure("H-1", "a"),
      closure("Farrington Highway"),
      closure("H-1", "b"),
    ]);
    expect(groups.map((g) => g.name)).toEqual([
      "H-1 Freeway",
      "Moanalua Freeway",
      "Farrington Highway",
      "Kamehameha Highway",
    ]);
    expect(groups[0]?.closures).toHaveLength(2);
    expect(groups[1]?.code).toBe("H-201");
  });

  it("capitalizes directions", () => {
    expect(directionLabel("westbound")).toBe("Westbound");
    expect(directionLabel(null)).toBeNull();
  });
});
