/**
 * Privacy-first product analytics. Nothing is sent until the rider opts in,
 * and properties never include coordinates, addresses, or free text.
 */
import type { PostHog } from "posthog-js";
import { trackGoogleEvent } from "@/lib/google-analytics";

export type AnalyticsEvent =
  | "app_opened"
  | "destination_search"
  | "destination_selected"
  | "commute_comparison_viewed"
  | "drive_selected"
  | "rail_selected"
  | "arrive_by_used"
  | "saved_place_created"
  | "active_trip_started"
  | "active_trip_completed"
  | "feedback_submitted";

export type AnalyticsConsent = "granted" | "denied" | null;
export const ANALYTICS_CONSENT_KEY = "nalu-analytics-consent-v1";
const CONSENT_EVENT = "nalu-analytics-consent";

type Primitive = string | number | boolean | null;
const BLOCKED = /lat|lon|lng|coord|address|street|name|query|email|gps|point|place_id/i;

let client: PostHog | null = null;
let loading: Promise<PostHog | null> | null = null;

export function readAnalyticsConsent(): AnalyticsConsent {
  if (typeof window === "undefined") return null;
  const value = window.localStorage.getItem(ANALYTICS_CONSENT_KEY);
  return value === "granted" || value === "denied" ? value : null;
}

export function setAnalyticsConsent(value: "granted" | "denied") {
  try {
    window.localStorage.setItem(ANALYTICS_CONSENT_KEY, value);
  } catch {
    /* private mode: the in-memory dismissal still hides the banner */
  }
  window.dispatchEvent(new CustomEvent(CONSENT_EVENT));
  if (value === "denied") {
    client?.opt_out_capturing();
    client?.reset();
  } else {
    void load().then((ph) => ph?.opt_in_capturing());
  }
}

export function onAnalyticsConsentChange(listener: () => void) {
  window.addEventListener(CONSENT_EVENT, listener);
  return () => window.removeEventListener(CONSENT_EVENT, listener);
}

export function analyticsAvailable() {
  return Boolean(import.meta.env["VITE_LOVABLE_CONNECTOR_POSTHOG_API_KEY"]);
}

function load(): Promise<PostHog | null> {
  if (client) return Promise.resolve(client);
  if (loading) return loading;
  const token = import.meta.env["VITE_LOVABLE_CONNECTOR_POSTHOG_API_KEY"] as string | undefined;
  if (!token || typeof window === "undefined") return Promise.resolve(null);
  const region = import.meta.env["VITE_LOVABLE_CONNECTOR_POSTHOG_REGION"] || "us";
  loading = import("posthog-js")
    .then(({ default: posthog }) => {
      posthog.init(token, {
        api_host: region === "eu" ? "https://eu.i.posthog.com" : "https://us.i.posthog.com",
        autocapture: false,
        capture_pageview: false,
        capture_pageleave: false,
        disable_session_recording: true,
        disable_surveys: true,
        person_profiles: "identified_only",
        persistence: "localStorage",
        mask_all_text: true,
        mask_all_element_attributes: true,
        property_denylist: ["$ip", "$current_url", "$pathname", "$referrer", "$initial_referrer"],
      });
      client = posthog;
      return posthog;
    })
    .catch(() => null);
  return loading;
}

function sanitize(props?: Record<string, Primitive>) {
  const out: Record<string, Primitive> = {};
  for (const [key, value] of Object.entries(props ?? {})) {
    if (BLOCKED.test(key)) continue;
    if (typeof value === "string" && value.length > 40) continue;
    out[key] = value;
  }
  return out;
}

export function track(event: AnalyticsEvent, props?: Record<string, Primitive>) {
  if (readAnalyticsConsent() !== "granted") return;
  const safeProps = sanitize(props);
  trackGoogleEvent(event, safeProps);
  void load().then((ph) => ph?.capture(event, safeProps));
}
