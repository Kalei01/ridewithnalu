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
          <span className="text-sm font-semibold">Share anonymous usage stats</span>
          <span className="text-xs font-normal text-muted-foreground">
            Which features get used, never where you go.
          </span>
        </Label>
        <Switch
          id="analytics-consent"
          checked={consent === "granted"}
          onCheckedChange={(on) => setAnalyticsConsent(on ? "granted" : "denied")}
        />
      </div>
      <ul className="grid gap-1.5 text-xs leading-relaxed text-muted-foreground">
        <li>Your GPS position is used on this device for live directions and is never sent to analytics.</li>
        <li>Home, work and other saved addresses are never included in usage stats.</li>
        <li>Traffic and route lookups send only the start and end points needed to plan the trip.</li>
      </ul>
    </section>
  );
}

/** One-time, dismissible ask shown on the home screen. */
export function AnalyticsConsentBanner() {
  const consent = useConsent();
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  if (!ready || consent !== null) return null;
  return (
    <div
      role="region"
      aria-label="Usage stats"
      className="glass-panel mt-4 rounded-lg border border-border p-3 text-xs text-muted-foreground"
    >
      <p>
        Help improve Nalu with anonymous usage stats? We never collect your location or addresses.
        You can change this anytime in Settings.
      </p>
      <div className="mt-2 flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={() => setAnalyticsConsent("denied")}>
          No thanks
        </Button>
        <Button size="sm" onClick={() => setAnalyticsConsent("granted")}>
          Allow
        </Button>
      </div>
    </div>
  );
}
