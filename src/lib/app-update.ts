import { BUILD_ID } from "./build-id";

/** Present while a trip is underway; Nalu never refreshes itself mid-trip. */
const TRIP_KEY = "nalu-committed-mode-v1";
const MIN_GAP_MS = 60_000;

function onTrip() {
  try {
    return Boolean(window.localStorage.getItem(TRIP_KEY));
  } catch {
    return false;
  }
}

/**
 * A Home Screen app can stay open for days on an old version. Whenever Nalu
 * comes back to the screen, ask which version is live; if it's newer and no
 * trip is underway, reload right away, before the person has started anything.
 */
export function startAutoUpdate() {
  if (typeof window === "undefined" || BUILD_ID === "dev") return () => {};
  let lastCheck = Date.now();
  let checking = false;
  const check = async () => {
    if (document.visibilityState !== "visible" || checking) return;
    if (Date.now() - lastCheck < MIN_GAP_MS) return;
    checking = true;
    lastCheck = Date.now();
    try {
      const response = await fetch("/api/public/version", { cache: "no-store" });
      if (!response.ok) return;
      const { build } = (await response.json()) as { build?: string };
      if (build && build !== BUILD_ID && !onTrip()) window.location.reload();
    } catch {
      /* offline: try again next time */
    } finally {
      checking = false;
    }
  };
  document.addEventListener("visibilitychange", check);
  window.addEventListener("pageshow", check);
  const timer = window.setInterval(check, 30 * 60_000);
  return () => {
    document.removeEventListener("visibilitychange", check);
    window.removeEventListener("pageshow", check);
    window.clearInterval(timer);
  };
}
