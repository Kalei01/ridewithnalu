import { useEffect, useState } from "react";
import { Share, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const VISITS_KEY = "nalu-visits-v1";
const DISMISSED_KEY = "nalu-install-dismissed-v1";
const DISMISS_DAYS = 30;

type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<unknown> };

function read(key: string) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* private mode: the card simply shows again next time */
  }
}

function isInstalled() {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIos() {
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) || (ua.includes("Mac") && navigator.maxTouchPoints > 1);
}

/**
 * "Add Nalu to your Home Screen", shown from the second visit on, never once
 * installed, and hidden for a month after "Not now". iPhones never prompt on
 * their own, so they get the two taps spelled out; Android gets a button.
 */
export function InstallNaluCard() {
  const [mode, setMode] = useState<"ios" | "prompt" | null>(null);
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);

  useEffect(() => {
    if (isInstalled()) return;
    const visits = Number(read(VISITS_KEY) ?? "0") + 1;
    write(VISITS_KEY, String(visits));
    const dismissedAt = Number(read(DISMISSED_KEY) ?? "0");
    if (visits < 2 || Date.now() - dismissedAt < DISMISS_DAYS * 86_400_000) return;

    if (isIos()) {
      setMode("ios");
      return;
    }
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as InstallPromptEvent);
      setMode("prompt");
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (!mode) return null;

  const dismiss = () => {
    write(DISMISSED_KEY, String(Date.now()));
    setMode(null);
  };

  return (
    <section
      aria-label="Add Nalu to your Home Screen"
      className="relative mt-4 rounded-lg border border-primary/30 bg-primary/10 p-4 pr-12"
    >
      <button
        type="button"
        onClick={dismiss}
        aria-label="Not now"
        className="absolute right-1 top-1 flex size-11 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
      >
        <X className="size-4" />
      </button>
      <p className="text-base font-semibold text-foreground">Add Nalu to your Home Screen</p>
      {mode === "ios" ? (
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          Tap <Share className="mx-0.5 inline size-4 align-text-bottom text-foreground" aria-label="Share" />{" "}
          at the bottom of Safari, then <span className="font-semibold text-foreground">Add to Home Screen</span>.
          Nalu opens like an app, one tap away.
        </p>
      ) : (
        <>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Open Nalu like an app, one tap away from your Home Screen.
          </p>
          <Button
            type="button"
            className="mt-3 h-11"
            onClick={async () => {
              if (!promptEvent) return;
              await promptEvent.prompt();
              await promptEvent.userChoice.catch(() => undefined);
              setMode(null);
            }}
          >
            Install Nalu
          </Button>
        </>
      )}
    </section>
  );
}
