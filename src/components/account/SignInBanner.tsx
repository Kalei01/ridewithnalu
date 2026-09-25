import { useEffect, useState } from "react";
import { LogIn, X } from "lucide-react";
import { lovable } from "@/integrations/lovable";
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
        Sign in with Google or Apple to sync your saved places and alerts across devices.
      </p>
      <Button
        size="sm"
        variant="outline"
        className="h-7 shrink-0 px-2 text-xs"
        onClick={() => void lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin })}
      >
        <LogIn className="size-3.5" /> Google
      </Button>
      <Button
        size="sm"
        variant="outline"
        className="h-7 shrink-0 px-2 text-xs"
        onClick={() => void lovable.auth.signInWithOAuth("apple", { redirect_uri: window.location.origin })}
      >
        Apple
      </Button>
      <Button size="icon" variant="ghost" aria-label="Dismiss sign-in suggestion" className="size-7 shrink-0 text-muted-foreground" onClick={dismiss}>
        <X className="size-4" />
      </Button>
    </div>
  );
}
