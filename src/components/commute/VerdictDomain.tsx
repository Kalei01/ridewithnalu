import { Check } from "lucide-react";
import { DecisionBars } from "@/components/commute/DecisionBars";
import { formatDriveMinutes } from "@/lib/drive/traffic-summary";
import { clockFromSeconds } from "@/lib/commute-formatting";
import type { ReactNode } from "react";

type Range = { low: number; high: number } | null;
type TransitOption = {
  leave_by_seconds: number;
  arrive_seconds: number;
  total_minutes: number;
};
type Confidence = "high" | "moderate" | "low";

export function VerdictDomain({
  configured,
  commitment,
  naluHeroLine,
  verdict,
  transitStandaloneAvailable,
  transitLabel,
  optionsLoading,
  driveLoading,
  confidence,
  differenceMinutes,
  arriveByActive,
  driveMinutes,
  driveRange,
  transitMinutes,
  transitRange,
  best,
  transitWindow,
  driveAvailable,
  driveArrivalSeconds,
  driveWindow,
  driveBufferNote,
  driveTotalMinutes,
  children,
}: {
  configured: boolean;
  commitment: boolean;
  naluHeroLine: string | null | undefined;
  verdict: "drive" | "transit" | "same" | "none" | "uncertain";
  transitStandaloneAvailable: boolean;
  transitLabel: string;
  optionsLoading: boolean;
  driveLoading: boolean;
  confidence: Confidence;
  differenceMinutes: number | null;
  arriveByActive: boolean;
  driveMinutes: number | null;
  driveRange: Range;
  transitMinutes: number | null;
  transitRange: Range;
  best: TransitOption | null;
  transitWindow: string | null;
  driveAvailable: boolean;
  driveArrivalSeconds: number | null;
  driveWindow: string | null;
  driveBufferNote: string | null;
  driveTotalMinutes: number | null;
  children?: ReactNode;
}) {
  const headline = !configured
    ? "Where to?"
    : verdict === "none"
      ? "No valid option"
      : transitStandaloneAvailable
        ? "Transit trip available"
        : verdict === "uncertain"
          ? optionsLoading || driveLoading
            ? "Checking…"
            : "Not enough current information"
          : verdict === "same"
            ? "Too close to call"
            : verdict === "transit"
              ? `Take ${transitLabel}${differenceMinutes !== null ? ` · ${formatDriveMinutes(Math.abs(differenceMinutes))} faster` : ""}`
              : `Drive${differenceMinutes !== null ? ` · ${formatDriveMinutes(Math.abs(differenceMinutes))} faster` : ""}`;

  return (
    <section
      className="verdict-lift glass-panel -mx-2 mt-5 rounded-2xl px-5 py-7 animate-in fade-in duration-300"
      aria-labelledby="verdict-title"
    >
      <div className="mb-5 flex items-center gap-2 text-recommended">
        <span className="flex size-6 items-center justify-center rounded-full bg-recommended text-recommended-foreground">
          <Check className="size-4 stroke-[3]" />
        </span>
        <span className="text-xs font-semibold">
          {commitment ? "On this trip" : "Nalu says"}
        </span>
      </div>
      {configured && !optionsLoading && !driveLoading && naluHeroLine && (
        <p className="mb-4 max-w-[42rem] text-sm font-medium leading-6 text-muted-foreground">
          {naluHeroLine}
        </p>
      )}
      <h1 id="verdict-title" className="max-w-[390px] text-4xl font-bold leading-none text-foreground">
        {headline}
      </h1>
      {transitStandaloneAvailable && (
        <p className="mt-3 text-sm font-medium text-muted-foreground">
          Transit is available. Drive traffic unavailable, so Nalu is showing the transit trip
          without guessing a drive time.
        </p>
      )}
      {configured && verdict !== "none" && !optionsLoading && !driveLoading && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span
            className={
              confidence === "high"
                ? "rounded-full border border-recommended/35 bg-recommended/10 px-2.5 py-1 text-[11px] font-semibold text-recommended"
                : confidence === "moderate"
                  ? "rounded-full border border-warning/35 bg-warning/10 px-2.5 py-1 text-[11px] font-semibold text-warning"
                  : "rounded-full border border-destructive/35 bg-destructive/10 px-2.5 py-1 text-[11px] font-semibold text-destructive"
            }
          >
            {confidence === "high"
              ? "Strong signal"
              : confidence === "moderate"
                ? "Moderate signal"
                : "Limited confidence"}
          </span>
          {differenceMinutes !== null && (
            <span className="text-xs text-muted-foreground">
              {Math.round(differenceMinutes) === 0
                ? "Nearly identical times"
                : `${Math.round(differenceMinutes)} min separates the options`}
            </span>
          )}
        </div>
      )}
      {configured && !arriveByActive && (
        <DecisionBars
          drive={{
            label: "Drive",
            minutes: driveMinutes,
            low: driveRange?.low,
            high: driveRange?.high,
          }}
          transit={{
            label: transitLabel,
            minutes: transitMinutes,
            low: transitRange?.low,
            high: transitRange?.high,
          }}
        />
      )}
      {(verdict === "transit" || transitStandaloneAvailable) && best && transitRange && (
        <div className="mt-6 grid grid-cols-3 gap-2 border-t border-border/70 pt-5">
          <div className="metric-glass">
            <p className="text-xs text-muted-foreground">Leave by</p>
            <p className="mt-1 text-xl font-bold tabular-nums text-recommended">
              {clockFromSeconds(best.leave_by_seconds)}
            </p>
          </div>
          <div className="metric-glass">
            <p className="text-xs text-muted-foreground">Arrive</p>
            <p className="mt-1 text-xl font-bold tabular-nums text-foreground">
              {clockFromSeconds(best.arrive_seconds)}
            </p>
          </div>
          <div className="metric-glass">
            <p className="text-xs text-muted-foreground">{arriveByActive ? "Trip" : "From now"}</p>
            <p className="mt-1 text-3xl font-bold leading-none tabular-nums text-foreground">
              {arriveByActive
                ? formatDriveMinutes(best.total_minutes)
                : transitMinutes !== null
                  ? formatDriveMinutes(transitMinutes)
                  : "—"}
              <span className="ml-1 text-xs font-semibold text-muted-foreground">min</span>
            </p>
          </div>
          {transitWindow && (
            <p className="col-span-3 text-sm font-semibold tabular-nums text-muted-foreground">
              Arrive {transitWindow}
            </p>
          )}
        </div>
      )}
      {verdict === "drive" && driveAvailable && (
        <div className="mt-6 grid grid-cols-3 gap-2 border-t border-border/70 pt-5">
          <div className="metric-glass">
            <p className="text-xs text-muted-foreground">Leave</p>
            <p className="mt-1 text-xl font-bold text-recommended">Now</p>
          </div>
          <div className="metric-glass">
            <p className="text-xs text-muted-foreground">Arrive</p>
            <p className="mt-1 text-xl font-bold tabular-nums text-foreground">
              {driveArrivalSeconds !== null ? clockFromSeconds(driveArrivalSeconds) : "—"}
            </p>
          </div>
          <div className="metric-glass">
            <p className="text-xs text-muted-foreground">Total trip</p>
            <p className="mt-1 text-3xl font-bold leading-none tabular-nums text-foreground">
              {Math.round(driveTotalMinutes ?? 0)}
              <span className="ml-1 text-xs font-semibold text-muted-foreground">min</span>
            </p>
          </div>
          <p className="col-span-3 text-sm font-semibold tabular-nums text-muted-foreground">
            Arrive {driveWindow}
            {driveBufferNote && (
              <span className="mt-1 block text-xs font-medium">{driveBufferNote}.</span>
            )}
          </p>
        </div>
      )}
      {children}
    </section>
  );
}
