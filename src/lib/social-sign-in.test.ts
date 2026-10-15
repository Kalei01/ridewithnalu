import { describe, expect, it } from "vitest";
import {
  decideAfterMoment,
  googleIdentityAllowedHost,
  randomNonce,
  sha256Hex,
} from "./social-sign-in";

describe("google sign-in helpers", () => {
  it("hashes a nonce to SHA-256 hex", async () => {
    expect(await sha256Hex("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });
  it("makes distinct 64-char hex nonces", () => {
    const a = randomNonce();
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(randomNonce()).not.toBe(a);
  });
  it("uses Google Identity only on ridenalu.com", () => {
    expect(googleIdentityAllowedHost("ridenalu.com")).toBe(true);
    expect(googleIdentityAllowedHost("localhost")).toBe(false);
    expect(googleIdentityAllowedHost("x.preview.app")).toBe(false);
  });
  it("falls back when the prompt is blocked or skipped, cancels when dismissed", () => {
    expect(decideAfterMoment({ isNotDisplayed: () => true })).toBe("fallback");
    expect(decideAfterMoment({ isSkippedMoment: () => true })).toBe("fallback");
    expect(
      decideAfterMoment({
        isDismissedMoment: () => true,
        getDismissedReason: () => "cancel_called",
      }),
    ).toBe("cancel");
    expect(
      decideAfterMoment({
        isDismissedMoment: () => true,
        getDismissedReason: () => "credential_returned",
      }),
    ).toBe("wait");
    expect(decideAfterMoment({ isDisplayed: () => true })).toBe("wait");
  });
});
