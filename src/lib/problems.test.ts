import { describe, expect, it } from "vitest";
import { areaName, problemFingerprint } from "./problems";

describe("problemFingerprint", () => {
  it("groups the same error with different numbers and ids", () => {
    const a = problemFingerprint("server", "leave-alerts", "Timeout after 2500 ms for 9f1c2d3e-1111-2222-3333-444455556666");
    const b = problemFingerprint("server", "leave-alerts", "Timeout after 3100 ms for 0a1b2c3d-aaaa-bbbb-cccc-ddddeeeeffff");
    expect(a).toBe(b);
  });
  it("keeps different errors apart", () => {
    expect(problemFingerprint("app", "/", "TypeError: x is undefined")).not.toBe(
      problemFingerprint("app", "/", "TypeError: y is undefined"),
    );
  });
});

describe("areaName", () => {
  it("names areas in plain words", () => {
    expect(areaName("leave-alerts")).toBe("Leave alerts");
    expect(areaName("/")).toBe("Home screen");
    expect(areaName("/welcome")).toBe("Page /welcome");
  });
});
