import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Code2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useIsDeveloper, useRealTier, useTier } from "@/hooks/use-tier";
import { DAILY_TRIP_LIMIT, ENFORCE_TIERS, FEATURE_TIER, writePreviewTier, type Tier } from "@/lib/tiers";
import { readPushPrefs } from "@/lib/push-client";
import { useServerFn } from "@tanstack/react-start";
import { clearProblems, linkDeveloperPhone, listProblems, sendServerTestError, usageStats } from "@/lib/dev.functions";
import { areaName } from "@/lib/problems";
import { REGIONS, activeRegion, switchRegion, type RegionId } from "@/lib/region";

const TIERS: Array<{ value: Tier | null; label: string }> = [
  { value: null, label: "Real" },
  { value: "guest", label: "Guest" },
  { value: "free", label: "Free" },
  { value: "plus", label: "Plus" },
];

function timeAgo(iso: string) {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.round(hours / 24)} days ago`;
}

/** Owner-only developer tools: preview each tier and see what's behind the scenes. */
export function DevPanel() {
  const developer = useIsDeveloper();
  const real = useRealTier();
  const { tier, previewing } = useTier();
  const [open, setOpen] = useState(false);
  const [pushLinked, setPushLinked] = useState(false);
  const [testStatus, setTestStatus] = useState<string | null>(null);
  const serverTest = useServerFn(sendServerTestError);
  const fetchProblems = useServerFn(listProblems);
  const fetchUsage = useServerFn(usageStats);
  const { data: usage } = useQuery({
    queryKey: ["dev-usage"],
    enabled: developer && open,
    staleTime: 60_000,
    queryFn: () => fetchUsage(),
  });
  const clear = useServerFn(clearProblems);
  const linkPhone = useServerFn(linkDeveloperPhone);
  const queryClient = useQueryClient();
  const { data: problems, isLoading: problemsLoading } = useQuery({
    queryKey: ["dev-problems"],
    enabled: developer && open,
    staleTime: 30_000,
    queryFn: () => fetchProblems(),
  });
  // Problem alerts go to developer phones: link this one when the panel opens.
  useEffect(() => {
    const token = readPushPrefs().token;
    if (!developer || !open || !token) return;
    void linkPhone({ data: { token } }).catch(() => undefined);
  }, [developer, open]);
  async function clearProblem(fingerprint?: string) {
    await clear({ data: fingerprint ? { fingerprint } : {} }).catch(() => undefined);
    await queryClient.invalidateQueries({ queryKey: ["dev-problems"] });
  }
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
    window.setTimeout(() => void queryClient.invalidateQueries({ queryKey: ["dev-problems"] }), 2500);
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
            className="max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-2xl border border-border bg-background p-5 text-foreground"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">Developer mode</h2>
              <button type="button" aria-label="Close" onClick={() => setOpen(false)} className="flex size-11 items-center justify-center">
                <X className="size-5" />
              </button>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">Only visible on owner accounts.</p>

            <p className="mt-4 text-sm font-semibold">Weekly users</p>
            {usage ? (
              <div className="mt-2 rounded-lg border border-border p-3">
                <p className="text-2xl font-bold tabular-nums">
                  {usage.weekly_users}
                  <span className="ml-1 text-sm font-medium text-muted-foreground">of 200 for Phase 2</span>
                </p>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                  <div className="h-full bg-primary" style={{ width: `${Math.min(100, (usage.weekly_users / 200) * 100)}%` }} />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Last week {usage.previous_week_users} · today {usage.today_users} · signed in this week{" "}
                  {usage.weekly_signed_in}
                </p>
                <p className="text-xs text-muted-foreground">
                  Accounts {usage.accounts} (+{usage.new_accounts_week} this week) · paying {usage.paying}
                </p>
              </div>
            ) : (
              <p className="mt-1 text-sm text-muted-foreground">Counting…</p>
            )}

            <div className="mt-4 flex items-center justify-between">
              <p className="text-sm font-semibold">Problems</p>
              {problems && problems.length > 0 && (
                <button type="button" onClick={() => void clearProblem()} className="min-h-9 px-2 text-xs font-semibold text-primary">
                  Clear all
                </button>
              )}
            </div>
            {problemsLoading ? (
              <p className="mt-1 text-sm text-muted-foreground">Checking…</p>
            ) : !problems || problems.length === 0 ? (
              <p className="mt-1 text-sm text-muted-foreground">No problems in the last 30 days.</p>
            ) : (
              <ul className="mt-2 grid gap-2">
                {problems.map((problem) => (
                  <li key={problem.fingerprint} className="rounded-lg border border-border px-3 py-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold">
                          {areaName(problem.area)} · {problem.count === 1 ? "once" : `${problem.count} times`}
                        </p>
                        <p className="mt-0.5 break-words text-xs text-muted-foreground">{problem.message}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {problem.source === "app" ? "On a phone" : "On the server"} · last {timeAgo(problem.last_seen)}
                        </p>
                      </div>
                      <button
                        type="button"
                        aria-label="Clear this problem"
                        onClick={() => void clearProblem(problem.fingerprint)}
                        className="flex size-9 shrink-0 items-center justify-center text-muted-foreground"
                      >
                        <X className="size-4" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-2 text-xs text-muted-foreground">
              New problems also send a notification to this phone (once per problem per day).
            </p>

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
