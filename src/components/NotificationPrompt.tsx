import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { BellRing, Share } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/use-auth";
import { clockToMinutes, obtainPushToken, readPushPrefs, writePushPrefs } from "@/lib/push-client";
import { savePushSubscription, sendTestPush } from "@/lib/push.functions";

const ASKED_KEY = "nalu-notif-asked-v1";

const BLOCKED_COPY = {
  "not-configured": "Notifications aren't set up yet.",
  unsupported: "This browser can't show notifications.",
  "open-in-new-tab": "Open Nalu in its own tab or the installed app to turn on notifications.",
  denied: "Notifications are blocked for Nalu. You can allow them later in your phone's settings.",
} as const;

function read(key: string) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function markAsked() {
  try {
    window.localStorage.setItem(ASKED_KEY, "1");
  } catch {
    /* private mode */
  }
}
function isIos() {
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) || (ua.includes("Mac") && navigator.maxTouchPoints > 1);
}
function isInstalled() {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/**
 * Right after someone signs in or signs up, offer notifications once with a
 * single button. Phones only show their "Allow notifications?" question after
 * a tap, so this is as close to automatic as the platform allows. On an
 * iPhone that hasn't added Nalu to the Home Screen it explains that step,
 * since iOS only allows notifications from the Home Screen app.
 */
export function NotificationPrompt() {
  const { user, signedInAt } = useAuth();
  const [open, setOpen] = useState(false);
  const [needsInstall, setNeedsInstall] = useState(false);
  const [busy, setBusy] = useState(false);
  const save = useServerFn(savePushSubscription);
  const test = useServerFn(sendTestPush);

  useEffect(() => {
    if (!user) return;
    // Already allowed on this phone: sign it up quietly, or, if it's signed up,
    // check its token is still current. Phones renew tokens from time to time,
    // and a stale one would make alerts stop arriving.
    if ("Notification" in window && Notification.permission === "granted") {
      void register(false, { onlyIfChanged: Boolean(readPushPrefs().token) }).catch(() => undefined);
      return;
    }
    if (readPushPrefs().token) return;
    if (read(ASKED_KEY) === "1") return;
    if (!("Notification" in window) && !isIos()) return;
    // "Don't Allow" was chosen before; the phone won't ask again, so don't nag.
    if ("Notification" in window && Notification.permission === "denied") return;
    setNeedsInstall(isIos() && !isInstalled());
    // A beat after sign-in, so it doesn't land on top of the sign-in screen.
    const timer = window.setTimeout(() => setOpen(true), 1200);
    return () => window.clearTimeout(timer);
  }, [user?.id, signedInAt]);

  function close() {
    markAsked();
    setOpen(false);
  }

  /** Get this phone's token and save it. `prompt: false` never shows a question. */
  async function register(prompt: boolean, options: { onlyIfChanged?: boolean } = {}) {
    const result = await obtainPushToken(prompt);
    if (result.status !== "registered") return result;
    const current = readPushPrefs();
    if (options.onlyIfChanged && current.token === result.token) return result;
    const categories = Array.from(new Set([...current.categories, "morning_commute" as const]));
    await save({
      data: {
        token: result.token,
        ...(current.token && current.token !== result.token ? { previousToken: current.token } : {}),
        categories,
        quietStartMin: clockToMinutes(current.quietStart),
        quietEndMin: clockToMinutes(current.quietEnd),
      },
    });
    writePushPrefs({ ...current, categories, token: result.token });
    return result;
  }

  async function turnOn() {
    if (busy) return;
    setBusy(true);
    try {
      const result = await register(true);
      if (result.status !== "registered") {
        toast(BLOCKED_COPY[result.status]);
        close();
        return;
      }
      await test({ data: { token: result.token } }).catch(() => undefined);
      toast.success("Notifications are on. Set your leave times from the card on the home screen.");
      close();
    } catch {
      toast.error("Couldn't turn on notifications. You can try again in Settings.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : close())}>
      <DialogContent className="max-w-sm">
        <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/15 text-primary">
          <BellRing className="size-6" />
        </div>
        <DialogTitle className="text-xl">Know when to leave</DialogTitle>
        <DialogDescription className="text-base leading-7">
          Nalu can send one alert before your commute, when it's time to go, based on live traffic
          and the bus and Skyline times. Nothing else, and you pick the days.
        </DialogDescription>
        {needsInstall ? (
          <p className="text-base leading-7 text-muted-foreground">
            On iPhone, first add Nalu to your Home Screen: tap{" "}
            <Share className="mx-0.5 inline size-4 align-text-bottom text-foreground" aria-label="Share" /> in
            Safari, then <span className="font-semibold text-foreground">Add to Home Screen</span>. Open Nalu
            from there and you'll be able to turn alerts on.
          </p>
        ) : (
          <Button type="button" className="h-14 text-base font-bold" disabled={busy} onClick={() => void turnOn()}>
            Turn on notifications
          </Button>
        )}
        <Button type="button" variant="ghost" className="h-11 text-base" onClick={close}>
          {needsInstall ? "Got it" : "Not now"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
