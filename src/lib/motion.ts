/** True when the rider asked their device for less movement. Safe on the server. */
export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
}

/** Leaflet fly options: a short glide, or an instant move under reduced motion. */
export function flyMotion(seconds = 0.4): { duration: number } | { animate: false } {
  return prefersReducedMotion() ? { animate: false } : { duration: seconds };
}

/** Scroll behavior that never animates for riders who asked for less movement. */
export function scrollBehavior(): ScrollBehavior {
  return prefersReducedMotion() ? "auto" : "smooth";
}
