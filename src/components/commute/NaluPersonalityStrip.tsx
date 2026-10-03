/**
 * Nalu's one-line status strip — the friendly sentence under the header that
 * says Nalu checked the roads and rail — plus the wave/shell brand mark.
 */

export type NaluDecisionState = "drive" | "transit" | "same" | "none" | "uncertain";

export function NaluPersonalityStrip({
  loading,
  configured,
  period,
  decision,
  trafficLevel,
}: {
  loading: boolean;
  configured: boolean;
  period: "morning" | "evening";
  decision: NaluDecisionState;
  trafficLevel: "light" | "moderate" | "heavy" | "severe";
}) {
  if (!configured) return null;

  const line = loading
    ? period === "evening"
      ? "Alright, let me check the evening run."
      : "Alright, let me check it."
    : decision === "drive"
      ? trafficLevel === "heavy" || trafficLevel === "severe"
        ? "Yeah, the roads are getting busy. I checked it for you."
        : "I checked the roads and rail. Here’s what I’m seeing."
      : decision === "transit"
        ? "I checked the roads and rail. Here’s what I’m seeing."
        : decision === "same"
          ? "I checked both. This one’s pretty close."
          : "I’m checking the latest commute information for you.";

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
        <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Nalu</p>
        <p className="mt-0.5 text-sm font-medium leading-5 text-foreground">{line}</p>
      </div>
    </div>
  );
}

export function WaveMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 44" fill="none" className={className} aria-hidden="true">
      <path
        d="M3 32C11 21 18 21 25 31C32 41 39 41 46 31C51 24 56 24 61 29"
        stroke="currentColor"
        strokeWidth="2.7"
        strokeLinecap="round"
        opacity=".7"
      />
      <g transform="translate(19 4)">
        <ellipse className="shell" cx="13" cy="16" rx="11" ry="8.2" />
        <path className="detail" d="M13 8v16M4 15h18M6.5 11.5 13 16l6.5-4.5M6.5 19.5 13 16l6.5 3.5" />
        <path className="body" d="M3 13.5 0 10.5 1.5 17 4.5 16.5ZM23 13.5l3-3-1.5 6.5-3-.5ZM8 22l-3 4.5 5-2.5ZM18 22l3 4.5-5-2.5Z" />
        <path className="body" d="M10.5 23.5h5L13 27Z" />
      </g>
    </svg>
  );
}
