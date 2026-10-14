import { supabase } from "@/integrations/supabase/client";

export type SocialProvider = "google" | "apple";

/** Sign in with Apple needs an Apple Developer account, so it stays hidden until VITE_APPLE_SIGN_IN=true is set. */
export const appleSignInAvailable = import.meta.env["VITE_APPLE_SIGN_IN"] === "true";

/** Google/Apple sign-in goes through Supabase directly. */
export async function signInWithSocial(
  provider: SocialProvider,
  redirectTo: string = window.location.origin,
): Promise<{ error?: Error | null }> {
  const { error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo } });
  return { error };
}
