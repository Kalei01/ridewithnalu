import { describe, expect, it } from "vitest";
import { hdotRoadName } from "./hdot-road-names";

describe("hdotRoadName", () => {
  it("gives H-201 its everyday name with the code alongside", () => {
    expect(hdotRoadName("H-201")).toEqual({ name: "Moanalua Freeway", code: "H-201" });
    expect(hdotRoadName("H201")).toEqual({ name: "Moanalua Freeway", code: "H-201" });
  });
  it("keeps H-1/H-2/H-3 as people say them", () => {
    expect(hdotRoadName("H-1")).toEqual({ name: "H-1 Freeway", code: null });
    expect(hdotRoadName("H-3")).toEqual({ name: "H-3 Freeway", code: null });
  });
  it("leaves unknown codes unchanged", () => {
    expect(hdotRoadName("H-99")).toEqual({ name: "H-99", code: null });
  });
});
