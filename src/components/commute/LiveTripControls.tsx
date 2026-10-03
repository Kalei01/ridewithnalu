import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { stationLabel, titleCase } from "@/lib/commute-formatting";
import type { ApproachState } from "@/lib/approach";

function NavShell({
  fullscreen,
  overlay,
  children,
}: {
  fullscreen: boolean;
  overlay: ReactNode;
  children: ReactNode;
}) {
  if (!fullscreen || typeof document === "undefined") {
    return <div className="h-72 border-t border-border sm:h-80">{children}</div>;
  }
  return createPortal(
    <div className="fixed inset-0 z-50 bg-background" role="dialog" aria-label="Live navigation">
      <div className="h-full w-full">{children}</div>
      {overlay}
    </div>,
    document.body,
  );
}

/** Hold for 1 s to end, so a bump on the freeway can't cancel navigation. */

function HoldToEndButton({
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
      className={`relative touch-none select-none overflow-hidden font-black uppercase ${className ?? ""}`}
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



function ApproachBanner({
  state,
  stopsAway,
  minutesToAlight,
  nextStopName,
  alightName,
  vehicle,
  live,
  onDismiss,
}: {
  state: ApproachState;
  stopsAway: number;
  minutesToAlight: number | null;
  nextStopName: string;
  alightName: string;
  vehicle: "bus" | "rail";
  live: boolean;
  onDismiss: () => void;
}) {
  const stopLabel = (name: string) =>
    vehicle === "rail" ? (stationLabel(name) || titleCase(name)) + " Station" : titleCase(name);
  const exitName = stopLabel(alightName);
  const nextName = stopLabel(nextStopName);
  const minutesText =
    minutesToAlight !== null && minutesToAlight > 0 ? " · " + minutesToAlight + " min" : "";

  if (state === "cruising" || state === "off-route") {
    return (
      <div
        role="status"
        className="sticky top-0 z-40 -mx-2 mb-2 flex items-center justify-between gap-2 rounded-full border border-border bg-surface-raised px-3.5 py-2"
      >
        <p className="text-xs font-semibold text-foreground">
          {state === "off-route"
            ? "Off route · alerts paused · exit at " + exitName
            : "En route · Next: " + nextName + " · Exit at " + exitName + minutesText}
        </p>
        <button aria-label="Dismiss stop alert" onClick={onDismiss} className="shrink-0 text-muted-foreground">
          <X className="size-3.5" />
        </button>
      </div>
    );
  }

  const urgent = state === "urgent";
  const passed = state === "passed";
  const statusText = passed
    ? live
      ? "Tracking your location"
      : "Using the timetable"
    : (stopsAway <= 1 ? "1 stop to go" : stopsAway + " stops to go") +
      minutesText +
      (live ? " · tracking your location" : " · using the timetable");

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={
        "sticky top-0 z-40 -mx-2 mb-3 rounded-2xl border-2 px-4 py-3 shadow-lg " +
        (passed
          ? "border-border bg-surface-raised"
          : urgent
            ? "border-white bg-[#b91c1c]"
            : "border-[#fbbf24] bg-[#78350f]")
      }
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={"text-base font-extrabold uppercase tracking-wide " + (passed ? "text-foreground" : "text-white")}>
            {passed ? "Looks like you passed your stop" : urgent ? "⚠️ Pull cord · your stop is next!" : "🔔 Get ready · 2 stops away"}
          </p>
          <p className={"mt-1 text-[15px] font-bold leading-snug " + (passed ? "text-foreground" : "text-white")}>
            {passed
              ? "Your exit was " + exitName + ". Get off at the next stop and head back."
              : urgent
                ? "Get off at " + exitName
                : "Next stop is " + nextName + ", then get off at " + exitName + "."}
          </p>
          <p className={"mt-1 text-xs font-semibold " + (passed ? "text-muted-foreground" : "text-white/80")}>
            {statusText}
          </p>
        </div>
        <button aria-label="Dismiss stop alert" onClick={onDismiss} className="shrink-0 rounded-full p-1 text-white/80 hover:text-white">
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
