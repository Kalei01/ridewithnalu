import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  onAnalyticsConsentChange,
  readAnalyticsConsent,
  setAnalyticsConsent,
  type AnalyticsConsent,
} from "@/lib/analytics";

function useConsent() {
  const [consent, setConsent] = useState<AnalyticsConsent>(null);
  useEffect(() => {
    setConsent(readAnalyticsConsent());
    return onAnalyticsConsentChange(() => setConsent(readAnalyticsConsent()));
  }, []);
  return consent;
}

export function PrivacySection() {
  const consent = useConsent();
  return (
    <section className="grid gap-3 border-t border-border pt-6" aria-labelledby="privacy-title">
      <h3 id="privacy-title" className="flex items-center gap-2 text-sm font-bold text-foreground">
        <ShieldCheck className="size-4 text-primary" /> Privacy & data
      </h3>
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor="analytics-consent" className="grid gap-0.5">
          <span className="text-sm font-semibold">Share anonymous product usage stats</span>
          <span className="text-xs font-normal text-muted-foreground">
            Which features are used. Analytics does not receive your GPS position or saved addresses.
          </span>
        </Label>
        <Switch
          id="analytics-consent"
          checked={consent === "granted"}
          onCheckedChange={(on) => setAnalyticsConsent(on ? "granted" : "denied")}
        />
      </div>
      <ul className="grid gap-1.5 text-xs leading-relaxed text-muted-foreground">
        <li>
          Your GPS position is used on this device for live directions and is never sent to
          analytics.
        </li>
        <li>Home, work and other saved addresses are never included in usage stats.</li>
        <li>
          Traffic and route lookups send only the start and end points needed to plan the trip.
        </li>
        <li>
          Trip diagnostics (reroutes, spoken turns, errors — no addresses or GPS) are kept for 48
          hours to fix navigation bugs.
        </li>
      </ul>
      <PurgeDiagnostics />
    </section>
  );
}

function PurgeDiagnostics() {
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="justify-self-start"
      disabled={state === "busy"}
      onClick={async () => {
        setState("busy");
        const { purgeMyDebugLogs } = await import("@/lib/debug-log");
        setState((await purgeMyDebugLogs().catch(() => false)) ? "done" : "error");
      }}
    >
      {state === "done"
        ? "Diagnostics deleted"
        : state === "error"
          ? "Couldn't delete — try again"
          : "Delete my trip diagnostics now"}
    </Button>
  );
}
