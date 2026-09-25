import { expect, it } from "vitest";
import { hyphenateOahuHouseNumber as h } from "./geocode.functions";
it("x", () => {
  expect(h("911160 Kamakana street")).toBe("91-1160 Kamakana street");
  expect(h("91 1160 Kamakana")).toBe("91-1160 Kamakana");
  expect(h("91-1160 Kamakana")).toBeNull();
  expect(h("1450 Ala Moana")).toBeNull();
  expect(h("94 Kam Hwy")).toBeNull();
});
