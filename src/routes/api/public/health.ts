import { createFileRoute } from "@tanstack/react-router";
import { BUILD_ID } from "@/lib/build-id";

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
        // Keyed by build, so a new version never serves the previous one's report.
        const key = new Request(new URL(`/api/public/health?build=${BUILD_ID}`, request.url).toString());
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
