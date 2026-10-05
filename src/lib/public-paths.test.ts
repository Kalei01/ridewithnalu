import { describe, expect, it } from "vitest";
import { isPublicContentPath } from "@/routes/__root";

describe("public pages skip the sign-in loading screen", () => {
  it("covers content pages and guides", () => {
    for (const path of ["/welcome", "/install", "/roadwork", "/oahu-commute", "/guides", "/guides/kapolei-to-downtown", "/install/"]) {
      expect(isPublicContentPath(path)).toBe(true);
    }
  });
  it("keeps the app itself behind the check", () => {
    expect(isPublicContentPath("/")).toBe(false);
    expect(isPublicContentPath("/reset-password")).toBe(false);
    expect(isPublicContentPath("/guidesx")).toBe(false);
  });
});
