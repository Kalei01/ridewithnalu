import { createFileRoute } from "@tanstack/react-router";

const CACHE_SECONDS = 600;

/**
 * Live health report (see src/lib/health.server.ts). Returns 200 when every
 * check passes and 503 otherwise, so a scheduled monitor can alert on it.
 * Results are cached for 10 minutes so repeated visits can't run up API use.
 */
export const Route = createFileRoute("/api/public/health")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const cache = (globalThis as { caches?: { default?: Cache } }).caches?.default;
        const key = new Request(new URL("/api/public/health", request.url).toString());
        const hit = await cache?.match(key).catch(() => undefined);
        if (hit) return hit;

        const { runHealthChecks } = await import("@/lib/health.server");
        const report = await runHealthChecks();
        const response = Response.json(
          { ...report, checkedAt: new Date().toISOString() },
          {
            status: report.ok ? 200 : 503,
            headers: { "cache-control": `public, max-age=${CACHE_SECONDS}` },
          },
        );
        await cache?.put(key, response.clone()).catch(() => undefined);
        return response;
      },
    },
  },
});
