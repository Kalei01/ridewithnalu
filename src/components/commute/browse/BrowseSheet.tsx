import { useEffect, useRef, type ReactNode } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import "./browse-sheet.css";

export type SheetState = "peek" | "half" | "full";

const NEXT: Record<SheetState, SheetState> = { peek: "half", half: "full", full: "half" };
const HANDLE_LABEL: Record<SheetState, string> = {
  peek: "Show more",
  half: "Show everything",
  full: "Show less",
};
/** Visible height of the half sheet, as a share of the screen (matches browse-sheet.css). */
const HALF_SHARE = 0.5;
/** A drag shorter than this is a tap. */
const TAP_SLOP_PX = 6;
/** A flick faster than this (px per ms) goes one step in its direction. */
const FLICK_PX_PER_MS = 0.5;

/**
 * Browse's bottom sheet: PEEK (search + one line), HALF (the quick cards) and
 * FULL (everything, scrollable). Basic snap only; spring physics come later.
 *
 * - Dragging works from the handle only, so scrolling the cards never moves
 *   the sheet and the map behind never moves.
 * - Only transform changes while it moves (CSS transition; none under
 *   prefers-reduced-motion, so it snaps).
 * - The handle is also a button: tap or press Enter to step up, and back down
 *   from the top. Nothing needs a gesture.
 */
export function BrowseSheet({
  state,
  onStateChange,
  peek,
  children,
}: {
  state: SheetState;
  onStateChange: (next: SheetState) => void;
  /** The header: Right now and the search field. Taller than the closed sheet shows once opened. */
  peek: ReactNode;
  /** The cards. Hidden from taps and screen readers while the sheet is a peek. */
  children: ReactNode;
}) {
  const sheetRef = useRef<HTMLElement | null>(null);
  const headerRef = useRef<HTMLDivElement | null>(null);
  // Invisible element as tall as the closed sheet's visible part (CSS --nb-peek, safe area included).
  const probeRef = useRef<HTMLDivElement | null>(null);
  const drag = useRef<{
    startY: number;
    startOffset: number;
    lastY: number;
    lastT: number;
    velocity: number;
    moved: boolean;
    positions: Record<SheetState, number>;
  } | null>(null);
  const suppressClick = useRef(false);
  const bodyRef = useRef<HTMLDivElement | null>(null);

  // Leaving FULL: the cards start from the top again next time.
  useEffect(() => {
    if (state !== "full" && bodyRef.current) bodyRef.current.scrollTop = 0;
  }, [state]);

  /** How far down (px) the sheet sits in each state. */
  function offsets(): Record<SheetState, number> {
    const sheet = sheetRef.current;
    const height = sheet?.offsetHeight ?? 0;
    const peekVisible = probeRef.current?.offsetHeight ?? headerRef.current?.offsetHeight ?? 0;
    const halfVisible = Math.min(height, window.innerHeight * HALF_SHARE);
    return { full: 0, half: height - halfVisible, peek: height - peekVisible };
  }

  function onPointerDown(event: React.PointerEvent<HTMLButtonElement>) {
    if (event.button !== 0 && event.pointerType === "mouse") return;
    // A touch drag fires no click, so the flag from the last drag must not outlive it.
    suppressClick.current = false;
    const positions = offsets();
    drag.current = {
      startY: event.clientY,
      startOffset: positions[state],
      lastY: event.clientY,
      lastT: event.timeStamp,
      velocity: 0,
      moved: false,
      positions,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: React.PointerEvent<HTMLButtonElement>) {
    const d = drag.current;
    const sheet = sheetRef.current;
    if (!d || !sheet) return;
    const dy = event.clientY - d.startY;
    if (!d.moved && Math.abs(dy) < TAP_SLOP_PX) return;
    if (!d.moved) {
      d.moved = true;
      sheet.classList.add("is-dragging");
    }
    const dt = Math.max(1, event.timeStamp - d.lastT);
    d.velocity = (event.clientY - d.lastY) / dt;
    d.lastY = event.clientY;
    d.lastT = event.timeStamp;
    const next = Math.min(d.positions.peek, Math.max(0, d.startOffset + dy));
    sheet.style.transform = `translate3d(0, ${next}px, 0)`;
  }

  function onPointerEnd(event: React.PointerEvent<HTMLButtonElement>) {
    const d = drag.current;
    const sheet = sheetRef.current;
    drag.current = null;
    if (!d || !sheet) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (!d.moved) return; // a tap: the click handler steps the state
    suppressClick.current = true;
    const order: SheetState[] = ["full", "half", "peek"];
    const current = Math.min(
      d.positions.peek,
      Math.max(0, d.startOffset + (event.clientY - d.startY)),
    );
    let target: SheetState;
    if (Math.abs(d.velocity) > FLICK_PX_PER_MS) {
      const at = order.indexOf(state);
      target = order[Math.min(2, Math.max(0, at + (d.velocity > 0 ? 1 : -1)))] ?? state;
    } else {
      target = order.reduce((best, key) =>
        Math.abs(d.positions[key] - current) < Math.abs(d.positions[best] - current) ? key : best,
      );
    }
    // Hand back to CSS in one frame so the transition runs from where the finger left it.
    sheet.style.transform = "";
    sheet.classList.remove("is-dragging");
    onStateChange(target);
  }

  function onClick() {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    onStateChange(NEXT[state]);
  }

  return (
    <section
      ref={sheetRef}
      className="nb-sheet"
      data-state={state}
      aria-label="Nalu: where to, and what is happening now"
    >
      <div ref={probeRef} className="nb-peek-probe" aria-hidden="true" />
      <div ref={headerRef} className="nb-sheet-header">
        <button
          type="button"
          className="nb-handle"
          aria-label={HANDLE_LABEL[state]}
          aria-expanded={state !== "peek"}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerEnd}
          onPointerCancel={onPointerEnd}
          onClick={onClick}
        >
          <span className="nb-grip" aria-hidden="true" />
          <span className="nb-handle-icon" aria-hidden="true">
            {state === "full" ? (
              <ChevronDown className="size-4" />
            ) : (
              <ChevronUp className="size-4" />
            )}
          </span>
        </button>
        {peek}
      </div>
      <div ref={bodyRef} className="nb-sheet-body" inert={state === "peek"}>
        <div className="nb-sheet-content">{children}</div>
      </div>
    </section>
  );
}
