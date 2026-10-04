/**
 * The H-1 live conditions card (Browse screen): eastbound/westbound TomTom
 * status, the current incident breakdown, and the weather/air tone helpers
 * that color weather lines across the app.
 */

import { ChevronDown } from "lucide-react";
import type { DriveTime } from "@/lib/drive.functions";
import {
  incidentFreshness,
  mainlineClearNote,
  standaloneIncidentCause,
  standaloneIncidentClearance,
  standaloneIncidentCondition,
  standaloneIncidentImpact,
  standaloneIncidentLocation,
} from "@/lib/traffic-incidents";

export type WeatherLine = { text: string; tone: "rain" | "heat" | "air"; source: string };

export const TONE_CLASS: Record<WeatherLine["tone"], string> = {
  rain: "text-alert-rain",
  heat: "text-alert-heat",
  air: "text-alert-air",
};

export function airLine(category: number): WeatherLine | null {
  if (category === 2) {
    return {
      text: "Air quality: Moderate · sensitive groups limit outdoor time",
      tone: "rain",
      source: "AirNow / EPA",
    };
  }
  if (category === 3) {
    return {
      text: "Air quality: Poor · limit outdoor exposure if sensitive",
      tone: "air",
      source: "AirNow / EPA",
    };
  }
  if (category >= 4) {
    return {
      text: "Air quality: Unhealthy · minimize time outdoors",
      tone: "air",
      source: "AirNow / EPA",
    };
  }
  return null;
}

export function trafficStatus(delayMinutes: number, incident?: DriveTime["incidents"][number]) {
  const delay = Math.max(0, Math.round(delayMinutes));
  if (incident) {
    const condition = standaloneIncidentCondition(incident);
    return {
      label: `${condition}${incident.road ? ` · ${incident.road}` : ""}`,
      className: "text-destructive",
    };
  }
  if (delay === 0) return { label: "Clear", className: "text-primary" };
  if (delay > 20) return { label: `Heavy traffic · +${delay} min`, className: "text-destructive" };
  if (delay >= 10) return { label: `Slower than usual · +${delay} min`, className: "text-chart-4" };
  return { label: `Slightly slower · +${delay} min`, className: "text-foreground" };
}

export function H1ConditionsCard({
  eastbound,
  westbound,
  loading,
  unavailable,
  weatherLine,
  compact = false,
  className = "mt-4",
}: {
  eastbound: DriveTime | undefined;
  westbound: DriveTime | undefined;
  loading: boolean;
  unavailable: boolean;
  weatherLine?: WeatherLine | null;
  compact?: boolean;
  /** Outer spacing for the compact card. */
  className?: string;
}) {
  const rows = [
    { label: "Eastbound", data: eastbound },
    { label: "Westbound", data: westbound },
  ];

  const Incident = ({ direction, data }: { direction: string; data: DriveTime }) => {
    const incident = data.incidents[0];
    if (!incident) return null;
    const condition = standaloneIncidentCondition(incident);
    const road = incident.road ?? "On this route";
    const location = standaloneIncidentLocation(incident);
    const cause = standaloneIncidentCause(incident);
    const clearance = standaloneIncidentClearance(incident);
    const freshness = incidentFreshness(data.fetchedAt);
    const note = mainlineClearNote(incident, data.delayMinutes);

    return (
      <div className="mt-3 rounded-xl border border-border bg-background/50 p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-bold text-foreground">
              {direction} · {condition}
            </p>
            <p className="mt-0.5 text-xs font-semibold text-muted-foreground">{road}</p>
          </div>
          <span className="shrink-0 rounded-full bg-warning/10 px-2 py-1 text-xs font-bold uppercase tracking-wide text-warning">
            Live alert
          </span>
        </div>
        {location && (
          <p className="mt-2 text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">Location:</span> {location}
          </p>
        )}
        <p className="mt-1 text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">Cause:</span> {cause}
        </p>
        <p className="mt-1 text-xs font-medium text-muted-foreground">
          {standaloneIncidentImpact(incident, data.delayMinutes)}
        </p>
        {note && <p className="mt-1 text-xs text-muted-foreground">{note}</p>}
        {clearance && <p className="mt-1 text-xs text-muted-foreground">{clearance}</p>}
        <p className="mt-2 text-xs text-muted-foreground">{freshness}</p>
      </div>
    );
  };

  if (compact) {
    return (
      <details className={`${className} rounded-lg border border-border bg-surface-raised/70`}>
        <summary className="flex min-h-14 cursor-pointer list-none items-center gap-2 px-4 py-3 [&::-webkit-details-marker]:hidden">
          <span className="whitespace-nowrap font-semibold text-foreground">H-1 live</span>
          <span className="ml-auto flex flex-wrap justify-end gap-2">
            {loading ? (
              <span className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                Checking traffic…
              </span>
            ) : unavailable ? (
              <span className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                Not available
              </span>
            ) : (
              rows.map(({ label, data }) => {
                const status = data ? trafficStatus(data.delayMinutes, data.incidents[0]) : null;
                return (
                  <span
                    key={label}
                    className={`whitespace-nowrap rounded-full bg-background px-2.5 py-1 text-xs font-semibold ${status?.className ?? "text-muted-foreground"}`}
                  >
                    {label.slice(0, 4)} · {status?.label ?? "—"}
                  </span>
                );
              })
            )}
          </span>
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
        </summary>
        {!loading && !unavailable && (
          <div className="border-t border-border px-4 pb-4">
            {rows.map(({ label, data }) =>
              data ? <Incident key={label} direction={label} data={data} /> : null,
            )}
            <p className="mt-3 text-xs text-muted-foreground">
              Traffic: TomTom · General road alert — not a trip-specific ETA.
            </p>
          </div>
        )}
      </details>
    );
  }

  return (
    <section
      className="verdict-lift mt-7 rounded-lg border border-border p-5"
      aria-labelledby="h1-conditions-title"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="h1-conditions-title" className="text-lg font-semibold">
          H-1 conditions
        </h2>
        <span className="shrink-0 text-xs text-muted-foreground">TomTom</span>
      </div>
      {loading && <p className="mt-4 text-sm text-muted-foreground">Checking live traffic…</p>}
      {unavailable && (
        <p className="mt-4 text-sm text-muted-foreground">
          Live traffic is not available right now.
        </p>
      )}
      {!loading && !unavailable && (
        <div className="mt-3 divide-y divide-border">
          {rows.map(({ label, data }) => {
            const status = data ? trafficStatus(data.delayMinutes, data.incidents[0]) : null;
            return (
              <div key={label} className="py-3">
                <div className="grid min-h-9 grid-cols-[minmax(0,1fr)_minmax(7rem,auto)] items-center gap-4">
                  <span className="min-w-0 text-sm text-foreground">H-1 {label}</span>
                  <span
                    className={`min-w-28 text-center text-sm font-semibold tabular-nums ${status?.className ?? "text-muted-foreground"}`}
                  >
                    {status?.label ?? "—"}
                  </span>
                </div>
                {data && <Incident direction={label} data={data} />}
              </div>
            );
          })}
        </div>
      )}
      {weatherLine && (
        <p className={`mt-4 text-xs ${TONE_CLASS[weatherLine.tone]}`}>
          {weatherLine.text}
          <span className="ml-1 text-xs text-muted-foreground">{weatherLine.source}</span>
        </p>
      )}
    </section>
  );
}
