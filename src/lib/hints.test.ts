import { describe, expect, it } from "vitest";
import { shouldShowHint } from "./hints";

describe("shouldShowHint", () => {
  it("shows a new hint", () => {
    expect(shouldShowHint("voice", {})).toBe(true);
  });
  it("hides a hint once used", () => {
    expect(shouldShowHint("voice", { voice: { days: ["2026-10-04"], used: true } })).toBe(false);
  });
  it("hides after 5 different days, but not on the 5th day itself", () => {
    const days = ["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04", "2026-10-05"];
    expect(shouldShowHint("voice", { voice: { days } }, "2026-10-06")).toBe(false);
    expect(shouldShowHint("voice", { voice: { days } }, "2026-10-05")).toBe(true);
  });
});
