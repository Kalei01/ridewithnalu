import { describe, expect, it } from "vitest";
import {
  clockInputValue,
  commutePresets,
  findByKind,
  parseClockInput,
  parseSavedPlaces,
  migrateSavedPlaces,
  removePlace,
  swapHomeWork,
  upsertPlace,
  type SavedPlace,
} from "./saved-places";

const place = (over: Partial<SavedPlace>): SavedPlace => ({
  id: "p1",
  kind: "home",
  label: "Home",
  name: "Ewa Beach",
  address: "Ewa Beach, HI",
  lat: 21.31,
  lon: -158.01,
  typicalArrivalSeconds: null,
  createdAt: "2026-09-22T00:00:00.000Z",
  updatedAt: "2026-09-22T00:00:00.000Z",
  ...over,
});

describe("parseSavedPlaces", () => {
  it("returns an empty list for missing or broken storage", () => {
    expect(parseSavedPlaces(null)).toEqual([]);
    expect(parseSavedPlaces("not json")).toEqual([]);
    expect(parseSavedPlaces('{"a":1}')).toEqual([]);
  });

  it("migrates v1 arrival times and setup coordinates without transit ids", () => {
    const migrated = migrateSavedPlaces(
      null,
      JSON.stringify([place({})]),
      JSON.stringify({ destinationName: "Office", destinationAddress: "55 Merchant St", destLat: 21.31, destLon: -157.86 }),
      "2026-09-22T00:00:00.000Z",
    );
    expect(findByKind(migrated, "home")?.lat).toBe(21.31);
    expect(findByKind(migrated, "work")?.address).toBe("55 Merchant St");
    expect(migrated.every((saved) => Boolean(saved.createdAt && saved.updatedAt))).toBe(true);
  });

  it("drops entries without coordinates and fills defaults", () => {
    const parsed = parseSavedPlaces(
      JSON.stringify([
        { kind: "work", name: "Downtown", lat: 21.3, lon: -157.86 },
        { kind: "work", name: "Broken", lat: null, lon: -157.86 },
      ]),
    );
    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.label).toBe("Work");
    expect(parsed[0]?.typicalArrivalSeconds).toBeNull();
  });
});

describe("upsertPlace / removePlace", () => {
  it("keeps Home and Work single", () => {
    const list = upsertPlace([place({})], place({ id: "p2", name: "New House" }));
    expect(list).toHaveLength(1);
    expect(list[0]?.name).toBe("New House");
  });

  it("keeps several custom places and removes by id", () => {
    let list = upsertPlace([], place({ id: "g", kind: "gym", label: "Gym", name: "Gym" }));
    list = upsertPlace(list, place({ id: "s", kind: "school", label: "School", name: "School" }));
    expect(list).toHaveLength(2);
    expect(removePlace(list, "g")).toHaveLength(1);
  });
});

describe("swapHomeWork", () => {
  it("swaps the two roles", () => {
    const list = [place({}), place({ id: "p2", kind: "work", label: "Work", name: "Office" })];
    const swapped = swapHomeWork(list);
    expect(findByKind(swapped, "home")?.name).toBe("Office");
    expect(findByKind(swapped, "work")?.name).toBe("Ewa Beach");
  });

  it("does nothing without both", () => {
    const list = [place({})];
    expect(swapHomeWork(list)).toEqual(list);
  });
});

describe("commutePresets", () => {
  it("builds both directions for every other saved place", () => {
    const list = [
      place({}),
      place({ id: "w", kind: "work", label: "Work", name: "Office" }),
      place({ id: "g", kind: "gym", label: "Gym", name: "Gym" }),
    ];
    const presets = commutePresets(list);
    expect(presets.map((preset) => preset.label)).toEqual([
      "Home → Work",
      "Work → Home",
      "Home → Gym",
      "Gym → Home",
    ]);
  });

  it("returns nothing without a Home", () => {
    expect(commutePresets([place({ kind: "gym" })])).toEqual([]);
  });
});

describe("clock helpers", () => {
  it("round-trips a time input", () => {
    expect(parseClockInput("07:30")).toBe(27000);
    expect(clockInputValue(27000)).toBe("07:30");
  });

  it("rejects nonsense", () => {
    expect(parseClockInput("")).toBeNull();
    expect(parseClockInput("25:00")).toBeNull();
    expect(parseClockInput("7:5")).toBeNull();
    expect(clockInputValue(null)).toBe("");
  });
});
