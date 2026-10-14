import { Check, Minus } from "lucide-react";
import { checkingStepsSummary, type CheckingStep } from "@/lib/loading-labels";

/**
 * Traffic, Skyline and TheBus on one line while a trip loads. The Drive row shows the minutes, so a step is just its tick and name. A step ticks only
 * when its real answer is in (never on a timer). Same height as the old status
 * line, so nothing moves when the answer lands.
 */
export function CheckingSteps({ steps }: { steps: CheckingStep[] }) {
  return (
    <div className="mt-3 flex min-h-[26px] flex-nowrap items-center gap-x-4 text-sm font-medium text-muted-foreground">
      <span aria-live="polite" className="sr-only">
        {checkingStepsSummary(steps)}
      </span>
      {steps.map((step) => (
        <span key={step.key} aria-hidden="true" className="flex items-center gap-1.5 tabular-nums">
          {step.state === "checking" ? (
            <span className="flex size-4 items-center justify-center rounded-full ring-1 ring-border">
              <span className="size-1 rounded-full bg-muted-foreground/60" />
            </span>
          ) : step.state === "done" ? (
            <span className="check-step-tick flex size-4 items-center justify-center rounded-full bg-recommended text-recommended-foreground">
              <Check className="size-3 stroke-[3]" />
            </span>
          ) : (
            <span className="flex size-4 items-center justify-center rounded-full ring-1 ring-border">
              <Minus className="size-3" />
            </span>
          )}
          <span className={step.state === "done" ? "text-foreground" : undefined}>
            {step.label}
            {step.state === "unavailable" ? " unavailable" : ""}
          </span>
        </span>
      ))}
    </div>
  );
}
