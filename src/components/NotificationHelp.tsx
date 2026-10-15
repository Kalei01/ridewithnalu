import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { Check, Share } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

/**
 * Shown when a phone has notifications blocked for Nalu. Phones never ask a
 * second time, and web apps can't open the phone's Settings, so this walks the
 * rider through it and re-checks when they come back.
 */
type Request = {
  /** Finish the sign-up the caller would have done. May return a message for the success toast. */
  onGranted: () => Promise<string | void>;
};

let current: Request | null = null;
const listeners = new Set<() => void>();
function emit(next: Request | null) {
  current = next;
  listeners.forEach((fn) => fn());
}
export function openNotificationHelp(request: Request) {
  emit(request);
}

type Kind = "iphone-app" | "iphone-browser" | "android" | "desktop";

function detectKind(): Kind {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua) || (ua.includes("Mac") && navigator.maxTouchPoints > 1)) {
    const installed =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    return installed ? "iphone-app" : "iphone-browser";
  }
  return /Android/.test(ua) ? "android" : "desktop";
}

/** A tiny stand-in for an iOS Settings row. Drawn, not a screenshot. */
function SettingsRow({
  label,
  toggle,
  chevron,
}: {
  label: string;
  toggle?: boolean;
  chevron?: boolean;
}) {
  return (
    <div
      aria-hidden="true"
      className="flex h-11 items-center justify-between rounded-xl border border-border bg-muted/60 px-3 text-sm font-medium text-foreground"
    >
      <span>{label}</span>
      {toggle && (
        <span className="relative h-[26px] w-[44px] rounded-full bg-[#34C759]">
          <span className="absolute right-[2px] top-[2px] size-[22px] rounded-full bg-white shadow" />
        </span>
      )}
      {chevron && <span className="text-lg leading-none text-muted-foreground">›</span>}
    </div>
  );
}

function Step({ n, children, art }: { n: number; children: ReactNode; art?: ReactNode }) {
  return (
    <li className="grid gap-2">
      <div className="flex gap-3">
        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-bold text-primary">
          {n}
        </span>
        <p className="text-base leading-6 text-foreground">{children}</p>
      </div>
      {art && <div className="pl-9">{art}</div>}
    </li>
  );
}

function Steps({ kind }: { kind: Kind }) {
  if (kind === "iphone-browser")
    return (
      <ol className="grid gap-4">
        <Step
          n={1}
          art={
            <div
              aria-hidden="true"
              className="flex h-11 items-center justify-center rounded-xl border border-border bg-muted/60"
            >
              <Share className="size-5 text-[#0A84FF]" />
            </div>
          }
        >
          In Safari, tap Share.
        </Step>
        <Step n={2}>
          Tap <b>Add to Home Screen</b>.
        </Step>
        <Step n={3}>Open Nalu from your Home Screen, then turn on notifications there.</Step>
      </ol>
    );
  if (kind === "iphone-app")
    return (
      <ol className="grid gap-4">
        <Step n={1} art={<SettingsRow label="Nalu" chevron />}>
          Open the <b>Settings</b> app, tap <b>Notifications</b>, then tap <b>Nalu</b>.
        </Step>
        <Step n={2} art={<SettingsRow label="Allow Notifications" toggle />}>
          Turn on <b>Allow Notifications</b>.
        </Step>
        <Step n={3}>Come back to Nalu and tap Check again.</Step>
      </ol>
    );
  if (kind === "android")
    return (
      <ol className="grid gap-4">
        <Step n={1}>Long-press the Nalu icon, or tap the icon left of the web address.</Step>
        <Step n={2}>
          Tap <b>Notifications</b>, then <b>Allow</b>.
        </Step>
        <Step n={3}>Come back to Nalu and tap Check again.</Step>
      </ol>
    );
  return (
    <ol className="grid gap-4">
      <Step n={1}>
        Open your browser's site settings for Nalu (the icon left of the web address).
      </Step>
      <Step n={2}>
        Set <b>Notifications</b> to <b>Allow</b>.
      </Step>
      <Step n={3}>Come back here and tap Check again.</Step>
    </ol>
  );
}

/** Mount once, near the app root. */
export function NotificationHelpHost() {
  const request = useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => current,
    () => null,
  );
  const [kind, setKind] = useState<Kind>("desktop");
  const [stillBlocked, setStillBlocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  useEffect(() => {
    if (request) {
      setKind(detectKind());
      setStillBlocked(false);
    }
  }, [request]);

  const check = useCallback(
    async (manual: boolean) => {
      if (!request || busyRef.current) return;
      const granted = "Notification" in window && Notification.permission === "granted";
      if (!granted) {
        if (manual) setStillBlocked(true);
        return;
      }
      busyRef.current = true;
      setBusy(true);
      try {
        const message = await request.onGranted();
        toast.success(message || "Notifications are on.");
        emit(null);
      } catch {
        toast.error("Couldn't turn on notifications. Try again.");
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [request],
  );

  useEffect(() => {
    if (!request) return;
    const onVisible = () => {
      if (document.visibilityState === "visible") void check(false);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [request, check]);

  return (
    <Dialog open={Boolean(request)} onOpenChange={(open) => !open && emit(null)}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-sm overflow-y-auto pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <DialogTitle className="pr-6 text-xl leading-snug">
          {kind === "iphone-browser"
            ? "Add Nalu to your Home Screen"
            : "Notifications are off for Nalu"}
        </DialogTitle>
        <DialogDescription className="text-base leading-6">
          {kind === "iphone-browser"
            ? "iPhone only allows alerts from the Home Screen app."
            : "Your phone won't ask again, so it takes a quick trip to Settings."}
        </DialogDescription>
        <Steps kind={kind} />
        {kind !== "iphone-browser" && (
          <div className="grid gap-2" aria-live="polite">
            <Button
              type="button"
              className="h-12 gap-2 text-base font-bold"
              disabled={busy}
              onClick={() => void check(true)}
            >
              <Check className="size-4" /> Check again
            </Button>
            {stillBlocked && (
              <p className="text-center text-sm text-muted-foreground">
                Still blocked. Nalu will check again when you come back.
              </p>
            )}
          </div>
        )}
        <Button type="button" variant="ghost" className="h-11 text-base" onClick={() => emit(null)}>
          {kind === "iphone-browser" ? "Got it" : "Not now"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
