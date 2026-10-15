import { supabase } from "@/integrations/supabase/client";

export type SocialProvider = "google" | "apple";

/** Sign in with Apple needs an Apple Developer account, so it stays hidden until VITE_APPLE_SIGN_IN=true is set. */
export const appleSignInAvailable = import.meta.env["VITE_APPLE_SIGN_IN"] === "true";

/** Public Google Web client ID (the one Supabase's Google provider uses). Not a secret. */
const DEFAULT_GOOGLE_CLIENT_ID =
  "936480888602-amlugblg715i0tjilo5fjan5o2pe9e4n.apps.googleusercontent.com";
export const GOOGLE_CLIENT_ID: string =
  (import.meta.env["VITE_GOOGLE_CLIENT_ID"] as string | undefined) || DEFAULT_GOOGLE_CLIENT_ID;

export const GIS_SCRIPT_URL = "https://accounts.google.com/gsi/client";
/** Google only accepts the registered origin, so previews/localhost use the Supabase redirect. */
const GIS_HOSTS = new Set(["ridenalu.com", "www.ridenalu.com"]);

export function googleIdentityAllowedHost(hostname: string): boolean {
  return GIS_HOSTS.has(hostname.toLowerCase());
}

export function randomNonce(bytes = 32): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** GIS gets the SHA-256 hex of the nonce; Supabase gets the raw one. */
export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export type PromptMoment = {
  isDisplayed?: () => boolean;
  isNotDisplayed?: () => boolean;
  isSkippedMoment?: () => boolean;
  isDismissedMoment?: () => boolean;
  getDismissedReason?: () => string;
};

/**
 * What to do when Google reports how the prompt went:
 * "wait" = keep waiting for the credential, "fallback" = use the redirect flow, "cancel" = rider backed out.
 */
export function decideAfterMoment(m: PromptMoment): "wait" | "fallback" | "cancel" {
  if (m.isDismissedMoment?.()) {
    return m.getDismissedReason?.() === "credential_returned" ? "wait" : "cancel";
  }
  if (m.isNotDisplayed?.() || m.isSkippedMoment?.()) return "fallback";
  return "wait";
}

type GisCredentialResponse = { credential?: string };
type GisApi = {
  accounts: {
    id: {
      initialize: (config: Record<string, unknown>) => void;
      prompt: (cb?: (m: PromptMoment) => void) => void;
      cancel: () => void;
    };
  };
};

let gisLoad: Promise<GisApi> | null = null;

/** Lazily loads Google Identity Services; call when sign-in UI appears so the click is instant. */
export function loadGoogleIdentity(): Promise<GisApi> {
  const existing = (window as unknown as { google?: GisApi }).google;
  if (existing?.accounts?.id) return Promise.resolve(existing);
  if (gisLoad) return gisLoad;
  gisLoad = new Promise<GisApi>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = GIS_SCRIPT_URL;
    script.async = true;
    script.onload = () => {
      const g = (window as unknown as { google?: GisApi }).google;
      if (g?.accounts?.id) resolve(g);
      else reject(new Error("Google Identity Services did not initialize"));
    };
    script.onerror = () => reject(new Error("Google Identity Services failed to load"));
    document.head.appendChild(script);
  }).catch((err) => {
    gisLoad = null;
    document.querySelectorAll(`script[src="${GIS_SCRIPT_URL}"]`).forEach((s) => s.remove());
    throw err;
  });
  return gisLoad;
}

/** Warm the GIS script when a sign-in button is on screen. Never throws. */
export function preloadGoogleIdentity(): void {
  if (typeof window === "undefined" || !googleIdentityAllowedHost(window.location.hostname)) return;
  loadGoogleIdentity().catch(() => undefined);
}

async function signInWithRedirect(provider: SocialProvider, redirectTo: string) {
  const { error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo } });
  return { error };
}

type GoogleResult = { error?: Error | null } | "fallback";

async function signInWithGoogleIdentity(): Promise<GoogleResult> {
  let gis: GisApi;
  try {
    gis = await Promise.race([
      loadGoogleIdentity(),
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error("timeout")), 4000)),
    ]);
  } catch {
    return "fallback";
  }
  const rawNonce = randomNonce();
  const hashedNonce = await sha256Hex(rawNonce);

  return new Promise<GoogleResult>((resolve) => {
    let settled = false;
    const finish = (r: GoogleResult) => {
      if (settled) return;
      settled = true;
      resolve(r);
    };
    try {
      gis.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        nonce: hashedNonce,
        use_fedcm_for_prompt: true,
        auto_select: false,
        cancel_on_tap_outside: true,
        callback: (response: GisCredentialResponse) => {
          if (!response.credential) return finish("fallback");
          supabase.auth
            .signInWithIdToken({ provider: "google", token: response.credential, nonce: rawNonce })
            .then(({ error }) => finish(error ? "fallback" : { error: null }))
            .catch(() => finish("fallback"));
        },
        error_callback: () => finish("fallback"),
      });
      gis.accounts.id.prompt((moment) => {
        const next = decideAfterMoment(moment);
        if (next === "fallback") finish("fallback");
        else if (next === "cancel") finish({ error: null });
      });
    } catch {
      finish("fallback");
    }
  });
}

/** Google signs in on ridenalu.com via Google Identity Services (so Google shows our domain); everything else, and any failure, uses Supabase's redirect flow. */
export async function signInWithSocial(
  provider: SocialProvider,
  redirectTo: string = window.location.origin,
): Promise<{ error?: Error | null }> {
  if (provider === "google" && googleIdentityAllowedHost(window.location.hostname)) {
    const result = await signInWithGoogleIdentity();
    if (result !== "fallback") return result;
  }
  return signInWithRedirect(provider, redirectTo);
}
