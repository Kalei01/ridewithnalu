/**
 * App-side crash reports to Sentry. Off unless VITE_SENTRY_DSN is set.
 * Errors only (no performance tracing, no session replay), no personal data,
 * and web addresses are trimmed so no search or location text is sent.
 */
let started = false;
let reported = 0;

/** Also list the crash in the Dev panel's Problems list (at most 5 per visit). */
function reportToProblems(event: { exception?: { values?: Array<{ type?: string; value?: string }> }; message?: string }) {
  if (reported >= 5) return;
  const first = event.exception?.values?.[0];
  const message = first ? `${first.type ?? "Error"}: ${first.value ?? ""}`.trim() : (event.message ?? "");
  if (!message) return;
  reported += 1;
  void import("./problems.functions")
    .then(({ reportAppProblem }) =>
      reportAppProblem({ data: { area: window.location.pathname || "/", message: message.slice(0, 300) } }),
    )
    .catch(() => undefined);
}

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
      reportToProblems(event);
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
