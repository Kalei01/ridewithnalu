import { describe, expect, it } from "vitest";
import { createRateLimiter } from "./rate-limit";

describe("rate limiter", () => {
  it("allows up to the limit in the window, then blocks, then recovers", () => {
    const allow = createRateLimiter(3, 60_000);
    expect([allow("a", 0), allow("a", 1), allow("a", 2)]).toEqual([true, true, true]);
    expect(allow("a", 3)).toBe(false);
    expect(allow("b", 3)).toBe(true);
    expect(allow("a", 60_001)).toBe(true);
  });

  it("keeps memory bounded", () => {
    const allow = createRateLimiter(1, 60_000, 2);
    allow("a", 0);
    allow("b", 0);
    allow("c", 0);
    expect(allow("a", 1)).toBe(true);
  });
});
