import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CalendarCheck, Sparkles, TrendingUp, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { askNalu, morningPulse, rushOutlook } from "@/lib/nalu-ai.functions";
import { speakCommuteAlert } from "@/lib/commute-alerts";
import { weeklyDigest, type WeeklyDigest } from "@/lib/trip-log";
import { createClientRateWindow } from "@/lib/client-rate-limit";

type Place = { lat: number; lon: number; label: string };

function honoluluNow() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Pacific/Honolulu",
    weekday: "short",
    hour: "numeric",
    hourCycle: "h23",
  }).formatToParts(new Date());
  return {
    weekday: parts.find((p) => p.type === "weekday")?.value ?? "",
    hour: Number(parts.find((p) => p.type === "hour")?.value ?? 0),
  };
}

function useHonoluluClock() {
  const [now, setNow] = useState<ReturnType<typeof honoluluNow> | null>(null);
  useEffect(() => {
    setNow(honoluluNow());
    const t = window.setInterval(() => setNow(honoluluNow()), 5 * 60_000);
    return () => window.clearInterval(t);
  }, []);
  return now;
}

const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri"];

export function MorningPulse({
  home,
  work,
  trainsEveryMinutes,
}: {
  home: Place | null;
  work: Place | null;
  trainsEveryMinutes: number | null;
}) {
  const clock = useHonoluluClock();
  const fetchPulse = useServerFn(morningPulse);
  const inWindow = Boolean(
    clock && weekdays.includes(clock.weekday) && clock.hour >= 6 && clock.hour < 8,
  );
  const { data, isLoading } = useQuery({
    queryKey: ["morning-pulse-v2", home?.lat, home?.lon, work?.lat, work?.lon],
    enabled: inWindow && Boolean(home && work),
    staleTime: 2 * 60_000,
    retry: false,
    queryFn: () =>
      fetchPulse({
        data: {
          from: { lat: home!.lat, lon: home!.lon },
          to: { lat: work!.lat, lon: work!.lon },
          destinationLabel: work!.label.slice(0, 30),
          trainsEveryMinutes,
        },
      }),
  });
  if (!inWindow || !home || !work) return null;
  return (
    <section aria-label="Morning Pulse" className="glass-panel mt-3 rounded-lg p-4">
      <div className="flex items-center gap-2">
        <Sparkles className="size-4 text-primary" />
        <p className="text-xs font-semibold uppercase text-muted-foreground">Morning Pulse</p>
        {data?.ok && (
          <Button
            size="icon"
            variant="ghost"
            className="ml-auto size-8"
            aria-label="Read Morning Pulse aloud"
            onClick={() => speakCommuteAlert(data.value.text)}
          >
            <Volume2 className="size-4" />
          </Button>
        )}
      </div>
      <p className="mt-2 text-sm leading-relaxed text-foreground">
        {isLoading ? "Checking your commute…" : data?.ok ? data.value.text : data?.error}
      </p>
    </section>
  );
}

export function BeatTheRush({ home, work }: { home: Place | null; work: Place | null }) {
  const clock = useHonoluluClock();
  const fetchRush = useServerFn(rushOutlook);
  // Evening returns home; otherwise head to work.
  const evening = (clock?.hour ?? 0) >= 13;
  const from = evening ? work : home;
  const to = evening ? home : work;
  const active = Boolean(clock && clock.hour >= 5 && clock.hour < 19 && from && to);
  const { data } = useQuery({
    queryKey: ["rush", from?.lat, from?.lon, to?.lat, to?.lon],
    enabled: active,
    staleTime: 10 * 60_000,
    refetchInterval: 10 * 60_000,
    retry: false,
    queryFn: () =>
      fetchRush({
        data: { from: { lat: from!.lat, lon: from!.lon }, to: { lat: to!.lat, lon: to!.lon } },
      }),
  });
  if (!active || !data?.warn) return null;
  const leaveBy = new Date(Date.now() + 10 * 60_000).toLocaleTimeString("en-US", {
    timeZone: "Pacific/Honolulu",
    hour: "numeric",
    minute: "2-digit",
  });
  return (
    <section role="status" className="mt-3 rounded-lg border border-warning/50 bg-warning/10 p-3">
      <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <TrendingUp className="size-4 text-warning" /> Beat the rush: leave before {leaveBy}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        {data.delayMinutes} min slower than usual
        {data.roads?.length ? ` on ${data.roads.join(", ")}` : ""}, and it's building —{" "}
        {data.nowMinutes} min now vs {data.laterMinutes} min in 30 min.
      </p>
    </section>
  );
}

export function AskNalu({ origin }: { origin: { lat: number; lon: number } | null }) {
  const ask = useServerFn(askNalu);
  const [query, setQuery] = useState("");
  const [settledQuery, setSettledQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const requestGate = useRef(createClientRateWindow(10_000));
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [answer, setAnswer] = useState<Awaited<ReturnType<typeof ask>> | null>(null);
  useEffect(() => {
    const timer = window.setTimeout(() => setSettledQuery(query.trim()), 350);
    return () => window.clearTimeout(timer);
  }, [query]);
  useEffect(() => {
    if (!cooldownUntil) return;
    const timer = window.setTimeout(() => setCooldownUntil(0), Math.max(0, cooldownUntil - Date.now()));
    return () => window.clearTimeout(timer);
  }, [cooldownUntil]);
  async function submit() {
    const text = query.trim();
    if (busyRef.current || text.length < 4 || text !== settledQuery ||
      !requestGate.current.tryAcquire(Date.now())) return;
    busyRef.current = true;
    setCooldownUntil(Date.now() + 10_000);
    setBusy(true);
    setAnswer(null);
    try {
      setAnswer(await ask({ data: { query: text, origin } }));
    } catch {
      setAnswer({ ok: false, error: "Nalu couldn't answer that right now." });
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  return (
    <details className="glass-panel mt-3 rounded-lg">
      <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
        <Sparkles className="size-5 text-primary" />
        <span className="font-semibold text-foreground">Ask Nalu</span>
        <span className="ml-auto text-xs text-muted-foreground">Plan multi-stop trips</span>
      </summary>
      <div className="grid gap-3 border-t border-border p-4">
        <Textarea
          aria-label="Describe your trip"
          value={query}
          maxLength={400}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Drop off at Campbell High by 7:15, then Ala Moana by 8:00 — drive or park and ride?"
          className="min-h-20 bg-background"
        />
        <Button onClick={() => void submit()}
          disabled={busy || cooldownUntil > 0 || query.trim().length < 4 || query.trim() !== settledQuery}>
          {busy ? "Planning…" : cooldownUntil > 0 ? "Ready again shortly" : "Ask Nalu"}
        </Button>
        {!origin && (
          <p className="text-xs text-muted-foreground">
            Tip: allow location so Nalu knows where you're starting.
          </p>
        )}
        {answer && !answer.ok && (
          <p role="alert" className="text-sm text-warning">
            {answer.error}
          </p>
        )}
        {answer?.ok && (
          <div className="rounded-md bg-surface-raised p-3 text-sm" aria-live="polite">
            <p className="font-semibold text-foreground">{answer.value.recommendation}</p>
            <p className="mt-1 text-primary">Leave by {answer.value.leaveBy}</p>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted-foreground">
              {answer.value.steps.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ol>
            {answer.value.caveat && (
              <p className="mt-2 text-xs text-muted-foreground">{answer.value.caveat}</p>
            )}
          </div>
        )}
      </div>
    </details>
  );
}

export function WeeklyDigestCard() {
  const clock = useHonoluluClock();
  const [digest, setDigest] = useState<WeeklyDigest | null>(null);
  useEffect(() => setDigest(weeklyDigest()), []);
  if (!clock || !["Fri", "Sat"].includes(clock.weekday) || !digest) return null;
  return (
    <section aria-label="Weekly commute digest" className="glass-panel mt-3 rounded-lg p-4">
      <p className="flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">
        <CalendarCheck className="size-4 text-primary" /> Your week
      </p>
      <p className="mt-2 text-sm text-foreground">
        {digest.trips} trip{digest.trips === 1 ? "" : "s"} ({digest.driveTrips} drive,{" "}
        {digest.railTrips} Skyline) · about {digest.averageMinutes} min each.
      </p>
      <p className="mt-1 text-sm text-primary">
        {digest.minutesSaved > 0
          ? `Picking the faster mode saved you about ${digest.minutesSaved} min.`
          : "Your picks matched the faster option all week."}
      </p>
      <p className="mt-2 text-[10px] text-muted-foreground">Calculated on this device only.</p>
    </section>
  );
}
