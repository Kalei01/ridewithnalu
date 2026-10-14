import { useEffect, useRef } from "react";

/**
 * Marks an element "pending" until it first scrolls into view, then "in"
 * (data-reveal). Server-rendered markup shows the finished state, so nothing is
 * hidden without JavaScript; the page's CSS decides what "pending" and "in" look
 * like. Does nothing under reduced motion or without IntersectionObserver.
 */
export function useReveal<T extends HTMLElement>(threshold = 0.2) {
  const ref = useRef<T | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    el.setAttribute("data-reveal", "pending");
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          el.setAttribute("data-reveal", "in");
          io.disconnect();
        }
      },
      { threshold },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);
  return ref;
}
