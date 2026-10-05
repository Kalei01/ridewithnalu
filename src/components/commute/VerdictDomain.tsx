import { Check } from "lucide-react";
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
  driveLeaveSeconds = null,
  comparison,
  children,
}: {
  configured: boolean;
  commitment: boolean;
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
  /** Arrive By leave time for the drive; null means leave now. */
  driveLeaveSeconds?: number | null;
  /** Drive / Park & ride / No car, side by side, so the headline's math is on screen. */
  comparison?: ReactNode;
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
              ? `${transitLabel === "Park & ride" ? transitLabel : `Take ${transitLabel}`}${differenceMinutes !== null ? ` · ${formatDriveMinutes(Math.abs(differenceMinutes))} faster` : ""}`
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
        <span className="text-xs font-semibold">{commitment ? "On this trip" : "Nalu says"}</span>
      </div>
      <h1
        id="verdict-title"
        className="max-w-[390px] text-4xl font-bold leading-none text-foreground"
      >
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
                ? "rounded-full border border-recommended/35 bg-recommended/10 px-2.5 py-1 text-xs font-semibold text-recommended"
                : confidence === "moderate"
                  ? "rounded-full border border-warning/35 bg-warning/10 px-2.5 py-1 text-xs font-semibold text-warning"
                  : "rounded-full border border-destructive/35 bg-destructive/10 px-2.5 py-1 text-xs font-semibold text-destructive"
            }
          >
            {confidence === "high"
              ? "Confident call"
              : confidence === "moderate"
                ? "Fairly confident"
                : "Low confidence"}
          </span>
          {verdict === "same" && differenceMinutes !== null && (
            <span className="text-xs text-muted-foreground">
              {Math.round(differenceMinutes) === 0
                ? "Nearly identical times"
                : `About ${formatDriveMinutes(differenceMinutes)} apart`}
            </span>
          )}
        </div>
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
            <p
              className={`mt-1 whitespace-nowrap font-bold leading-tight tabular-nums text-foreground ${((arriveByActive ? best.total_minutes : transitMinutes) ?? 0) >= 60 ? "text-lg" : "text-2xl"}`}
            >
              {arriveByActive
                ? formatDriveMinutes(best.total_minutes)
                : transitMinutes !== null
                  ? formatDriveMinutes(transitMinutes)
                  : "—"}
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
            <p className="text-xs text-muted-foreground">
              {driveLeaveSeconds !== null ? "Leave by" : "Leave"}
            </p>
            <p className="mt-1 text-xl font-bold tabular-nums text-recommended">
              {driveLeaveSeconds !== null ? clockFromSeconds(driveLeaveSeconds) : "Now"}
            </p>
          </div>
          <div className="metric-glass">
            <p className="text-xs text-muted-foreground">Arrive</p>
            <p className="mt-1 text-xl font-bold tabular-nums text-foreground">
              {driveArrivalSeconds !== null ? clockFromSeconds(driveArrivalSeconds) : "—"}
            </p>
          </div>
          <div className="metric-glass">
            <p className="text-xs text-muted-foreground">Door to door</p>
            <p
              className={`mt-1 whitespace-nowrap font-bold leading-tight tabular-nums text-foreground ${(driveTotalMinutes ?? 0) >= 60 ? "text-lg" : "text-2xl"}`}
            >
              {driveTotalMinutes !== null ? formatDriveMinutes(driveTotalMinutes) : "—"}
            </p>
          </div>
          {driveBufferNote && (
            <p className="col-span-3 text-xs font-medium text-muted-foreground">
              {driveBufferNote}.
            </p>
          )}
        </div>
      )}
      {comparison}
      {children}
    </section>
  );
}
