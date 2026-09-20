/**
 * Helpers for detecting when the browser has blocked location access, so the
 * app can show recovery steps instead of a generic "could not get location".
 */

export type LocationPermission = "granted" | "denied" | "prompt" | "unsupported";

/** True when a geolocation failure is a permission denial (error code 1). */
export function isPermissionDeniedError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = (error as { code?: unknown }).code;
  return code === 1 || code === 1.0;
}

/**
 * Ask the browser what state the geolocation permission is in, without
 * triggering a prompt. Returns "unsupported" where the Permissions API is not
 * implemented for geolocation (older Safari, Firefox private modes).
 */
export async function queryLocationPermission(): Promise<LocationPermission> {
  if (typeof navigator === "undefined" || !navigator.permissions?.query) return "unsupported";
  try {
    const status = await navigator.permissions.query({ name: "geolocation" as PermissionName });
    if (status.state === "granted" || status.state === "denied" || status.state === "prompt") {
      return status.state;
    }
    return "unsupported";
  } catch {
    return "unsupported";
  }
}

export type LocationHelpPlatform = "ios" | "android" | "desktop";

/** Best-effort guess at which recovery instructions apply to this device. */
export function detectLocationPlatform(userAgent: string, hasTouch: boolean): LocationHelpPlatform {
  if (/iPhone|iPad|iPod/i.test(userAgent)) return "ios";
  // iPadOS 13+ reports as Macintosh, but keeps touch events.
  if (/Macintosh/i.test(userAgent) && hasTouch) return "ios";
  if (/Android/i.test(userAgent)) return "android";
  return "desktop";
}
