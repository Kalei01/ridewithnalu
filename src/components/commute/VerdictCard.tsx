import { Check } from "lucide-react";
import { naluHeroVerdictLine } from "@/lib/nalu-voice";

function getHeroPersonality(headline: string): string {
  const normalized = headline.toLowerCase();
  const decision = normalized.startsWith("drive")
    ? "drive"
    : normalized.startsWith("rail")
      ? "rail"
      : normalized.includes("close") || normalized.includes("toss")
        ? "toss_up"
        : null;

  if (!decision) return "";

  const match = headline.match(/(\d+)\s*min(?:ute)?s?\s*faster/i);
  const difference = match ? Number(match[1]) : undefined;

  return naluHeroVerdictLine({
    decision,
    timeDifferenceMinutes: difference,
  });
}

export function VerdictCard({
  headline,
  metrics,
  reason,
  children,
  personality,
}: {
  headline: string;
  metrics?: Array<{ label: string; value: string; accent?: boolean }>;
  reason?: string | null;
  children?: React.ReactNode;
  personality?: string | null;
}) {
  const heroPersonality = personality ?? getHeroPersonality(headline);

  return (
    <section
      className="verdict-lift liquid-titanium-slab -mx-2 mt-5 px-5 py-7 sm:px-6"
      aria-labelledby="verdict-title"
    >
      <div className="mb-5 flex items-center gap-2 text-recommended">
        <span className="flex size-6 items-center justify-center rounded-full bg-recommended text-recommended-foreground shadow-[0_0_18px_rgba(48,209,88,0.16)]">
          <Check className="size-4 stroke-[3]" />
        </span>
        <span className="text-xs font-bold uppercase tracking-[0.08em]">Nalu says</span>
      </div>

      {heroPersonality && (
        <p className="mb-3 max-w-[42rem] text-sm font-medium leading-6 text-muted-foreground">
          {heroPersonality}
        </p>
      )}

      <h1
        id="verdict-title"
        className="max-w-[390px] text-[2.75rem] font-bold leading-[0.98] tracking-[-0.035em] text-foreground sm:text-5xl"
      >
        {headline}
      </h1>

      {metrics?.length ? (
        <div className="liquid-divider mt-6 grid grid-cols-3 gap-2 border-t pt-5">
          {metrics.map((metric) => (
            <div className="metric-glass" key={metric.label}>
              <p className="text-xs tracking-[0.01em] text-muted-foreground">{metric.label}</p>
              <p
                className={`liquid-metric-value mt-1 text-[1.7rem] font-semibold ${
                  metric.accent ? "text-recommended" : "text-foreground"
                }`}
              >
                {metric.value}
              </p>
            </div>
          ))}
        </div>
      ) : null}

      {reason && (
        <details className="mt-5 group">
          <summary className="cursor-pointer list-none text-sm font-semibold text-foreground/95 marker:hidden">
            <span className="inline-flex items-center gap-2">
              <span className="text-xs text-muted-foreground transition-transform group-open:rotate-90">▶</span>
              Why?
            </span>
          </summary>
          <p className="mt-3 max-w-[42rem] text-sm leading-6 text-muted-foreground">{reason}</p>
        </details>
      )}

      {children}
    </section>
  );
}
