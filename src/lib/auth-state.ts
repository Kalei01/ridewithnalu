import type { AuthChangeEvent, User } from "@supabase/supabase-js";

export type AuthState = { user: User | null; loading: boolean; signedInAt: number | null };
export const initialAuthState: AuthState = { user: null, loading: true, signedInAt: null };

/** Session recovery and tab-focus events must not look like a new account sign-in. */
export function authStateAfterEvent(
  state: AuthState,
  event: AuthChangeEvent,
  user: User | null,
  at: number,
): AuthState {
  const newlySignedIn =
    !state.loading && event === "SIGNED_IN" && user !== null && user.id !== state.user?.id;
  return {
    user,
    loading: false,
    signedInAt: newlySignedIn ? at : state.signedInAt,
  };
}
