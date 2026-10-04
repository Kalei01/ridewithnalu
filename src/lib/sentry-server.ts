/**
 * Server-side error reports to Sentry, sent directly to its store endpoint
 * (no SDK wrapping the Worker). Off unless VITE_SENTRY_DSN is set. Sends the
 * error and where it happened only; never request bodies or locations.
 */
const DSN = import.meta.env["VITE_SENTRY_DSN"] as string | undefined;

export function storeUrl(dsn: string) {
  const url = new URL(dsn);
  const projectId = url.pathname.replace(/^\//, "");
  return {
    endpoint: `${url.protocol}//${url.host}/api/${projectId}/store/`,
    auth: `Sentry sentry_version=7, sentry_client=nalu-server/1, sentry_key=${url.username}`,
  };
}

export async function reportServerError(error: unknown, where: string) {
  const { recordProblem } = await import("./problems.server");
  await recordProblem("server", where, error instanceof Error ? error.message : String(error));
  if (!DSN) return;
  try {
    const { endpoint, auth } = storeUrl(DSN);
    const err = error instanceof Error ? error : new Error(String(error));
    await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Sentry-Auth": auth },
      body: JSON.stringify({
        event_id: crypto.randomUUID().replace(/-/g, ""),
        timestamp: Date.now() / 1000,
        platform: "javascript",
        level: "error",
        logger: "server",
        environment: "production",
        tags: { where },
        exception: {
          values: [{ type: err.name, value: err.message.slice(0, 500), stacktrace: undefined }],
        },
        extra: { stack: err.stack?.slice(0, 4000) ?? null },
      }),
    });
  } catch {
    /* reporting must never break the request */
  }
}
