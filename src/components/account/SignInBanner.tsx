import { useEffect, useState } from "react";
import { LogIn, X } from "lucide-react";
import { appleSignInAvailable, signInWithSocial } from "@/lib/social-sign-in";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";

const DISMISS_KEY = "nalu-signin-banner-dismissed-v1";

/** Gentle, one-time nudge to sign in; never blocks guest use. */
export function SignInBanner() {
  const { user, loading } = useAuth();
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    try {
      setDismissed(window.localStorage.getItem(DISMISS_KEY) === "1");
    } catch {
      setDismissed(false);
    }
  }, []);

  if (loading || user || dismissed) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore private-mode storage failures */
    }
  };

  return (
    <div className="mt-2 flex items-start gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] p-3 backdrop-blur-md">
      <p className="flex-1 text-xs leading-snug text-muted-foreground">
        Sign in with {appleSignInAvailable ? "Google or Apple" : "Google"} to sync your saved places and alerts
        across devices.
      </p>
      <Button
        size="sm"
        variant="outline"
        className="h-9 shrink-0 px-2 text-xs"
        onClick={() => void signInWithSocial("google")}
      >
        <LogIn className="size-3.5" /> Google
      </Button>
      {appleSignInAvailable && (
        <Button
          size="sm"
          variant="outline"
          className="h-9 shrink-0 px-2 text-xs"
          onClick={() => void signInWithSocial("apple")}
        >
          Apple
        </Button>
      )}
      <Button
        size="icon"
        variant="ghost"
        aria-label="Dismiss sign-in suggestion"
        className="size-9 shrink-0 text-muted-foreground"
        onClick={dismiss}
      >
        <X className="size-4" />
      </Button>
    </div>
  );
}
