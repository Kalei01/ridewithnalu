import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Code2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useIsDeveloper, useRealTier, useTier } from "@/hooks/use-tier";
import { DAILY_TRIP_LIMIT, ENFORCE_TIERS, FEATURE_TIER, writePreviewTier, type Tier } from "@/lib/tiers";
import { readPushPrefs } from "@/lib/push-client";
import { useServerFn } from "@tanstack/react-start";
import { sendServerTestError } from "@/lib/dev.functions";
import { REGIONS, activeRegion, switchRegion, type RegionId } from "@/lib/region";

const TIERS: Array<{ value: Tier | null; label: string }> = [
  { value: null, label: "Real" },
  { value: "guest", label: "Guest" },
  { value: "free", label: "Free" },
  { value: "plus", label: "Plus" },
];

/** Owner-only developer tools: preview each tier and see what's behind the scenes. */
export function DevPanel() {
  const developer = useIsDeveloper();
  const real = useRealTier();
  const { tier, previewing } = useTier();
  const [open, setOpen] = useState(false);
  const [pushLinked, setPushLinked] = useState(false);
  const [testStatus, setTestStatus] = useState<string | null>(null);
  const serverTest = useServerFn(sendServerTestError);
  async function sendTestErrors() {
    setTestStatus("Sending…");
    const parts: string[] = [];
    try {
      const Sentry = await import("@sentry/react");
      if (!Sentry.getClient()) parts.push("app: reporting is off (no DSN in this build)");
      else {
        Sentry.captureException(new Error("Nalu test error (app). Safe to resolve."));
        await Sentry.flush(3000);
        parts.push("app: sent");
      }
    } catch {
      parts.push("app: failed");
    }
    try {
      await serverTest();
      parts.push("server: sent");
    } catch {
      parts.push("server: failed");
    }
    setTestStatus(parts.join(" · "));
  }
  useEffect(() => setPushLinked(Boolean(readPushPrefs().token)), [open]);
  const { data: expiry } = useQuery({
    queryKey: ["dev-gtfs-expiry"],
    enabled: developer && open,
    queryFn: async () => {
      const { data } = await supabase.rpc("gtfs_data_expiry");
      return (data as Array<{ expires_on: string; days_remaining: number }> | null)?.[0] ?? null;
    },
  });

  if (!developer) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Developer mode"
        className={`fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-3 z-[1000] flex h-10 items-center gap-1.5 rounded-full border px-3 text-xs font-bold shadow-lg backdrop-blur-md ${previewing ? "border-warning bg-warning/20 text-warning" : "border-border bg-background/80 text-muted-foreground"}`}
      >
        <Code2 className="size-4" /> {previewing ? `Viewing as ${tier}` : "Dev"}
      </button>
      {open && (
        <div className="fixed inset-0 z-[1001] flex items-end justify-center bg-black/60 p-3" onClick={() => setOpen(false)}>
          <section
            role="dialog"
            aria-label="Developer mode"
            className="w-full max-w-md rounded-2xl border border-border bg-background p-5 text-foreground"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">Developer mode</h2>
              <button type="button" aria-label="Close" onClick={() => setOpen(false)} className="flex size-11 items-center justify-center">
                <X className="size-5" />
              </button>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">Only visible on owner accounts.</p>

            <p className="mt-4 text-sm font-semibold">Error reporting (Sentry)</p>
            <button
              type="button"
              onClick={() => void sendTestErrors()}
              className="mt-2 h-11 w-full rounded-lg border border-border text-sm font-semibold"
            >
              Send test error
            </button>
            {testStatus && <p className="mt-1 text-xs text-muted-foreground">{testStatus}</p>}

            <p className="mt-4 text-sm font-semibold">Region (test)</p>
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              {(Object.keys(REGIONS) as RegionId[]).map((id) => {
                const on = activeRegion().id === id;
                return (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => {
                      if (!on) switchRegion(id);
                    }}
                    className={`h-11 rounded-lg text-sm font-semibold ${on ? "bg-primary text-primary-foreground" : "border border-border"}`}
                  >
                    {id === "oahu" ? "Oʻahu" : "San Francisco"}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              San Francisco is a test on this phone only: driving, Uber/Lyft and walking. No SF bus or train times yet.
            </p>

            <p className="mt-4 text-sm font-semibold">View the app as</p>
            <div className="mt-2 grid grid-cols-4 gap-1.5">
              {TIERS.map((option) => {
                const on = option.value === null ? !previewing : previewing && tier === option.value;
                return (
                  <button
                    key={option.label}
                    type="button"
                    aria-pressed={on}
                    onClick={() => writePreviewTier(option.value)}
                    className={`h-11 rounded-lg text-sm font-semibold ${on ? "bg-primary text-primary-foreground" : "border border-border"}`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Previewing shows that tier's limits on this phone only, even before limits are switched on.
            </p>

            <dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm">
              <dt className="text-muted-foreground">Your real tier</dt>
              <dd className="font-semibold">{real}</dd>
              <dt className="text-muted-foreground">Limits switched on</dt>
              <dd className="font-semibold">{ENFORCE_TIERS ? "Yes" : "No (everyone gets everything)"}</dd>
              <dt className="text-muted-foreground">Timetable valid until</dt>
              <dd className="font-semibold">{expiry ? `${expiry.expires_on} (${expiry.days_remaining} days)` : "…"}</dd>
              <dt className="text-muted-foreground">Notifications on this phone</dt>
              <dd className="font-semibold">{pushLinked ? "Linked" : "Not linked"}</dd>
            </dl>

            <details className="mt-4">
              <summary className="cursor-pointer text-sm font-semibold">Draft tier lineup</summary>
              <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                {Object.entries(FEATURE_TIER).map(([feature, minTier]) => (
                  <li key={feature} className="flex justify-between gap-3">
                    <span>{feature.replace(/_/g, " ")}</span>
                    <span className="font-semibold text-foreground">{minTier}+</span>
                  </li>
                ))}
                <li className="flex justify-between gap-3">
                  <span>guest trip checks per day</span>
                  <span className="font-semibold text-foreground">{DAILY_TRIP_LIMIT.guest}</span>
                </li>
              </ul>
            </details>
          </section>
        </div>
      )}
    </>
  );
}
