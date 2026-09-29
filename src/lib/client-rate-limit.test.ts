import { describe, expect, it } from "vitest";
import { createClientRateWindow } from "./client-rate-limit";

describe("client request window", () => {
  it("blocks repeated submissions until the cooldown ends", () => {
    const gate = createClientRateWindow(8_000);
    expect(gate.tryAcquire(10_000)).toBe(true);
    expect(gate.tryAcquire(10_100)).toBe(false);
    expect(gate.remainingMs(10_100)).toBe(7_900);
    expect(gate.tryAcquire(18_000)).toBe(true);
  });

  it("can delay the next Arrive By traffic lookup after a request starts", () => {
    const gate = createClientRateWindow(8_000);
    expect(gate.tryAcquire(20_000)).toBe(true);
    expect(gate.remainingMs(20_500)).toBe(7_500);
    expect(gate.remainingMs(28_000)).toBe(0);
  });
});
