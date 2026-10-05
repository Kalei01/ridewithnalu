import { describe, expect, it } from "vitest";
import { directionLabel, groupRoadwork, roadworkSummary } from "./roadwork";

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

  it("sums the week up in one line for Browse, freeways first", () => {
    expect(
      roadworkSummary([
        closure("Kamehameha Highway"),
        closure("H-1", "a"),
        closure("H-201"),
        closure("H-1", "b"),
        closure("Farrington Highway"),
      ]),
    ).toBe("5 planned closures · H-1, Moanalua Freeway, Farrington Highway and 1 more");
    expect(roadworkSummary([closure("H-2")])).toBe("1 planned closure · H-2");
    expect(roadworkSummary([])).toBe("No planned lane closures listed");
  });

  it("capitalizes directions", () => {
    expect(directionLabel("westbound")).toBe("Westbound");
    expect(directionLabel(null)).toBeNull();
  });
});

describe("tidying HDOT wording", async () => {
  const { tidyClosure } = await import("./roadwork");

  it("splits the place, notes round-the-clock closures and turns the website line into a link", () => {
    const tidy = tidyClosure({
      route: "H-1",
      direction: "eastbound",
      location: "HONOLULU (24/7 CLOSURE) Right shoulder closure on the eastbound H-1 Freeway,",
      laneSummary: "Lane closure",
      schedule: "See HDOT weekly schedule",
      work: "more information, visit the project website: https://h1widening.com/",
    });
    expect(tidy).toEqual({
      place: "Honolulu",
      what: "Right shoulder closure on the eastbound H-1 Freeway",
      lanes: "Shoulder closed",
      when: "Around the clock",
      why: null,
      link: "https://h1widening.com/",
    });
  });

  it("keeps the reason and its link apart", () => {
    const tidy = tidyClosure({
      route: "H-3",
      direction: "westbound",
      location: "KANEOHE (24-HOUR CLOSURE) Closure of the H-3 Freeway on-ramp",
      laneSummary: "Lane closure",
      schedule: "from Kamehameha Highway 24-hours a day, 7-days a week",
      work: "the duration of the emergency culvert repairs. See: https://hidot.hawaii.gov/blog/2026/06/18/x/",
    });
    expect(tidy.place).toBe("Kaneohe");
    expect(tidy.why).toBe("Emergency culvert repairs");
    expect(tidy.link).toBe("https://hidot.hawaii.gov/blog/2026/06/18/x/");
    expect(tidy.when).toBe("From Kamehameha Highway 24-hours a day, 7-days a week");
  });
});
