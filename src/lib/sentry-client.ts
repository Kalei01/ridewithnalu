/**
 * App-side crash reports to Sentry. Off unless VITE_SENTRY_DSN is set.
 * Errors only (no performance tracing, no session replay), no personal data,
 * and web addresses are trimmed so no search or location text is sent.
 */
let started = false;

export async function startErrorReporting() {
  const dsn = import.meta.env["VITE_SENTRY_DSN"] as string | undefined;
  if (started || !dsn || typeof window === "undefined") return;
  started = true;
  const Sentry = await import("@sentry/react");
  const trim = (url: string) => url.split("?")[0] ?? url;
  Sentry.init({
    dsn,
    environment: window.location.hostname === "ridenalu.com" ? "production" : "preview",
    tracesSampleRate: 0,
    beforeSend(event) {
      if (event.request) {
        if (event.request.url) event.request.url = event.request.url.split("?")[0] ?? event.request.url;
        delete event.request.query_string;
        delete event.request.cookies;
      }
      return event;
    },
    beforeBreadcrumb(crumb) {
      if (crumb.data && typeof crumb.data["url"] === "string") crumb.data["url"] = trim(crumb.data["url"]);
      return crumb;
    },
  });
}
