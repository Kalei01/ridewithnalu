import { createPortal } from "react-dom";
import type { ReactNode } from "react";
import { X } from "lucide-react";
import { stationLabel, titleCase } from "@/lib/commute-formatting";
import type { ApproachState } from "@/lib/approach";

export function ApproachBanner({
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

export function NavShell({
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
