import { useEffect, useMemo, useState } from "react";
import { CloudRain, Car, TrainFront } from "lucide-react";
import { featuredTraffic, stripItems, type StripItem } from "@/lib/home/home-now";
import { homeLineFor } from "@/lib/home/home-line";
import { honoluluNowSeconds, useHomeLive } from "./use-home-live";

const ICONS: Record<StripItem["id"], typeof Car> = {
  traffic: Car,
  skyline: TrainFront,
  showers: CloudRain,
};

/** Re-renders every `ms` so "checked 2 min ago" and the next train stay true. */
function useTick(ms: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), ms);
    return () => window.clearInterval(timer);
  }, [ms]);
  return now;
}

function agoText(fromMs: number, nowMs: number) {
  const minutes = Math.floor((nowMs - fromMs) / 60_000);
  if (minutes < 1) return "checked just now";
  return `checked ${minutes} min ago`;
}

/**
 * "Right now on Oʻahu": a small live strip, led by Nalu's one friendly line.
 * Each item is a real check and unchecked items are left out. The row has a
 * fixed height from the first paint, so the page never jumps when it fills in.
 */
export function LiveStrip() {
  const { data, isLoading, isError } = useHomeLive();
  const now = useTick(30_000);
  const seconds = data ? honoluluNowSeconds(data, now) : 0;
  const items = useMemo(() => (data ? stripItems(data, seconds) : []), [data, seconds]);
  const line = data ? homeLineFor(data, seconds) : null;
  const card =
    "nh-fade-in flex h-[6.5rem] w-[15.5rem] shrink-0 flex-col justify-center rounded-2xl bg-white/[0.045] px-4";
  return (
    <section aria-labelledby="right-now" className="mt-7">
      <div className="flex items-center justify-between gap-3">
        <h2
          id="right-now"
          className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.14em] text-muted-foreground"
        >
          <span className="nh-live-dot" aria-hidden="true" />
          Right now on Oʻahu
        </h2>
        {data && (
          <span className="text-xs text-muted-foreground">
            {agoText(
              Math.min(
                data.generatedAt,
                featuredTraffic(data, seconds)?.fetchedAt ?? data.generatedAt,
              ),
              now,
            )}
          </span>
        )}
      </div>
      <ul className="nh-rail-scroll mt-3" aria-live="polite">
        {isLoading &&
          [0, 1].map((row) => (
            <li key={row} className={`${card} gap-3`} aria-hidden="true">
              <span className="nh-skeleton h-5 w-20" />
              <span className="nh-skeleton h-4 w-full" />
            </li>
          ))}
        {line && (
          <li key={line} className={`${card} border border-[var(--color-recommended)]/25`}>
            <span className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--color-recommended)]">
              Nalu says
            </span>
            <span className="mt-1 text-base font-semibold leading-6">{line}</span>
          </li>
        )}
        {items.map((item) => {
          const Icon = ICONS[item.id];
          return (
            <li key={item.id} className={card}>
              <span className="flex items-center gap-1.5 text-sm font-bold">
                <Icon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                {item.label}
              </span>
              <span className="mt-1 text-[0.95rem] leading-6 text-foreground/90">{item.text}</span>
            </li>
          );
        })}
        {!isLoading && items.length === 0 && (
          <li className={`${card} w-full`}>
            <span className="text-[0.95rem] leading-6 text-muted-foreground">
              {isError
                ? "Live checks aren’t answering right now. The planner still works: tap Where to?"
                : "Nothing live to report right now. The planner still checks every trip."}
            </span>
          </li>
        )}
      </ul>
    </section>
  );
}
