import { useEffect, useState } from "react";
import { Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import type { UpgradeRequest } from "@/hooks/use-gate";
import { signInWithSocial } from "@/lib/social-sign-in";
import { DAILY_TRIP_LIMIT, FEATURE_NAME } from "@/lib/tiers";

const FREE_PERKS = ["Unlimited trip checks", "Your places on every phone", "Arrive-by planning", "A time-to-leave alert"];
const PLUS_PERKS = [
  "Turn-by-turn voice directions",
  "“Get off in 2 stops” alerts on the bus",
  "Live traffic updates while you drive",
  "Time-to-leave alerts for every trip",
  "Ask Nalu",
];

/**
 * The two upgrade screens: "create a free account" for guests, and Plus.
 * Opened by useGate().require / tripCheck, from anywhere in the app.
 */
export function UpgradeSheet() {
  const [request, setRequest] = useState<UpgradeRequest | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const open = (event: Event) => setRequest((event as CustomEvent<UpgradeRequest>).detail);
    window.addEventListener("nalu-upgrade", open);
    return () => window.removeEventListener("nalu-upgrade", open);
  }, []);
  const close = () => setRequest(null);

  async function signUp() {
    setBusy(true);
    try {
      await signInWithSocial("google");
    } finally {
      setBusy(false);
    }
  }

  const signup = request?.kind === "signup";
  const title = signup
    ? request?.reason === "trip_limit"
      ? `You've used today's ${DAILY_TRIP_LIMIT.guest} free trip checks`
      : `${request?.feature ? FEATURE_NAME[request.feature] : "This"} needs a free account`
    : "Nalu Plus";
  const lead = signup
    ? "Create a free account to keep going. It takes one tap with Google, and it stays free."
    : `${request?.feature ? `${FEATURE_NAME[request.feature]} comes with Plus.` : ""} For people who commute every day.`;

  return (
    <Dialog open={request !== null} onOpenChange={(next) => (next ? undefined : close())}>
      <DialogContent className="max-w-sm">
        <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/15 text-primary">
          <Sparkles className="size-6" />
        </div>
        <DialogTitle className="text-xl">{title}</DialogTitle>
        <DialogDescription className="text-base leading-7">{lead}</DialogDescription>
        <ul className="grid gap-2">
          {(signup ? FREE_PERKS : PLUS_PERKS).map((perk) => (
            <li key={perk} className="flex gap-2.5 text-base text-foreground">
              <Check className="mt-1 size-4 shrink-0 text-primary" aria-hidden="true" />
              {perk}
            </li>
          ))}
        </ul>
        {signup ? (
          <Button type="button" className="h-14 text-base font-bold" disabled={busy} onClick={() => void signUp()}>
            Sign up free with Google
          </Button>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">$4.99 a month or $39 a year, with a 7-day free trial.</p>
            <Button type="button" className="h-14 text-base font-bold" disabled>
              Coming soon
            </Button>
            <p className="text-xs text-muted-foreground">Getting home safe and the main answer are always free.</p>
          </>
        )}
        <Button type="button" variant="ghost" className="h-11 text-base" onClick={close}>
          Not now
        </Button>
      </DialogContent>
    </Dialog>
  );
}
