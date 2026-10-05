import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Mail } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/use-auth";
import { getEmailOptIn, setEmailOptIn } from "@/lib/email.functions";

const ASKED = "nalu-email-asked-v1";
const ON_A_TRIP = "nalu-committed-mode-v1";

/**
 * Asks once, shortly after someone signs in, whether they want Nalu emails.
 * Yes or no is saved to their account, so no phone asks again. Never during a trip.
 */
export function EmailPrompt() {
  const { user } = useAuth();
  const read = useServerFn(getEmailOptIn);
  const write = useServerFn(setEmailOptIn);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user?.email) return;
    const askedKey = `${ASKED}:${user.id}`;
    try {
      if (window.localStorage.getItem(askedKey) || window.localStorage.getItem(ON_A_TRIP)) return;
    } catch {
      return;
    }
    let live = true;
    // Give the screen a moment to settle after sign-in before asking.
    const timer = window.setTimeout(() => {
      void read()
        .then((r) => {
          if (!live) return;
          if (r.chosen) {
            try {
              window.localStorage.setItem(askedKey, "1");
            } catch {
              /* ignore */
            }
            return;
          }
          setOpen(true);
        })
        .catch(() => {});
    }, 1500);
    return () => {
      live = false;
      window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  if (!user?.email) return null;

  /** Closed without answering: don't ask again on this phone; Settings still has the switch. */
  function dismiss() {
    try {
      if (user) window.localStorage.setItem(`${ASKED}:${user.id}`, "1");
    } catch {
      /* ignore */
    }
    setOpen(false);
  }

  async function answer(on: boolean) {
    if (busy || !user) return;
    setBusy(true);
    try {
      await write({ data: { on } });
      try {
        window.localStorage.setItem(`${ASKED}:${user.id}`, "1");
      } catch {
        /* ignore */
      }
      setOpen(false);
      toast(on ? "You're signed up for Nalu emails." : "No emails. You can turn them on anytime in Settings.");
    } catch {
      toast.error("Couldn't save that. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? undefined : dismiss())}>
      <DialogContent className="max-w-sm">
        <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/15 text-primary">
          <Mail className="size-6" />
        </div>
        <DialogTitle className="text-xl">Get commute updates by email?</DialogTitle>
        <DialogDescription className="text-base leading-7">
          A short Sunday note on your week with Nalu, plus a heads-up before big traffic days. At most
          once a week, sent to {user.email}. Unsubscribe anytime.
        </DialogDescription>
        <div className="grid gap-2 pt-2">
          <Button className="h-12 text-base" disabled={busy} onClick={() => void answer(true)}>
            Yes, email me
          </Button>
          <Button variant="ghost" className="h-12 text-base" disabled={busy} onClick={() => void answer(false)}>
            No thanks
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
