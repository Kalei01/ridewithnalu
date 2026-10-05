import { describe, expect, it } from "vitest";
import { normalizeRef, refFromUrl } from "./ref-source";

describe("link tags", () => {
  it("reads ?ref= first, then utm_source", () => {
    expect(refFromUrl("?ref=West")).toBe("west");
    expect(refFromUrl("?utm_source=instagram")).toBe("instagram");
    expect(refFromUrl("?ref=uh&utm_source=instagram")).toBe("uh");
    expect(refFromUrl("")).toBeNull();
  });

  it("ignores anything that isn't a short, plain tag", () => {
    expect(normalizeRef("<script>")).toBeNull();
    expect(normalizeRef("a".repeat(33))).toBeNull();
    expect(normalizeRef("email_welcome")).toBe("email_welcome");
  });
});
