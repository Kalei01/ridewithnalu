/**
 * Nalu's one-line status strip — the friendly sentence under the header that
 * says Nalu checked the roads and rail — plus the wave/shell brand mark.
 */

import { generateSmartNaluInsight, type SmartNaluContext } from "@/lib/nalu-voice";


/**
 * Nalu's brand mark, drawn from the app icon (public/icons/nalu-icon.svg): a
 * curling wave (nalu) over a route line ending at a green destination dot.
 * The wave and line follow the text color; the destination dot stays green.
 */
export function WaveMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="150 330 720 460"
      role="img"
      aria-label="Nalu"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M 196 580 C 300 580 352 410 486 360 C 620 310 772 370 790 500 C 804 604 700 652 636 608 C 588 574 600 506 660 500"
        stroke="currentColor"
        strokeWidth="80"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M 196 740 C 320 710 420 760 540 740 C 640 723 712 712 770 726"
        stroke="currentColor"
        strokeOpacity="0.55"
        strokeWidth="40"
        strokeLinecap="round"
      />
      <circle cx="806" cy="730" r="46" fill="#30d158" />
    </svg>
  );
}

export type NaluDecisionState = "drive" | "transit" | "same" | "none" | "uncertain";

export function NaluPersonalityStrip({
  loading,
  configured,
  period,
  decision,
  trafficLevel,
  driveMinutes,
  transitMinutes,
  timeDelta,
  incidents,
  activeRoadwork,
  weather,
  transferMinutes,
  waitMinutes,
  walkMinutes,
}: {
  loading: boolean;
  configured: boolean;
  period: "morning" | "evening";
  decision: NaluDecisionState;
  trafficLevel: "light" | "moderate" | "heavy" | "severe";
  driveMinutes?: number | null;
  transitMinutes?: number | null;
  timeDelta?: number | null | undefined;
  incidents?: SmartNaluContext["incidents"];
  activeRoadwork?: SmartNaluContext["activeRoadwork"];
  weather?: SmartNaluContext["weather"];
  transferMinutes?: number | null;
  waitMinutes?: number | null;
  walkMinutes?: number | null;
}) {
  if (!configured) return null;

  const hasComparison = driveMinutes != null && transitMinutes != null;
  const line = loading
    ? "Nalu’s checking the roads and transit..."
    : decision === "none" || decision === "uncertain"
      ? "I couldn’t make a reliable call yet."
      : generateSmartNaluInsight({
          driveMinutes,
          transitMinutes,
          timeDelta,
          selectedMode:
            decision === "transit"
              ? "transit"
              : decision === "drive"
                ? "drive"
                : "toss_up",
          decision:
            decision === "transit"
              ? "transit"
              : decision === "drive"
                ? "drive"
                : "toss_up",
          incidents: incidents ?? null,
          activeRoadwork: activeRoadwork ?? null,
          weather: weather ?? null,
          period,
          trafficLevel,
          transferMinutes,
          waitMinutes,
          walkMinutes,
        });

  const displayLine = !loading && !hasComparison && decision !== "none" && decision !== "uncertain"
    ? "Nalu checked it. Here’s the move."
    : line;

  return (
    <div
      className="mt-5 flex items-start gap-3 rounded-2xl border border-border/70 bg-surface-raised/70 px-4 py-3"
      aria-live="polite"
      aria-label="Nalu status"
    >
      <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-recommended text-recommended-foreground text-xs font-black">
        N
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
          Nalu
        </p>
        <p className="mt-0.5 text-sm font-medium leading-5 text-foreground">{displayLine}</p>
      </div>
    </div>
  );
}

