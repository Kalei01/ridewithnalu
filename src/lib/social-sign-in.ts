import { lovable } from "@/integrations/lovable";
import { supabase } from "@/integrations/supabase/client";

export type SocialProvider = "google" | "apple";

/**
 * Sign in with Apple needs an Apple Developer account. Lovable brokered it;
 * self-hosted, it stays hidden until VITE_APPLE_SIGN_IN=true is set.
 */
export const appleSignInAvailable =
  import.meta.env["VITE_AUTH_PROVIDER"] !== "supabase" ||
  import.meta.env["VITE_APPLE_SIGN_IN"] === "true";

/**
 * Lovable Cloud brokers Google/Apple sign-in through Lovable. A self-hosted
 * deploy with its own Supabase project sets VITE_AUTH_PROVIDER=supabase and
 * signs in through Supabase directly.
 */
export async function signInWithSocial(
  provider: SocialProvider,
  redirectTo: string = window.location.origin,
): Promise<{ error?: Error | null }> {
  if (import.meta.env["VITE_AUTH_PROVIDER"] === "supabase") {
    const { error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo } });
    return { error };
  }
  return lovable.auth.signInWithOAuth(provider, { redirect_uri: redirectTo });
}
