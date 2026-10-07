import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Hold for 1 s to end, so a bump on the freeway can't cancel navigation. */
export function HoldToEndButton({
  onEnd,
  label,
  className,
}: {
  onEnd: () => void;
  label: string;
  className?: string;
}) {
  const [holding, setHolding] = useState(false);
  const timer = useRef<number | null>(null);
  const start = () => {
    if (timer.current !== null) return;
    setHolding(true);
    timer.current = window.setTimeout(() => {
      timer.current = null;
      setHolding(false);
      if ("vibrate" in navigator) navigator.vibrate?.(40);
      onEnd();
    }, 1000);
  };
  const cancel = () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
    setHolding(false);
  };
  useEffect(() => cancel, []);
  return (
    <Button
      type="button"
      variant="destructive"
      aria-label={`Hold to ${label.toLowerCase()}`}
      onPointerDown={start}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
      onContextMenu={(e) => e.preventDefault()}
      onKeyDown={(e) => {
        if ((e.key === "Enter" || e.key === " ") && !e.repeat) {
          e.preventDefault();
          start();
        }
      }}
      onKeyUp={cancel}
      className={`relative touch-none select-none overflow-hidden bg-[#c42a20] font-black uppercase text-white hover:bg-[#a8231a] ${className ?? ""}`}
    >
      <span
        aria-hidden="true"
        className="absolute inset-y-0 left-0 bg-foreground/25"
        style={{
          width: holding ? "100%" : "0%",
          transition: holding ? "width 1s linear" : "width 150ms ease-out",
        }}
      />
      <span className="relative flex items-center gap-2">
        <X className="size-4" /> {holding ? "Keep holding…" : `Hold to ${label}`}
      </span>
    </Button>
  );
}

export function NavBottomCard({
  mode,
  delayMinutes,
  steps,
  nextStep = null,
  onEnd,
}: {
  mode: "drive" | "transit";
  delayMinutes: number | null;
  steps: string[];
  /** What to do next on a transit trip, e.g. "Walk to Lelepaua · board W Line 5:00 PM". */
  nextStep?: string | null;
  onEnd: () => void;
}) {
  const [open, setOpen] = useState(false);
  const traffic =
    mode === "transit"
      ? "Transit live"
      : delayMinutes === null
        ? "Checking traffic"
        : delayMinutes >= 5
          ? `Heavy · +${Math.round(delayMinutes)} min`
          : delayMinutes >= 2
            ? `Moderate · +${Math.round(delayMinutes)} min`
            : "Traffic clear";
  return (
    <div className="pointer-events-none absolute inset-x-2 bottom-[max(0.5rem,env(safe-area-inset-bottom))] z-20 max-lg:landscape:left-auto max-lg:landscape:w-80">
      <div className="nav-hud pointer-events-auto rounded-2xl p-3">
        {nextStep && (
          <p className="mb-2 text-sm font-bold leading-snug text-foreground" aria-live="polite">
            {nextStep}
          </p>
        )}
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label={open ? "Hide route" : "Route details"}
            className="flex min-w-0 items-center gap-2 text-left"
          >
            <span className="shrink-0 whitespace-nowrap rounded-full bg-muted px-3 py-1 text-xs font-black uppercase text-foreground">
              {traffic}
            </span>
            <span className="shrink-0 text-xs font-bold text-muted-foreground">
              {open ? "Hide" : "Details"}
            </span>
          </button>
          <HoldToEndButton onEnd={onEnd} label="End" className="h-11 shrink-0 px-5" />
        </div>
        {open && (
          <ol className="mt-3 max-h-[40dvh] space-y-2 overflow-y-auto overscroll-contain text-sm text-foreground">
            {steps.length ? (
              steps.map((step, i) => (
                <li key={`${i}-${step}`} className="flex gap-2">
                  <span className="w-5 shrink-0 text-right font-bold tabular-nums text-muted-foreground">
                    {i + 1}
                  </span>
                  <span className="min-w-0">{step}</span>
                </li>
              ))
            ) : (
              <li className="text-muted-foreground">
                Route steps will appear once the route loads.
              </li>
            )}
          </ol>
        )}
      </div>
    </div>
  );
}
