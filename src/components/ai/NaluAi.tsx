import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CalendarCheck, HelpCircle, Sparkles, TrendingUp, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { askNalu, eveningPulse, morningPulse, rushOutlook } from "@/lib/nalu-ai.functions";
import { pulseClocks } from "@/lib/pulse-time.functions";
import { isWeekday, isWithinLocalWindow } from "@/lib/intelligence/pulse-time";
import { speakCommuteAlert } from "@/lib/commute-alerts";
import { weeklyDigest, type WeeklyDigest } from "@/lib/trip-log";
import { createClientRateWindow } from "@/lib/client-rate-limit";

type Place = { lat: number; lon: number; label: string };

function usePulseClocks(home: Place | null, work: Place | null) {
  const fetchClocks = useServerFn(pulseClocks);
  const fallbackTimeZone =
    typeof Intl !== "undefined"
      ? Intl.DateTimeFormat().resolvedOptions().timeZone || "Pacific/Honolulu"
      : "Pacific/Honolulu";

  return useQuery({
    queryKey: ["pulse-clocks-v1", home?.lat, home?.lon, work?.lat, work?.lon],
    enabled: Boolean(home && work),
    staleTime: 5 * 60_000,
    refetchInterval: 5 * 60_000,
    retry: false,
    queryFn: () =>
      fetchClocks({
        data: {
          home: { lat: home!.lat, lon: home!.lon },
          work: { lat: work!.lat, lon: work!.lon },
          fallbackTimeZone,
        },
      }),
  });
}

export function MorningPulse({
  home,
  work,
  trainsEveryMinutes,
}: {
  home: Place | null;
  work: Place | null;
  trainsEveryMinutes: number | null;
}) {
  const { data: clocks } = usePulseClocks(home, work);
  const clock = clocks?.home ?? null;
  const fetchPulse = useServerFn(morningPulse);
  const inWindow = Boolean(clock && isWithinLocalWindow(clock, 6 * 60, 8 * 60));
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
          timezone: clock!.timezone,
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

export function EveningPulse({
  home,
  work,
  trainsEveryMinutes,
}: {
  home: Place | null;
  work: Place | null;
  trainsEveryMinutes: number | null;
}) {
  const { data: clocks } = usePulseClocks(home, work);
  const clock = clocks?.work ?? null;
  const fetchPulse = useServerFn(eveningPulse);
  const inWindow = Boolean(clock && isWithinLocalWindow(clock, 14 * 60, 19 * 60));
  const { data, isLoading } = useQuery({
    queryKey: ["evening-pulse-v1", work?.lat, work?.lon, home?.lat, home?.lon],
    enabled: inWindow && Boolean(home && work),
    staleTime: 2 * 60_000,
    retry: false,
    queryFn: () =>
      fetchPulse({
        data: {
          from: { lat: work!.lat, lon: work!.lon },
          to: { lat: home!.lat, lon: home!.lon },
          destinationLabel: home!.label.slice(0, 30),
          trainsEveryMinutes,
          timezone: clock!.timezone,
        },
      }),
  });
  if (!inWindow || !home || !work) return null;
  const pulseText = data?.ok
    ? data.value.text.replace(
        "Roads look normal right now.",
        "No material delay is showing on your calculated route right now.",
      )
    : null;
  return (
    <section aria-label="Evening Pulse" className="glass-panel mt-3 rounded-lg p-4">
      <div className="flex items-center gap-2">
        <Sparkles className="size-4 text-primary" />
        <p className="text-xs font-semibold uppercase text-muted-foreground">Evening Pulse</p>
        {data?.ok && (
          <Button
            size="icon"
            variant="ghost"
            className="ml-auto size-8"
            aria-label="Read Evening Pulse aloud"
            onClick={() => speakCommuteAlert(data.value.text)}
          >
            <Volume2 className="size-4" />
          </Button>
        )}
      </div>
      <p className="mt-2 text-sm leading-relaxed text-foreground">
        {isLoading ? "Checking your trip home…" : data?.ok ? pulseText : data?.error}
      </p>
    </section>
  );
}

export function BeatTheRush({ home, work }: { home: Place | null; work: Place | null }) {
  const { data: clocks } = usePulseClocks(home, work);
  const homeClock = clocks?.home ?? null;
  const workClock = clocks?.work ?? null;
  const fetchRush = useServerFn(rushOutlook);
  // Evening returns home; otherwise head to work.
  const evening = (workClock?.hour ?? homeClock?.hour ?? 0) >= 13;
  const clock = evening ? workClock : homeClock;
  const from = evening ? work : home;
  const to = evening ? home : work;
  const active = Boolean(clock && isWeekday(clock) && clock.hour >= 5 && clock.hour < 19 && from && to);
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
  return (
    <section role="status" className="mt-3 rounded-lg border border-warning/50 bg-warning/10 p-3">
      <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <TrendingUp className="size-4 text-warning" /> Beat the rush: leave now
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
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const requestGate = useRef(createClientRateWindow(10_000));
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);

  useEffect(() => {
    if (!cooldownUntil) {
      setCooldownRemaining(0);
      return;
    }
    const tick = () => {
      const remaining = Math.max(0, cooldownUntil - Date.now());
      setCooldownRemaining(Math.ceil(remaining / 1000));
      if (remaining === 0) setCooldownUntil(0);
    };
    tick();
    const timer = window.setInterval(tick, 250);
    return () => window.clearInterval(timer);
  }, [cooldownUntil]);
  const [answer, setAnswer] = useState<Awaited<ReturnType<typeof ask>> | null>(null);
  const [showExamples, setShowExamples] = useState(false);

  async function submit() {
    const text = query.trim();
    if (
      busyRef.current ||
      text.length < 4 ||
      !requestGate.current.tryAcquire(Date.now())
    ) return;

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

  function setExample(example: string) {
    setQuery(example);
  }

  return (
    <section
      aria-labelledby="ask-nalu-title"
      className="mt-4 overflow-hidden rounded-2xl border border-primary/30 bg-primary/[0.06] shadow-[0_18px_50px_rgba(0,0,0,.18)]"
    >
      <div className="border-b border-primary/15 px-4 py-4 sm:px-5">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Sparkles className="size-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">Nalu intelligence</p>
            <h2 id="ask-nalu-title" className="mt-1 text-lg font-black tracking-tight text-foreground">
              Tell Nalu what you’re trying to do.
            </h2>
            <p className="mt-1 text-sm leading-5 text-muted-foreground">
              Complicated commute? Just describe it. Nalu works out the stops, timing, rail, bus, and driving for you.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 p-4 sm:p-5">
        <Textarea
          aria-label="Tell Nalu what you're trying to do"
          value={query}
          maxLength={400}
          onChange={(e) => {
            setQuery(e.target.value);
          }}
          placeholder="I need to drop my son off first, then be downtown by 8."
          className="min-h-24 resize-none border-white/10 bg-background/70"
        />

        <p className="text-xs text-muted-foreground">No need to pick a place — type the whole request naturally and Nalu will resolve the places for you.</p>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setShowExamples((value) => !value)}
            aria-expanded={showExamples}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
          >
            <HelpCircle className="size-3.5" />
            Need an idea?
          </button>
        </div>

        {showExamples && (
          <div className="flex flex-wrap gap-2" aria-label="Ask Nalu examples">
            {[
              "I need to be downtown by 8.",
              "Two stops before work.",
              "Should I drive or take Skyline?",
            ].map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => setExample(example)}
                className="rounded-full border border-white/10 bg-white/[0.035] px-3 py-1.5 text-left text-xs font-medium text-muted-foreground transition hover:border-primary/30 hover:text-foreground"
              >
                {example}
              </button>
            ))}
          </div>
        )}

        <Button
          onClick={() => void submit()}
          disabled={
            busy ||
            cooldownUntil > 0 ||
            query.trim().length < 4
          }
          className="w-full sm:w-auto sm:justify-self-start"
        >
          {busy ? "Planning…" : cooldownRemaining > 0 ? "Try again in " + cooldownRemaining + "s" : "Ask Nalu"}
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
          <div className="rounded-xl border border-white/10 bg-surface-raised/80 p-4 text-sm" aria-live="polite">
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
    </section>
  );
}

export function WeeklyDigestCard() {
  const timezone =
    typeof Intl !== "undefined"
      ? Intl.DateTimeFormat().resolvedOptions().timeZone || "Pacific/Honolulu"
      : "Pacific/Honolulu";
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
    hour: "numeric",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const clock = { weekday: parts.find((part) => part.type === "weekday")?.value ?? "" };
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
