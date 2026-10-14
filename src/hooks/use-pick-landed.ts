import { useEffect, useRef } from "react";

/**
 * Fires once when Nalu's pick first appears for a trip (the key goes from none
 * to a row), not on later updates. Gives a tiny haptic tick on Android; iPhone has
 * no web haptics, and nothing happens with reduced motion on.
 */
export function usePickLanded(pickKey: string | null) {
  const had = useRef(false);
  useEffect(() => {
    if (pickKey === null) {
      had.current = false;
      return;
    }
    if (had.current) return;
    had.current = true;
    if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    navigator.vibrate(10);
  }, [pickKey]);
}
