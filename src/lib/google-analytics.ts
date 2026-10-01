import { readAnalyticsConsent } from "@/lib/analytics";

let loaded = false;
let measurementId: string | null = null;

function getMeasurementId() {
  const value = import.meta.env["VITE_GA4_MEASUREMENT_ID"];
  return typeof value === "string" && /^G-[A-Z0-9]+$/i.test(value) ? value : null;
}

export function googleAnalyticsAvailable() {
  return Boolean(getMeasurementId());
}

function loadGoogleAnalytics() {
  if (typeof window === "undefined" || loaded) return;
  const id = getMeasurementId();
  if (!id || readAnalyticsConsent() !== "granted") return;

  const script = document.createElement("script");
  script.async = true;
  script.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(id);
  document.head.appendChild(script);

  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function (...args: unknown[]) {
    window.dataLayer?.push(args);
  };
  window.gtag("js", new Date());
  window.gtag("config", id, { send_page_view: false });

  loaded = true;
  measurementId = id;
}

export function initGoogleAnalytics() {
  loadGoogleAnalytics();
}

export function trackGooglePageView(path: string) {
  loadGoogleAnalytics();
  if (!loaded || !measurementId || typeof window === "undefined" || readAnalyticsConsent() !== "granted") return;
  window.gtag?.("event", "page_view", {
    page_location: window.location.origin + path,
    page_path: path,
    page_title: document.title,
  });
}

export function trackGoogleEvent(
  event: string,
  props?: Record<string, string | number | boolean | null>,
) {
  loadGoogleAnalytics();
  if (!loaded || !measurementId || typeof window === "undefined" || readAnalyticsConsent() !== "granted") return;
  window.gtag?.("event", event, props);
}
