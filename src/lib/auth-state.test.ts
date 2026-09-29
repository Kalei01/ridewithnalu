import { describe, expect, it } from "vitest";
import type { User } from "@supabase/supabase-js";
import { authStateAfterEvent, initialAuthState } from "./auth-state";

const rider = { id: "rider-a", email: "rider@example.test" } as User;

describe("persistent authentication state", () => {
  it("restores a stored session without announcing a new sign-in or resetting a trip", () => {
    const state = authStateAfterEvent(initialAuthState, "INITIAL_SESSION", rider, 100);
    expect(state).toEqual({ user: rider, loading: false, signedInAt: null });
    expect(authStateAfterEvent(state, "SIGNED_IN", rider, 200).signedInAt).toBeNull();
  });

  it("handles recovery emitting SIGNED_IN before INITIAL_SESSION", () => {
    const state = authStateAfterEvent(initialAuthState, "SIGNED_IN", rider, 100);
    expect(state.signedInAt).toBeNull();
    expect(authStateAfterEvent(state, "INITIAL_SESSION", rider, 200).user).toBe(rider);
  });

  it("announces an interactive sign-in once, even after tab focus and token refresh", () => {
    const guest = authStateAfterEvent(initialAuthState, "INITIAL_SESSION", null, 100);
    const signedIn = authStateAfterEvent(guest, "SIGNED_IN", rider, 200);
    expect(signedIn.signedInAt).toBe(200);
    const focused = authStateAfterEvent(signedIn, "SIGNED_IN", rider, 300);
    const refreshed = authStateAfterEvent(focused, "TOKEN_REFRESHED", rider, 400);
    expect(refreshed.signedInAt).toBe(200);
    expect(refreshed.user).toBe(rider);
  });

  it("shows guest state on sign-out and recognizes a subsequent login", () => {
    const signedIn = { user: rider, loading: false, signedInAt: 100 };
    const signedOut = authStateAfterEvent(signedIn, "SIGNED_OUT", null, 200);
    expect(signedOut.user).toBeNull();
    expect(authStateAfterEvent(signedOut, "SIGNED_IN", rider, 300).signedInAt).toBe(300);
  });
});
