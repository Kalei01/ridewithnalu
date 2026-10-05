import { expect, it } from "vitest";
import { hyphenateOahuHouseNumber as h } from "./geocode.functions";
it("x", () => {
  expect(h("911234 Example street")).toBe("91-1234 Example street");
  expect(h("91 1234 Example")).toBe("91-1234 Example");
  expect(h("91-1234 Example")).toBeNull();
  expect(h("1450 Ala Moana")).toBeNull();
  expect(h("94 Kam Hwy")).toBeNull();
});
